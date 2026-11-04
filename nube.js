/* Agente de Dinero: cuenta con correo y contraseña, y datos en la nube (Firebase).

   Solo se carga si firebase-config.js trae la configuración del proyecto.
   Cada persona tiene sus datos en usuarios/{su id}/datos y las reglas de
   Firestore (ver README) hacen que nadie más los pueda leer ni cambiar.

   Los datos se parten en un documento "perfil" (plan, metas, deudas…) y uno
   por mes con los movimientos, para que ningún documento crezca sin límite.
   Firestore guarda una copia en el dispositivo: sin internet se sigue
   usando y los cambios se suben solos cuando vuelve la conexión. */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
  collection,
  doc,
  getDocsFromServer,
  getDocsFromCache,
  writeBatch,
  onSnapshot,
  terminate,
  clearIndexedDbPersistence,
  waitForPendingWrites,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const ESPERA = 10000;

function conTiempo(promesa, ms = ESPERA) {
  let reloj;
  return Promise.race([
    promesa,
    new Promise((_, rechazar) => {
      reloj = setTimeout(() => rechazar(Object.assign(new Error('tiempo'), { code: 'tiempo' })), ms);
    }),
  ]).finally(() => clearTimeout(reloj));
}

// Texto con las llaves en orden: Firestore devuelve los campos ordenados y así
// se puede comparar lo guardado con lo leído sin falsos cambios.
function estable(x) {
  if (Array.isArray(x)) return `[${x.map(estable).join(',')}]`;
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => `${JSON.stringify(k)}:${estable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x === undefined ? null : x);
}

function partir(datos) {
  const limpio = JSON.parse(JSON.stringify(datos)); // Firestore no acepta valores undefined
  const { movimientos = [], ...resto } = limpio;
  const docs = new Map([['perfil', { datos: resto }]]);
  for (const m of movimientos) {
    const id = `mov-${String(m.fecha).slice(0, 7)}`;
    if (!docs.has(id)) docs.set(id, { items: [] });
    docs.get(id).items.push(m);
  }
  return docs;
}

function armar(docs) {
  let perfil = null;
  const movimientos = [];
  for (const d of docs.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const cuerpo = d.data() || {};
    if (d.id === 'perfil') perfil = cuerpo.datos || null;
    else if (d.id.startsWith('mov-') && Array.isArray(cuerpo.items)) movimientos.push(...cuerpo.items);
  }
  return perfil ? { ...perfil, movimientos } : null;
}

export async function conectar(config) {
  const { emuladores, ...opciones } = config;
  const app = initializeApp(opciones);
  const auth = getAuth(app);
  auth.languageCode = 'es';
  // Copia en el dispositivo (IndexedDB) para usarla sin internet; si el navegador no la permite, en memoria.
  let db;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  if (emuladores) {
    // Solo para pruebas en el computador.
    connectAuthEmulator(auth, emuladores.auth, { disableWarnings: true });
    connectFirestoreEmulator(db, emuladores.firestore[0], emuladores.firestore[1]);
  }

  // ¿Ya había una sesión abierta en este dispositivo?
  await conTiempo(new Promise((resolver) => {
    const dejar = onAuthStateChanged(auth, () => {
      dejar();
      resolver();
    });
  }));

  /* Para no pisar cambios entre dispositivos se llevan dos versiones de cada documento:
     - servidor: lo último que se sabe que hay en la nube (lo leído y lo que se guardó desde aquí).
     - app: cómo estaba ese documento la última vez que la app y la nube estuvieron de acuerdo.
     Al guardar, solo se suben los documentos que la app cambió desde entonces. Así, si en el
     celular anotas un gasto mientras en el computador cambiaste el plan, no se pierde ninguno. */
  function crearAlmacen() {
    const usuario = auth.currentUser;
    const coleccion = collection(db, 'usuarios', usuario.uid, 'datos');
    const servidor = new Map(); // documento → { texto, cuerpo }
    const app = new Map(); // documento → texto
    let alFallar = null;

    function leerFoto(foto) {
      servidor.clear();
      for (const d of foto.docs) {
        const cuerpo = d.data() || {};
        servidor.set(d.id, { texto: estable(cuerpo), cuerpo });
      }
    }

    function igualarApp() {
      app.clear();
      for (const [id, { texto }] of servidor) app.set(id, texto);
    }

    function datosDelServidor() {
      return armar(Array.from(servidor, ([id, { cuerpo }]) => ({ id, data: () => cuerpo })));
    }

    function hayRemotos() {
      if (app.size !== servidor.size) return true;
      for (const [id, { texto }] of servidor) if (app.get(id) !== texto) return true;
      return false;
    }

    // todo = true: la nube queda exactamente igual a "datos" (al pasar datos de un dispositivo a la cuenta).
    function prepararLote(datos, todo) {
      const docs = partir(datos);
      const lote = writeBatch(db);
      let cambios = 0;
      for (const [id, cuerpo] of docs) {
        const texto = estable(cuerpo);
        const cambioEnLaApp = todo ? servidor.get(id)?.texto !== texto : app.get(id) !== texto;
        if (cambioEnLaApp) {
          lote.set(doc(coleccion, id), cuerpo);
          servidor.set(id, { texto, cuerpo });
          cambios++;
        }
        app.set(id, texto);
      }
      for (const id of Array.from(todo ? servidor.keys() : app.keys())) {
        if (docs.has(id)) continue;
        lote.delete(doc(coleccion, id));
        servidor.delete(id);
        app.delete(id);
        cambios++;
      }
      return cambios ? lote : null;
    }

    return {
      nube: true,
      donde: 'tu cuenta (solo tú los ves)',
      correo: usuario.email,
      ok: true,
      async iniciar() {
        return true;
      },
      // Primero pregunta al servidor; sin internet usa la copia del dispositivo.
      // Si no hay ninguna de las dos, falla: mejor eso que empezar de cero encima de lo guardado.
      async cargar() {
        let foto;
        try {
          foto = await conTiempo(getDocsFromServer(coleccion));
        } catch (e) {
          if (e && e.code === 'permission-denied') throw e;
          foto = await getDocsFromCache(coleccion);
          if (foto.empty) throw e;
        }
        leerFoto(foto);
        igualarApp();
        return datosDelServidor();
      },
      // Queda guardado en el dispositivo al instante y se sube apenas haya internet.
      async guardar(datos) {
        const lote = prepararLote(datos, false);
        if (lote) {
          lote.commit().catch((e) => {
            app.clear(); // la próxima vez se vuelve a subir todo
            if (alFallar) alFallar(e);
          });
        }
        return true;
      },
      // Deja la nube igual a estos datos y espera a que el servidor los reciba.
      async reemplazarTodo(datos) {
        const lote = prepararLote(datos, true);
        if (lote) await conTiempo(lote.commit());
        return true;
      },
      // Si hubo cambios desde otro dispositivo, devuelve los datos completos de la nube
      // (que ya incluyen lo guardado desde aquí). Si no, null.
      tomarRemotos() {
        if (!hayRemotos()) return null;
        igualarApp();
        return datosDelServidor();
      },
      // Llama a "avisar" cada vez que llegan cambios hechos en otro dispositivo.
      escuchar(avisar, siFalla) {
        alFallar = siFalla;
        return onSnapshot(coleccion, (foto) => {
          if (foto.metadata.hasPendingWrites) return; // todavía incluye cambios de aquí sin subir
          leerFoto(foto);
          if (hayRemotos()) avisar();
        }, (e) => {
          if (siFalla) siFalla(e);
        });
      },
    };
  }

  return {
    get usuario() {
      const u = auth.currentUser;
      return u ? { id: u.uid, correo: u.email } : null;
    },
    entrar: (correo, clave) => signInWithEmailAndPassword(auth, correo, clave),
    crearCuenta: (correo, clave) => createUserWithEmailAndPassword(auth, correo, clave),
    recuperar: (correo) => sendPasswordResetEmail(auth, correo),
    almacen: crearAlmacen,
    // true si todo lo guardado ya llegó al servidor.
    async todoSubido(ms = 5000) {
      try {
        await conTiempo(waitForPendingWrites(db), ms);
        return true;
      } catch (e) {
        return false;
      }
    },
    // Cierra la sesión y borra la copia de los datos que quedó en este dispositivo.
    async salir() {
      await signOut(auth);
      try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch (e) {
        /* si no se puede borrar la copia, igual queda cerrada la sesión */
      }
    },
  };
}
