# Agente de Dinero

Una página para organizar la plata del mes y de cada quincena.

**Cómo abrirla:** abre `index.html` en el navegador (doble clic). No hay que instalar nada
y funciona sin internet (sin conexión, los títulos usan otra letra parecida).

La primera vez sale una bienvenida: puedes **empezar con tus datos** o **ver un ejemplo**
con números inventados para entender cómo funciona.

Diseño: fondo crema, verde bosque y amarillo de resaltador, con títulos en letra con serifa
(Fraunces). Por dentro funciona como una app de iPhone: listas como las de Ajustes, hojas que
suben desde abajo para anotar o editar, y anillos de progreso. En el celular las secciones van
abajo; en el computador, en un menú a la izquierda.

## Qué hace

- **Mi plan**: tocas cada cosa para editarla. Lo que ganas (quincenal, mensual o semanal), lo que pagas sí o sí con su día de
  pago, qué porcentaje vas a ahorrar y, si quieres, un tope al mes para lo que más se te va
  (comida afuera, gastos hormiga…). Calcula cuánto te queda para el día a día en cada quincena
  y por día, y cuánto apartar de una quincena para los pagos grandes de la otra.
- **Resumen**: cuánto te queda en la quincena (o en el mes), cuánto puedes gastar por día,
  qué pagos vencen y cuáles ya pagaste, en qué se te va la plata y avisos: pagos vencidos,
  topes que te pasaste, gastos hormiga, si vas gastando más rápido de lo planeado.
- **Gastos**: anotas cada gasto o ingreso extra en segundos y los ves por día, con filtros,
  y una gráfica **mes a mes** que compara con el mes anterior.
- **Metas**: metas de ahorro (fondo de emergencia, regalos de diciembre…) con cuánto abonar
  cada quincena para llegar a tiempo.
- **Deudas**: cuánto debes, cuándo terminas contando los intereses, por cuál empezar y cuánto
  te ahorras si abonas un poco más.
- **Recordatorios**: en *Mi plan → Tus datos* descargas un archivo para el calendario del
  celular, que te avisa un día antes de cada pago.

## Usarla en el celular como una app

1. En GitHub, entra a **Settings → Pages**.
2. En *Branch* elige `main` y la carpeta `/ (root)`, y toca **Save**.
3. En un par de minutos GitHub te da una dirección (algo como
   `https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`).
4. Ábrela en el celular e instálala:
   - **iPhone:** en **Safari** toca **Compartir** (si no lo ves, está en el menú ···) y elige
     **Agregar a inicio**.
   - **Android:** en **Chrome** toca el menú ⋮ y elige **Instalar app** o
     **Agregar a la pantalla principal**.

   Queda con su icono, se abre como una app y funciona sin internet.

En iPhone vale la pena instalarla: si la usas solo desde Safari y pasas días sin abrirla,
Safari puede borrar lo que la página tiene guardado. Instalada no pasa. La página te lo
recuerda con un aviso en el Resumen (lo puedes cerrar con «Ahora no»).

## Iniciar sesión y ver tus datos en cualquier dispositivo

Con una cuenta (correo y contraseña), tus datos se guardan en la nube y los ves igual en el
iPhone, en el computador o donde inicies sesión. Sin internet se sigue usando: los cambios
se suben solos cuando vuelve la conexión. La nube es **Firebase** (de Google), en un proyecto
tuyo y gratis para el uso de una persona. Se activa una sola vez (mejor desde un computador):

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google y toca
   **Crear un proyecto**. Ponle un nombre, por ejemplo `agente-de-dinero`.
   Google Analytics no hace falta: lo puedes desactivar.
2. **Inicio de sesión:** en el menú, *Authentication* → **Comenzar** → pestaña
   *Método de acceso* → **Correo electrónico/contraseña** → activa la primera opción → **Guardar**.
3. **Base de datos:** en el menú, *Firestore Database* → **Crear base de datos**. Elige una
   ubicación (por ejemplo `southamerica-east1`, São Paulo, la más cercana a Colombia; después no
   se puede cambiar) y el modo **producción**. Luego, en la pestaña **Reglas**, borra lo que hay,
   pega esto y toca **Publicar**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Cada persona solo puede leer y escribir sus propios datos.
       match /usuarios/{uid}/datos/{documento} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. **La app web:** en el engranaje ⚙️ → *Configuración del proyecto* → *Tus apps* → el ícono
   **`</>`** (Web). Ponle de nombre *Agente de Dinero* y toca **Registrar app** (Firebase Hosting
   no hace falta). Te muestra un bloque `const firebaseConfig = { … }`.
5. Copia esos valores en `firebase-config.js`, donde dice `null` (ahí mismo hay un ejemplo de
   cómo queda). Esos valores no son secretos: lo que protege tus datos son las reglas del paso 3.
6. En *Authentication* → *Configuración* → *Dominios autorizados*, agrega el dominio de tu página
   (por ejemplo `thevecina.github.io`).

Listo: al abrir la página sale **Crear cuenta** y **Ya tengo cuenta**. Si ya tenías datos sin
cuenta en ese dispositivo, se suben a tu cuenta al entrar. En *Mi plan → Tus datos* ves con qué
correo entraste y puedes **cerrar sesión**. Si olvidas la contraseña, en *Ya tengo cuenta* toca
**¿Olvidaste tu contraseña?** y te llega un correo (revisa también la carpeta de spam).

Mientras `firebase-config.js` diga `null`, la app funciona sin cuenta, como antes.

## Tus datos

Sin cuenta, se guardan **solo en tu navegador** (localStorage) y no se envían a ningún lado.
Con cuenta, se guardan en tu proyecto de Firebase y solo tú los puedes ver.
Si borras el historial del navegador o cambias de celular, se pierden; por eso en
*Mi plan → Tus datos* puedes **descargar una copia** (.json) y **restaurarla** donde quieras.
En iPhone, *Descargar una copia* abre la hoja de **Compartir**: la puedes guardar en Archivos
o iCloud, o mandártela por WhatsApp o correo.

## Archivos

- `index.html`: la estructura de la página.
- `estilos.css`: el diseño (crema, verde y amarillo; celular y computador).
- `app.js`: los cálculos y el guardado, con comentarios en español.
- `nube.js`: la cuenta (iniciar sesión) y el guardado en Firebase. Solo se carga si hay configuración.
- `firebase-config.js`: la configuración de tu proyecto de Firebase (o `null` para usarla sin cuenta).
- `manifest.webmanifest`, `sw.js` e `icono*`: lo necesario para instalarla como app y usarla sin internet.
