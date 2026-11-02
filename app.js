/* ==========================================================================
   Agente de Dinero — la lógica de la página
   --------------------------------------------------------------------------
   Todo funciona dentro del navegador: no hay servidor ni contraseñas.
   Los datos se guardan en localStorage (o en el almacén que la página reciba
   en window.CUENTAS_CLARAS_ALMACEN) y se pueden descargar como copia .json.

   Ideas clave:
   - 1ª quincena = días 1 al 15. 2ª quincena = día 16 al último del mes.
   - Para el día a día = lo que te entra − pagos fijos − ahorro.
   - Si los pagos grandes caen en una sola quincena, la otra "aparta" plata
     para cubrirlos, y así las dos quedan con lo mismo para el día a día.
   - Un pago fijo queda "pagado" cuando registras su pago (un gasto ligado
     a ese pago y a esa quincena).
   ========================================================================== */

(function () {
  'use strict';

  /* ───────────────────────────── Constantes ───────────────────────────── */

  const CLAVE_LOCAL = 'agente-de-dinero:v1';
  const VERSION_DATOS = 1;
  const VISTAS = ['resumen', 'gastos', 'plan', 'metas', 'deudas'];
  const MESES_ADELANTE = 6; // hasta cuántos meses hacia adelante se puede mirar

  // El orden es el de la ventana "Anotar gasto": primero lo más común.
  const CATEGORIAS = [
    { id: 'comida', nombre: 'Comida afuera', emoji: '🍔' },
    { id: 'hormiga', nombre: 'Gastos hormiga', emoji: '☕' },
    { id: 'transporte', nombre: 'Transporte', emoji: '🚌' },
    { id: 'mercado', nombre: 'Mercado', emoji: '🛒' },
    { id: 'salidas', nombre: 'Salidas y planes', emoji: '🎉' },
    { id: 'servicios', nombre: 'Servicios', emoji: '💡' },
    { id: 'vivienda', nombre: 'Vivienda', emoji: '🏠' },
    { id: 'salud', nombre: 'Salud', emoji: '💊' },
    { id: 'deudas', nombre: 'Deudas y cuotas', emoji: '💳' },
    { id: 'educacion', nombre: 'Estudio', emoji: '📚' },
    { id: 'ropa', nombre: 'Ropa y cuidado', emoji: '👕' },
    { id: 'suscripciones', nombre: 'Suscripciones', emoji: '📺' },
    { id: 'familia', nombre: 'Familia y regalos', emoji: '🎁' },
    { id: 'otros', nombre: 'Otros', emoji: '📦' },
  ];
  const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));

  const FREC_INGRESO = {
    quincenal: { nombre: 'Quincenal', porMes: 2 },
    mensual: { nombre: 'Mensual', porMes: 1 },
    semanal: { nombre: 'Semanal', porMes: 52 / 12 },
  };
  const FREC_FIJO = {
    mensual: { nombre: 'Mensual' },
    quincenal: { nombre: 'Quincenal' },
  };

  const SUGERENCIAS_FIJOS = [
    { nombre: 'Arriendo', categoria: 'vivienda', dia: 1 },
    { nombre: 'Luz', categoria: 'servicios', dia: 15 },
    { nombre: 'Agua', categoria: 'servicios', dia: 15 },
    { nombre: 'Gas', categoria: 'servicios', dia: 15 },
    { nombre: 'Internet', categoria: 'servicios', dia: 10 },
    { nombre: 'Plan de celular', categoria: 'servicios', dia: 20 },
    { nombre: 'Mercado', categoria: 'mercado', dia: 15, frecuencia: 'quincenal' },
    { nombre: 'Transporte', categoria: 'transporte', dia: 1, frecuencia: 'quincenal' },
    { nombre: 'Cuota del crédito', categoria: 'deudas', dia: 5 },
    { nombre: 'Tarjeta de crédito', categoria: 'deudas', dia: 20 },
    { nombre: 'Seguridad social', categoria: 'salud', dia: 10 },
    { nombre: 'Colegio o estudio', categoria: 'educacion', dia: 5 },
    { nombre: 'Streaming', categoria: 'suscripciones', dia: 12 },
    { nombre: 'Ayuda a la familia', categoria: 'familia', dia: 30 },
  ];

  const SUGERENCIAS_METAS = [
    'Fondo de emergencia',
    'Regalos de diciembre',
    'SOAT',
    'Vacaciones',
    'Estudio',
    'Salir de deudas',
  ];

  const CONSEJOS = [
    'Págate primero: apenas te llegue la quincena, separa lo del ahorro. Lo que sobre es para gastar, no al revés.',
    'Los gastos hormiga (el tinto, el mecato, el domicilio) parecen poquitos, pero juntos se comen la quincena. Anótalos todos durante un mes y mira cuánto suman.',
    'Arma un fondo de emergencia. Lo ideal son 3 meses de tus pagos fijos, pero empieza con una meta pequeña, como $300.000.',
    'Cuando te llegue la prima de junio o de diciembre, abona una parte a tus metas o a tus deudas antes de gastarla.',
    'No te endeudes con préstamos gota a gota: los intereses son altísimos y el cobro puede ser peligroso. Si necesitas plata, pregunta en un banco o en una cooperativa.',
    'Si usas tarjeta de crédito, paga el total cada mes. Si solo pagas el mínimo, los intereses hacen crecer la deuda.',
    'Antes de comprar algo que no estaba en tu plan, espera un día. Si mañana todavía lo necesitas, cómpralo.',
    'Haz mercado con lista y sin hambre. Las marcas propias del supermercado suelen costar menos y rinden igual.',
    'Revisa tus suscripciones (streaming, apps, gimnasio) y cancela las que no usas cada semana.',
    'Regla 50/30/20: máximo la mitad de lo que ganas para necesidades, 30% para gustos y 20% para ahorro y deudas. Si todavía no llegas, acércate poco a poco.',
    'Saca en efectivo solo la plata de la semana y deja el resto en la cuenta. Así es más difícil gastar de más.',
    'Si tienes varias deudas, paga primero la de interés más alto. Cuando la termines, usa esa misma cuota para pagar la siguiente.',
    'Anota tus gastos todas las noches, aunque sea un minuto. Ese hábito es el que más ayuda.',
    'Diciembre sale caro: novenas, regalos, paseos. Crea desde ya una meta para diciembre y abónale cada quincena.',
  ];

  const ICONO = {
    izq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    der: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    basura: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v7M12 17.5h.01"/></svg>',
    equis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10.5v7M12 6.5h.01"/></svg>',
    mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };
  const ICONO_NIVEL = { bien: ICONO.check, ojo: ICONO.alerta, mal: ICONO.equis, info: ICONO.info };
  const ETIQUETA_NIVEL = { bien: 'Bien', ojo: 'Ojo', mal: 'Alerta', info: 'Dato' };
  const ORDEN_NIVEL = { mal: 0, ojo: 1, info: 2, bien: 3 };

  /* ───────────────────────────── Utilidades ───────────────────────────── */

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

  function esc(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // 1250000 → "1.250.000" (así se escribe la plata en Colombia)
  function miles(n) {
    return String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // 1250000 → "$1.250.000"; -5000 → "−$5.000"
  function plata(n) {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '−' : '') + '$' + miles(v);
  }

  // "1.250.000" o "$ 1250000" → 1250000
  function leerMonto(texto) {
    const digitos = String(texto ?? '').replace(/\D/g, '').slice(0, 12);
    return digitos ? Number(digitos) : 0;
  }

  function limpiarMonto(x) {
    const n = Math.round(Number(x));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 999999999999) : 0;
  }

  function porcentaje(parte, total) {
    return total > 0 ? Math.round((parte / total) * 100) : 0;
  }

  // Marca de tiempo que nunca se repite: sirve para saber qué pasó primero
  // (por ejemplo, un pago y la actualización del saldo de una deuda).
  function marca() {
    let ultima = 0;
    for (const m of datos.movimientos) if (m.ts > ultima) ultima = m.ts;
    for (const d of datos.deudas) if (d.base.ts > ultima) ultima = d.base.ts;
    return Math.max(Date.now(), ultima + 1);
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function listaBonita(nombres) {
    if (nombres.length <= 1) return nombres.join('');
    return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
  }

  /* ─────────────────────────────── Fechas ─────────────────────────────── */
  // Las fechas se manejan como texto "AAAA-MM-DD" en la hora local.

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  const dos = (n) => String(n).padStart(2, '0');
  const aISO = (f) => `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
  const hoyISO = () => aISO(new Date());
  const diasEnMes = (a, m) => new Date(a, m, 0).getDate();
  const mesClave = (a, m) => `${a}-${dos(m)}`;

  function deISO(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function esFecha(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && aISO(deISO(iso)) === iso;
  }

  function diasEntre(desde, hasta) {
    return Math.round((deISO(hasta) - deISO(desde)) / 86400000);
  }

  function sumarMeses(clave, n) {
    let [a, m] = clave.split('-').map(Number);
    m += n;
    while (m > 12) { m -= 12; a += 1; }
    while (m < 1) { m += 12; a -= 1; }
    return mesClave(a, m);
  }

  function fechaCorta(iso) {
    const f = deISO(iso);
    const texto = `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
    return f.getFullYear() === new Date().getFullYear() ? texto : `${texto} ${f.getFullYear()}`;
  }

  function fechaLarga(iso) {
    const f = deISO(iso);
    return `${DIAS[f.getDay()]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
  }

  /* ────────────────────────────── Periodos ────────────────────────────── */
  // Un periodo es una quincena { tipo: 'q', a, m, q } o un mes { tipo: 'm', a, m }.

  function periodoDe(iso, tipo) {
    const [a, m, d] = iso.split('-').map(Number);
    return tipo === 'm' ? { tipo: 'm', a, m } : { tipo: 'q', a, m, q: d <= 15 ? 1 : 2 };
  }

  function rangoDe(p) {
    const ultimo = diasEnMes(p.a, p.m);
    const d1 = p.tipo === 'q' && p.q === 2 ? 16 : 1;
    const d2 = p.tipo === 'q' && p.q === 1 ? 15 : ultimo;
    const mes = mesClave(p.a, p.m);
    return { inicio: `${mes}-${dos(d1)}`, fin: `${mes}-${dos(d2)}`, dias: d2 - d1 + 1 };
  }

  function moverPeriodo(p, paso) {
    if (p.tipo === 'm') {
      const [a, m] = sumarMeses(mesClave(p.a, p.m), paso).split('-').map(Number);
      return { tipo: 'm', a, m };
    }
    let i = (p.a * 12 + p.m - 1) * 2 + (p.q - 1) + paso;
    const q = (i % 2) + 1;
    i = Math.floor(i / 2);
    return { tipo: 'q', a: Math.floor(i / 12), m: (i % 12) + 1, q };
  }

  const quincenasDe = (p) => (p.tipo === 'm' ? [1, 2] : [p.q]);
  const claveQuincena = (a, m, q) => `${mesClave(a, m)}-${q}`;

  function momentoDe(rango, hoy) {
    if (rango.fin < hoy) return 'pasado';
    if (rango.inicio > hoy) return 'futuro';
    return 'actual';
  }

  function nombrePeriodo(p) {
    if (p.tipo === 'm') return `${capital(MESES[p.m - 1])} ${p.a}`;
    return `${p.q === 1 ? '1ª' : '2ª'} quincena de ${MESES[p.m - 1]}`;
  }

  function textoRango(p) {
    const r = rangoDe(p);
    return `Del ${deISO(r.inicio).getDate()} al ${deISO(r.fin).getDate()} de ${MESES[p.m - 1]} de ${p.a}`;
  }

  /* ──────────────────────────── Estado y datos ────────────────────────── */

  let datos = null; // lo que el usuario guarda
  let almacen = null; // dónde se guarda
  const ui = {
    vista: 'resumen',
    periodo: null,
    filtroTipo: 'todo',
    filtroCat: '',
    consejo: null,
    fijosAbiertos: new Set(), // pagos fijos que están abiertos para editar
    enfocar: null,
  };

  function datosVacios(hoy) {
    return {
      version: VERSION_DATOS,
      ejemplo: false,
      nombre: '',
      inicio: hoy.slice(0, 7),
      ahorroPct: 10,
      ingresos: [],
      fijos: [],
      metas: [],
      movimientos: [],
      historial: [],
      deudas: [],
      topes: [],
    };
  }

  // Revisa y limpia datos que vienen del almacén o de una copia, para que un
  // archivo dañado o editado a mano no rompa la página.
  function normalizar(crudo, hoy) {
    const d = datosVacios(hoy);
    if (!crudo || typeof crudo !== 'object') return d;

    const lista = (x) => (Array.isArray(x) ? x.filter((y) => y && typeof y === 'object') : []);
    const texto = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
    const usados = new Set();
    const idUnico = (x) => {
      let id = typeof x === 'string' && /^[\w-]{1,40}$/.test(x) ? x : nuevoId();
      while (usados.has(id)) id = nuevoId();
      usados.add(id);
      return id;
    };
    const esQuincena = (x) => typeof x === 'string' && /^\d{4}-\d{2}-[12]$/.test(x);

    d.ejemplo = crudo.ejemplo === true;
    d.nombre = texto(crudo.nombre, 30);
    if (typeof crudo.inicio === 'string' && /^\d{4}-\d{2}$/.test(crudo.inicio)) d.inicio = crudo.inicio;
    const pct = Math.round(Number(crudo.ahorroPct));
    d.ahorroPct = Number.isFinite(pct) ? Math.min(40, Math.max(0, pct)) : 10;

    d.ingresos = lista(crudo.ingresos).map((i) => ({
      id: idUnico(i.id),
      nombre: texto(i.nombre, 40),
      monto: limpiarMonto(i.monto),
      frecuencia: FREC_INGRESO[i.frecuencia] ? i.frecuencia : 'mensual',
    }));

    d.fijos = lista(crudo.fijos).map((f) => ({
      id: idUnico(f.id),
      nombre: texto(f.nombre, 40),
      monto: limpiarMonto(f.monto),
      categoria: CAT[f.categoria] ? f.categoria : 'otros',
      frecuencia: f.frecuencia === 'quincenal' ? 'quincenal' : 'mensual',
      dia: Math.min(31, Math.max(1, Math.round(Number(f.dia)) || 1)),
      desde: esQuincena(f.desde) ? f.desde : '',
    }));

    d.metas = lista(crudo.metas).map((m) => ({
      id: idUnico(m.id),
      nombre: texto(m.nombre, 40) || 'Meta',
      objetivo: limpiarMonto(m.objetivo),
      inicial: limpiarMonto(m.inicial),
      fecha: esFecha(m.fecha) ? m.fecha : '',
      creada: esFecha(m.creada) ? m.creada : hoy,
    }));

    const tipos = ['gasto', 'ingreso', 'ahorro', 'retiro'];
    d.movimientos = lista(crudo.movimientos)
      .filter((m) => tipos.includes(m.tipo) && esFecha(m.fecha) && limpiarMonto(m.monto) > 0)
      .map((m) => {
        const mov = {
          id: idUnico(m.id),
          tipo: m.tipo,
          monto: limpiarMonto(m.monto),
          fecha: m.fecha,
          categoria: m.tipo === 'gasto' ? (CAT[m.categoria] ? m.categoria : 'otros') : '',
          nota: texto(m.nota, 60),
        };
        if (m.tipo === 'gasto' && typeof m.fijoId === 'string' && esQuincena(m.occ)) {
          mov.fijoId = m.fijoId;
          mov.occ = m.occ;
        }
        if ((m.tipo === 'ahorro' || m.tipo === 'retiro') && typeof m.metaId === 'string') mov.metaId = m.metaId;
        if (m.tipo === 'gasto' && !mov.fijoId && typeof m.deudaId === 'string') mov.deudaId = m.deudaId;
        if (Number.isFinite(m.ts) && m.ts > 0) mov.ts = Math.round(m.ts);
        return mov;
      });

    d.deudas = lista(crudo.deudas).map((x) => {
      const saldo = limpiarMonto(x.saldo);
      const tasa = Number(x.tasaEA);
      const base = x.base && typeof x.base === 'object' ? x.base : {};
      return {
        id: idUnico(x.id),
        nombre: texto(x.nombre, 40) || 'Deuda',
        saldo,
        inicial: Math.max(saldo, limpiarMonto(x.inicial)),
        cuota: limpiarMonto(x.cuota),
        tasaEA: Number.isFinite(tasa) ? Math.min(200, Math.max(0, Math.round(tasa * 100) / 100)) : 0,
        fijoId: typeof x.fijoId === 'string' ? x.fijoId : '',
        base: { fecha: esFecha(base.fecha) ? base.fecha : hoy, ts: Number.isFinite(base.ts) ? base.ts : 0 },
      };
    });

    d.topes = lista(crudo.topes)
      .filter((x) => CAT[x.categoria])
      .map((x) => ({ id: idUnico(x.id), categoria: x.categoria, monto: limpiarMonto(x.monto) }));

    d.historial = lista(crudo.historial)
      .filter((h) => typeof h.desde === 'string' && /^\d{4}-\d{2}$/.test(h.desde))
      .map((h) => ({ desde: h.desde, ingreso: limpiarMonto(h.ingreso), ahorro: limpiarMonto(h.ahorro) }))
      .sort((x, y) => x.desde.localeCompare(y.desde));

    return d;
  }

  /* ─────────────────────────────── Ejemplo ────────────────────────────── */
  // Datos inventados para mostrar cómo funciona la página la primera vez.
  // Se arman según la fecha de hoy, así siempre se ven "al día".

  function azar(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function crearEjemplo(hoy) {
    const [a, m, d] = hoy.split('-').map(Number);
    const mesHoy = mesClave(a, m);
    const inicio = sumarMeses(mesHoy, -2);
    const desde = `${inicio}-1`;
    const ej = datosVacios(hoy);
    ej.ejemplo = true;
    ej.inicio = inicio;
    ej.ingresos = [{ id: 'ej-sueldo', nombre: 'Sueldo', monto: 1000000, frecuencia: 'quincenal' }];
    ej.fijos = [
      { id: 'ej-arriendo', nombre: 'Arriendo', monto: 500000, categoria: 'vivienda', frecuencia: 'mensual', dia: 1, desde },
      { id: 'ej-moto', nombre: 'Cuota de la moto', monto: 180000, categoria: 'deudas', frecuencia: 'mensual', dia: 5, desde },
      { id: 'ej-internet', nombre: 'Internet', monto: 70000, categoria: 'servicios', frecuencia: 'mensual', dia: 10, desde },
      { id: 'ej-streaming', nombre: 'Streaming', monto: 27000, categoria: 'suscripciones', frecuencia: 'mensual', dia: 12, desde },
      { id: 'ej-mercado', nombre: 'Mercado', monto: 200000, categoria: 'mercado', frecuencia: 'quincenal', dia: 15, desde },
      { id: 'ej-servicios', nombre: 'Luz, agua y gas', monto: 150000, categoria: 'servicios', frecuencia: 'mensual', dia: 18, desde },
      { id: 'ej-celular', nombre: 'Plan de celular', monto: 40000, categoria: 'servicios', frecuencia: 'mensual', dia: 20, desde },
    ];
    ej.ahorroPct = 10;
    ej.historial = [{ desde: inicio, ingreso: 2000000, ahorro: 200000 }];
    const anioDiciembre = m === 12 && d > 15 ? a + 1 : a;
    ej.metas = [
      { id: 'ej-emergencia', nombre: 'Fondo de emergencia', objetivo: 4000000, inicial: 450000, fecha: '', creada: `${inicio}-01` },
      { id: 'ej-diciembre', nombre: 'Regalos de diciembre', objetivo: 400000, inicial: 60000, fecha: `${anioDiciembre}-12-15`, creada: `${inicio}-01` },
    ];

    const movs = [];
    const agregar = (fecha, tipo, monto, extra) => {
      movs.push({ id: `ej-m${movs.length}`, tipo, monto, fecha, categoria: '', nota: '', ...extra });
    };

    for (const clave of [sumarMeses(mesHoy, -1), mesHoy]) {
      const [aa, mm] = clave.split('-').map(Number);
      const esteMes = clave === mesHoy;
      const hasta = esteMes ? d : diasEnMes(aa, mm);
      const rnd = azar(aa * 100 + mm);
      const f = (dia) => `${clave}-${dos(dia)}`;

      // Pagos fijos hechos el día que vencen. Este mes falta pagar el internet.
      for (const fijo of ej.fijos) {
        const qs = fijo.frecuencia === 'quincenal' ? [1, 2] : [fijo.dia <= 15 ? 1 : 2];
        for (const q of qs) {
          const dia = diaDeVencimiento(fijo, aa, mm, q);
          if (dia > hasta || (esteMes && fijo.id === 'ej-internet')) continue;
          const monto = fijo.id === 'ej-servicios' ? 138000 + Math.round(rnd() * 24) * 1000 : fijo.monto;
          agregar(f(dia), 'gasto', monto, {
            categoria: fijo.categoria,
            nota: fijo.nombre,
            fijoId: fijo.id,
            occ: claveQuincena(aa, mm, q),
          });
        }
      }

      // El ahorro se separa apenas llega la quincena.
      agregar(f(1), 'ahorro', 100000, { metaId: 'ej-emergencia' });
      if (hasta >= 16) {
        agregar(f(16), 'ahorro', 60000, { metaId: 'ej-emergencia' });
        agregar(f(16), 'ahorro', 40000, { metaId: 'ej-diciembre' });
      }

      // Gastos del día a día.
      for (let dia = 1; dia <= hasta; dia++) {
        const semana = new Date(aa, mm - 1, dia).getDay();
        const habil = semana >= 1 && semana <= 5;
        if (habil && rnd() < 0.7) {
          agregar(f(dia), 'gasto', 3000 + Math.round(rnd() * 3) * 500, {
            categoria: 'hormiga',
            nota: rnd() < 0.5 ? 'Tinto y pandebono' : 'Mecato',
          });
        }
        if (habil && rnd() < 0.4) {
          agregar(f(dia), 'gasto', 12000 + Math.round(rnd() * 4) * 1000, { categoria: 'comida', nota: 'Almuerzo' });
        }
        if (dia % 5 === 2) {
          agregar(f(dia), 'gasto', 15000 + Math.round(rnd() * 4) * 1000, { categoria: 'transporte', nota: 'Gasolina de la moto' });
        }
        if (semana === 6 && rnd() < 0.55) {
          agregar(f(dia), 'gasto', 30000 + Math.round(rnd() * 4) * 5000, { categoria: 'salidas', nota: 'Salida con amigos' });
        }
        if (semana === 0 && rnd() < 0.5) {
          agregar(f(dia), 'gasto', 24000 + Math.round(rnd() * 4) * 2000, { categoria: 'comida', nota: 'Domicilio' });
        }
      }
      if (hasta >= 9) agregar(f(9), 'gasto', 18500, { categoria: 'salud', nota: 'Droguería' });
      if (hasta >= 13) agregar(f(13), 'gasto', 15000, { categoria: 'ropa', nota: 'Peluquería' });
      if (!esteMes) {
        agregar(f(22), 'ingreso', 120000, { nota: 'Trabajo extra' });
        agregar(f(26), 'gasto', 45000, { categoria: 'familia', nota: 'Regalo de cumpleaños' });
      }
    }

    ej.movimientos = movs;
    ej.deudas = [{
      id: 'ej-deuda-moto', nombre: 'Crédito de la moto', saldo: 3100000, inicial: 4300000, cuota: 0,
      tasaEA: 22, fijoId: 'ej-moto', base: { fecha: `${inicio}-01`, ts: 0 },
    }];
    ej.topes = [
      { id: 'ej-tope-comida', categoria: 'comida', monto: 180000 },
      { id: 'ej-tope-hormiga', categoria: 'hormiga', monto: 60000 },
    ];
    return ej;
  }

  /* ────────────────────────────── El plan ─────────────────────────────── */

  function ingresoMensual() {
    return Math.round(datos.ingresos.reduce((s, i) => s + i.monto * (FREC_INGRESO[i.frecuencia]?.porMes ?? 1), 0));
  }

  function fijosMensual() {
    return datos.fijos.reduce((s, f) => s + f.monto * (f.frecuencia === 'quincenal' ? 2 : 1), 0);
  }

  function ahorroMensual() {
    return Math.round((ingresoMensual() * datos.ahorroPct) / 100);
  }

  const quincenaDelFijo = (f) => (f.dia <= 15 ? 1 : 2);

  // Pagos fijos de una quincena según el plan.
  function fijosPlanQuincena(q) {
    return datos.fijos.reduce((s, f) => s + (f.frecuencia === 'quincenal' || quincenaDelFijo(f) === q ? f.monto : 0), 0);
  }

  // Lo que la 2ª quincena aparta para los pagos de la 1ª (si es negativo,
  // es la 1ª la que aparta para la 2ª). Con esto ambas quincenas quedan
  // con lo mismo para el día a día.
  function apartadoParaQ1() {
    return Math.round((fijosPlanQuincena(1) - fijosPlanQuincena(2)) / 2);
  }

  // Día del mes en que vence un pago fijo en una quincena dada.
  function diaDeVencimiento(fijo, a, m, q) {
    const ultimo = diasEnMes(a, m);
    if (fijo.frecuencia === 'quincenal') {
      const base = ((fijo.dia - 1) % 15) + 1;
      return q === 1 ? base : Math.min(base + 15, ultimo);
    }
    return Math.min(fijo.dia, ultimo);
  }

  // Guarda cómo era el plan cada mes, para que cambiar el sueldo hoy no
  // cambie las cuentas de los meses pasados.
  function registrarHistorial() {
    const mes = hoyISO().slice(0, 7);
    const version = { desde: mes, ingreso: ingresoMensual(), ahorro: ahorroMensual() };
    const ultima = datos.historial[datos.historial.length - 1];
    if (ultima && ultima.desde === mes) Object.assign(ultima, version);
    else if (!ultima || ultima.ingreso !== version.ingreso || ultima.ahorro !== version.ahorro) datos.historial.push(version);
  }

  function planDelMes(a, m) {
    const clave = mesClave(a, m);
    if (clave >= hoyISO().slice(0, 7) || !datos.historial.length) {
      return { ingreso: ingresoMensual(), ahorro: ahorroMensual() };
    }
    let version = datos.historial[0];
    for (const h of datos.historial) if (h.desde <= clave) version = h;
    return version;
  }

  /* ───────────────────────── Cuentas de un periodo ────────────────────── */

  // ¿A qué quincena pertenece un movimiento? Los pagos fijos cuentan en la
  // quincena del pago (aunque se hayan pagado antes o después).
  function quincenaDelMov(mov) {
    if (mov.occ) {
      const [a, m, q] = mov.occ.split('-').map(Number);
      return { a, m, q };
    }
    const [a, m, d] = mov.fecha.split('-').map(Number);
    return { a, m, q: d <= 15 ? 1 : 2 };
  }

  function movEnPeriodo(mov, p) {
    const x = quincenaDelMov(mov);
    return x.a === p.a && x.m === p.m && (p.tipo === 'm' || x.q === p.q);
  }

  // Los pagos fijos que tocan en un periodo, con su estado.
  function ocurrencias(p, hoy) {
    const lista = [];
    for (const fijo of datos.fijos) {
      const qs = fijo.frecuencia === 'quincenal' ? quincenasDe(p) : quincenasDe(p).filter((q) => q === quincenaDelFijo(fijo));
      for (const q of qs) {
        const occ = claveQuincena(p.a, p.m, q);
        if (fijo.desde && occ < fijo.desde) continue; // todavía no existía
        const vence = `${mesClave(p.a, p.m)}-${dos(diaDeVencimiento(fijo, p.a, p.m, q))}`;
        const pago = datos.movimientos.find(
          (mv) => mv.fijoId === fijo.id && mv.occ && (fijo.frecuencia === 'quincenal' ? mv.occ === occ : mv.occ.slice(0, 7) === occ.slice(0, 7))
        );
        let estado = 'pendiente';
        if (pago) estado = 'pagado';
        else if (vence < hoy) estado = 'vencido';
        else if (vence === hoy) estado = 'hoy';
        lista.push({ fijo, occ, q, vence, pago, estado, monto: pago ? pago.monto : fijo.monto });
      }
    }
    return lista.sort((x, y) => x.vence.localeCompare(y.vence) || x.fijo.nombre.localeCompare(y.fijo.nombre));
  }

  function calcularPeriodo(p, hoy) {
    const rango = rangoDe(p);
    const parte = quincenasDe(p).length / 2;
    const plan = planDelMes(p.a, p.m);
    const ingresoPlan = Math.round(plan.ingreso * parte);
    const ahorroPlan = Math.round(plan.ahorro * parte);
    const traspaso = p.tipo === 'q' ? (p.q === 1 ? apartadoParaQ1() : -apartadoParaQ1()) : 0;

    const movs = datos.movimientos.filter((mv) => movEnPeriodo(mv, p));
    let extras = 0;
    let abonos = 0;
    let retiros = 0;
    let variable = 0;
    let fijosPagados = 0;
    const porCategoria = {};
    for (const mv of movs) {
      if (mv.tipo === 'ingreso') extras += mv.monto;
      else if (mv.tipo === 'ahorro') abonos += mv.monto;
      else if (mv.tipo === 'retiro') retiros += mv.monto;
      else {
        if (mv.fijoId) fijosPagados += mv.monto;
        else variable += mv.monto;
        porCategoria[mv.categoria] = (porCategoria[mv.categoria] || 0) + mv.monto;
      }
    }

    const ocs = ocurrencias(p, hoy);
    const fijosPendientes = ocs.filter((o) => !o.pago).reduce((s, o) => s + o.monto, 0);
    const fijos = fijosPagados + fijosPendientes;
    const ahorro = Math.max(ahorroPlan, abonos);
    const libre = ingresoPlan + traspaso + extras + retiros - fijos - ahorro;
    const quedan = libre - variable;
    const momento = momentoDe(rango, hoy);
    let diasRestantes = 0;
    let diasPasados = 0;
    if (momento === 'actual') {
      diasRestantes = diasEntre(hoy, rango.fin) + 1;
      diasPasados = diasEntre(rango.inicio, hoy) + 1;
    } else if (momento === 'futuro') {
      diasRestantes = rango.dias;
    } else {
      diasPasados = rango.dias;
    }
    const porDia = diasRestantes > 0 ? Math.floor(Math.max(quedan, 0) / diasRestantes) : 0;

    return {
      p, rango, momento, movs, ocs,
      ingresoPlan, traspaso, extras, abonos, retiros, ahorroPlan, ahorro,
      fijos, fijosPagados, fijosPendientes, variable, libre, quedan,
      porDia, diasRestantes, diasPasados, porCategoria,
    };
  }

  function calcularAlertas(c, hoy) {
    const lista = [];
    const unidad = c.p.tipo === 'm' ? 'este mes' : 'esta quincena';

    const vencidos = c.ocs.filter((o) => o.estado === 'vencido');
    if (vencidos.length === 1) {
      const o = vencidos[0];
      lista.push({ nivel: 'mal', texto: `Se pasó la fecha de <strong>${esc(o.fijo.nombre || 'un pago')}</strong> (${fechaCorta(o.vence)}). Si ya lo pagaste, toca “Ya pagué”.` });
    } else if (vencidos.length > 1) {
      const nombres = listaBonita(vencidos.map((o) => `<strong>${esc(o.fijo.nombre || 'un pago')}</strong>`));
      lista.push({ nivel: 'mal', texto: `Se pasó la fecha de ${vencidos.length} pagos: ${nombres}. Si ya los pagaste, márcalos con “Ya pagué”.` });
    }

    if (c.momento === 'actual') {
      const pronto = c.ocs.filter((o) => (o.estado === 'hoy' || o.estado === 'pendiente') && diasEntre(hoy, o.vence) <= 3);
      if (pronto.length) {
        const cuales = listaBonita(pronto.map((o) => `<strong>${esc(o.fijo.nombre || 'un pago')}</strong> (${o.estado === 'hoy' ? 'hoy' : fechaCorta(o.vence)})`));
        lista.push({ nivel: 'ojo', texto: `Pronto vence: ${cuales}.` });
      }
      if (c.libre > 0 && c.quedan >= 0 && c.variable > 0) {
        const ideal = (c.libre * c.diasPasados) / c.rango.dias;
        if (c.variable > ideal * 1.15 && c.variable - ideal >= 10000) {
          lista.push({ nivel: 'ojo', texto: `Vas gastando más rápido de lo planeado: a hoy lo ideal era llevar ${plata(ideal)} y llevas ${plata(c.variable)}. Si bajas el ritmo, te alcanza.` });
        } else {
          lista.push({ nivel: 'bien', texto: 'Vas a buen ritmo. Sigue anotando todo lo que gastas.' });
        }
      }
      if (c.ahorroPlan > 0 && c.abonos < c.ahorroPlan) {
        lista.push({
          nivel: 'info',
          texto: `Te falta separar <strong>${plata(c.ahorroPlan - c.abonos)}</strong> para tu ahorro de ${unidad}. Lo mejor es hacerlo apenas te paguen.`,
          boton: '<button type="button" class="btn btn-sutil btn-chico" data-accion="ir-abonar">Abonar a una meta</button>',
        });
      }
    }

    if (c.momento === 'pasado' && c.libre > 0 && c.quedan > 0) {
      lista.push({
        nivel: 'bien',
        texto: `Te sobraron ${plata(c.quedan)}. Si todavía tienes esa plata, abónala a una meta antes de que se vaya.`,
        boton: '<button type="button" class="btn btn-sutil btn-chico" data-accion="ir-abonar">Abonar a una meta</button>',
      });
    }

    const hormiga = c.porCategoria.hormiga || 0;
    if (c.ingresoPlan > 0 && hormiga >= 20000 && hormiga / c.ingresoPlan >= 0.04) {
      lista.push({ nivel: 'ojo', texto: `Los gastos hormiga van en <strong>${plata(hormiga)}</strong>: el ${porcentaje(hormiga, c.ingresoPlan)}% de lo que te entra. Un tinto al día también suma.` });
    }

    if (c.momento !== 'futuro') {
      const cuando = c.momento === 'pasado' ? 'ese mes' : 'este mes';
      for (const tope of datos.topes) {
        if (!tope.monto) continue;
        const usado = gastoDelMes(c.p.a, c.p.m).porCat[tope.categoria] || 0;
        const nombre = esc(CAT[tope.categoria].nombre.toLowerCase());
        if (usado > tope.monto) {
          lista.push({ nivel: 'mal', texto: `Te pasaste del tope de <strong>${nombre}</strong>: llevas ${plata(usado)} de ${plata(tope.monto)} ${cuando}.` });
        } else if (usado >= tope.monto * 0.8 && c.momento === 'actual') {
          lista.push({ nivel: 'ojo', texto: `Vas en el ${porcentaje(usado, tope.monto)}% del tope de <strong>${nombre}</strong>: te quedan ${plata(tope.monto - usado)} para el resto del mes.` });
        }
      }
    }

    if (c.momento === 'actual') {
      for (const dd of datos.deudas) {
        const saldo = saldoDeDeuda(dd);
        const r = tasaMensual(dd);
        if (saldo > 0 && r > 0 && cuotaDeDeuda(dd) > 0 && cuotaDeDeuda(dd) <= saldo * r) {
          lista.push({ nivel: 'mal', texto: `La cuota de <strong>${esc(dd.nombre)}</strong> no alcanza ni para los intereses: esa deuda va a crecer. Mira la pestaña Deudas.` });
        }
      }
    }

    return lista.sort((x, y) => ORDEN_NIVEL[x.nivel] - ORDEN_NIVEL[y.nivel]).slice(0, 5);
  }

  function calcularDiagnostico() {
    const ingreso = ingresoMensual();
    const fijos = fijosMensual();
    const ahorro = ahorroMensual();
    const libre = ingreso - fijos - ahorro;
    const lista = [];

    if (!ingreso) {
      lista.push({ nivel: 'info', texto: 'Empieza por el paso 1: escribe cuánto te pagan y cada cuánto.' });
      return lista;
    }

    const pf = porcentaje(fijos, ingreso);
    if (!fijos) {
      lista.push({ nivel: 'info', texto: 'Agrega tus pagos fijos en el paso 2 (arriendo, servicios, cuotas…). Sin ellos la cuenta no es real.' });
    } else if (pf <= 50) {
      lista.push({ nivel: 'bien', texto: `Tus pagos fijos se llevan el <strong>${pf}%</strong> de lo que ganas. Lo recomendable es máximo 50%: vas bien.` });
    } else if (pf <= 70) {
      lista.push({ nivel: 'ojo', texto: `Tus pagos fijos se llevan el <strong>${pf}%</strong> de lo que ganas. Lo recomendable es máximo 50%. Mira si puedes bajar alguno (celular, suscripciones, mercado).` });
    } else {
      lista.push({ nivel: 'mal', texto: `Tus pagos fijos se llevan el <strong>${pf}%</strong> de lo que ganas. Te queda muy poco para vivir: revisa qué pagos puedes bajar o quitar.` });
    }

    const pa = datos.ahorroPct;
    if (pa === 0) lista.push({ nivel: 'ojo', texto: 'No estás ahorrando nada. Empieza con 5%: aunque sea poquito, te salva en una emergencia.' });
    else if (pa < 10) lista.push({ nivel: 'info', texto: `Ahorras el ${pa}% de lo que ganas. Buen comienzo; cuando puedas, súbelo al 10%.` });
    else lista.push({ nivel: 'bien', texto: `Ahorras el <strong>${pa}%</strong> de lo que ganas (${plata(ahorro)} al mes). ¡Muy bien!` });

    if (libre < 0) {
      lista.push({ nivel: 'mal', texto: `Te faltan <strong>${plata(-libre)}</strong> al mes: tus pagos fijos y tu ahorro suman más de lo que ganas. Baja algún pago o el ahorro hasta que la cuenta dé.` });
    } else {
      const porDia = libre / 30;
      lista.push({
        nivel: porDia < 10000 ? 'ojo' : 'info',
        texto: `Te quedan <strong>${plata(libre)}</strong> al mes para el día a día: unos ${plata(porDia)} diarios para comida, transporte y gustos.`,
      });
    }

    const t = apartadoParaQ1();
    if (Math.abs(t) >= 1000) {
      const [grande, otra] = t > 0 ? ['1ª', '2ª'] : ['2ª', '1ª'];
      lista.push({ nivel: 'info', texto: `Tus pagos más grandes caen en la ${grande} quincena. De lo que te paguen en la ${otra}, aparta <strong>${plata(Math.abs(t))}</strong> para esos pagos. Así te queda lo mismo para el día a día en las dos quincenas.` });
    }

    return lista.sort((x, y) => ORDEN_NIVEL[x.nivel] - ORDEN_NIVEL[y.nivel]);
  }

  /* ─────────────────────────────── Metas ──────────────────────────────── */

  function ahorradoEnMeta(meta, sinMov = null) {
    let total = meta.inicial;
    for (const mv of datos.movimientos) {
      if (mv.metaId !== meta.id || mv === sinMov) continue;
      if (mv.tipo === 'ahorro') total += mv.monto;
      else if (mv.tipo === 'retiro') total -= mv.monto;
    }
    return Math.max(0, total);
  }

  // Cuántos días de pago (el 15 y el último de cada mes) hay entre dos fechas.
  function diasDePago(desde, hasta) {
    let n = 0;
    let [a, m] = desde.split('-').map(Number);
    for (let i = 0; i < 600; i++) {
      const clave = mesClave(a, m);
      if (`${clave}-01` > hasta) break;
      for (const dia of [15, diasEnMes(a, m)]) {
        const f = `${clave}-${dos(dia)}`;
        if (f >= desde && f <= hasta) n += 1;
      }
      m += 1;
      if (m > 12) { m = 1; a += 1; }
    }
    return n;
  }

  function nombreMeta(id) {
    const meta = datos.metas.find((x) => x.id === id);
    return meta ? meta.nombre : 'una meta borrada';
  }

  /* ──────────────────────────── Movimientos ───────────────────────────── */

  function nombreMov(m) {
    if (m.tipo === 'ahorro') return `Abono a ${nombreMeta(m.metaId)}`;
    if (m.tipo === 'retiro') return `Sacaste de ${nombreMeta(m.metaId)}`;
    if (m.nota) return m.nota;
    if (m.tipo === 'ingreso') return 'Ingreso extra';
    return CAT[m.categoria]?.nombre || 'Gasto';
  }

  function detalleMov(m) {
    if (m.tipo === 'ahorro' || m.tipo === 'retiro') return 'Ahorro';
    if (m.tipo === 'ingreso') return 'Ingreso extra';
    const cat = CAT[m.categoria]?.nombre || 'Otros';
    if (m.fijoId) return `${cat} · pago fijo`;
    return m.nota ? cat : '';
  }

  function emojiMov(m) {
    if (m.tipo === 'ahorro') return '🐷';
    if (m.tipo === 'retiro') return '↩️';
    if (m.tipo === 'ingreso') return '💰';
    return CAT[m.categoria]?.emoji || '📦';
  }

  function signoMov(m) {
    if (m.tipo === 'gasto') return '−';
    if (m.tipo === 'ingreso' || m.tipo === 'retiro') return '+';
    return '';
  }

  // Más recientes primero; si son del mismo día, el último anotado primero.
  function ordenarMovs(lista) {
    const orden = new Map(datos.movimientos.map((m, i) => [m, i]));
    return lista.slice().sort((x, y) => y.fecha.localeCompare(x.fecha) || orden.get(y) - orden.get(x));
  }

  /* ───────────────────────────── Guardado ─────────────────────────────── */

  function descargarConEnlace(nombre, texto) {
    const tipo = nombre.endsWith('.ics') ? 'text/calendar' : 'application/json';
    const blob = new Blob([texto], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  const almacenLocal = {
    donde: 'este navegador',
    ok: true,
    async iniciar() {
      try {
        const prueba = `${CLAVE_LOCAL}:prueba`;
        localStorage.setItem(prueba, '1');
        localStorage.removeItem(prueba);
        this.ok = true;
      } catch (e) {
        this.ok = false;
      }
      return true;
    },
    async cargar() {
      let texto = null;
      try {
        texto = localStorage.getItem(CLAVE_LOCAL);
      } catch (e) {
        return null;
      }
      if (!texto) return null;
      try {
        return JSON.parse(texto);
      } catch (e) {
        // Guarda el texto dañado aparte, por si se puede recuperar a mano.
        try { localStorage.setItem(`${CLAVE_LOCAL}:danado`, texto); } catch (e2) { /* nada que hacer */ }
        return null;
      }
    },
    async guardar(d) {
      try {
        localStorage.setItem(CLAVE_LOCAL, JSON.stringify(d));
        return true;
      } catch (e) {
        return false;
      }
    },
    async descargar(nombre, texto) {
      return descargarConEnlace(nombre, texto);
    },
  };

  async function elegirAlmacen() {
    const externo = window.CUENTAS_CLARAS_ALMACEN;
    if (externo && typeof externo.iniciar === 'function') {
      try {
        if (await externo.iniciar()) return externo;
      } catch (e) {
        /* si falla, se usa el navegador */
      }
    }
    await almacenLocal.iniciar();
    return almacenLocal;
  }

  let temporizadorGuardar = null;

  function guardar() {
    clearTimeout(temporizadorGuardar);
    temporizadorGuardar = setTimeout(guardarYa, 300);
  }

  async function guardarYa() {
    clearTimeout(temporizadorGuardar);
    temporizadorGuardar = null;
    let ok = false;
    try {
      ok = await almacen.guardar(datos);
    } catch (e) {
      ok = false;
    }
    if (ok === false) {
      $('#aviso-guardado-texto').textContent = almacen === almacenLocal
        ? 'Este navegador no deja guardar tus datos. Antes de cerrar, descarga una copia desde Mi plan.'
        : `No se pudieron guardar tus últimos cambios en ${almacen.donde}. Descarga una copia desde Mi plan para no perderlos.`;
    }
    $('#aviso-guardado').hidden = ok !== false;
  }

  /* ──────────────────────────── Notificaciones ────────────────────────── */

  let temporizadorToast = null;

  function notificar(texto, accion = null) {
    const t = $('#toast');
    clearTimeout(temporizadorToast);
    t.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button type="button" class="toast-accion">${esc(accion.texto)}</button>` : ''}`;
    if (accion) {
      $('.toast-accion', t).addEventListener('click', () => {
        t.hidden = true;
        accion.fn();
      });
    }
    t.hidden = false;
    temporizadorToast = setTimeout(() => { t.hidden = true; }, accion ? 7000 : 3500);
  }

  function confirmar({ titulo, texto, si = 'Sí, borrar', peligro = true }) {
    const d = $('#dlg-confirmar');
    $('#conf-titulo').textContent = titulo;
    $('#conf-texto').textContent = texto;
    const boton = $('#conf-si');
    boton.textContent = si;
    boton.className = `btn ${peligro ? 'btn-peligro' : 'btn-primario'}`;
    d.returnValue = '';
    return new Promise((resolver) => {
      d.addEventListener('close', () => resolver(d.returnValue === 'si'), { once: true });
      d.showModal();
    });
  }

  /* ──────────────────────────── Pedazos de HTML ───────────────────────── */

  function htmlAviso(a) {
    return `<li class="aviso-item" data-nivel="${a.nivel}">
      <span class="aviso-icono" aria-hidden="true">${ICONO_NIVEL[a.nivel]}</span>
      <div class="aviso-cuerpo">
        <span class="aviso-etiqueta">${ETIQUETA_NIVEL[a.nivel]}</span>
        <p class="aviso-texto">${a.texto}</p>
        ${a.boton || ''}
      </div>
    </li>`;
  }

  function htmlMov(m, conFecha = false) {
    const detalle = [detalleMov(m), conFecha ? fechaCorta(m.fecha) : ''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="mov" data-accion="editar-mov" data-id="${esc(m.id)}">
      <span class="ico-redondo" aria-hidden="true">${emojiMov(m)}</span>
      <span class="mov-info">
        <span class="mov-nombre">${esc(nombreMov(m))}</span>
        ${detalle ? `<span class="mov-detalle">${esc(detalle)}</span>` : ''}
      </span>
      <span class="mov-monto" data-tipo="${m.tipo}">${signoMov(m)}${plata(m.monto)}</span>
    </button></li>`;
  }

  function htmlPeriodo() {
    const p = ui.periodo;
    const hoy = hoyISO();
    const momento = momentoDe(rangoDe(p), hoy);
    const atras = puedeIrA(moverPeriodo(p, -1));
    const adelante = puedeIrA(moverPeriodo(p, 1));
    return `
      <div class="periodo">
        <button type="button" class="btn-icono" data-accion="periodo-anterior" aria-label="Ver el periodo anterior" ${atras ? '' : 'disabled'}>${ICONO.izq}</button>
        <div class="periodo-texto">
          <h2 class="periodo-nombre">${capital(nombrePeriodo(p))}</h2>
          <p class="periodo-rango">${textoRango(p)}${momento === 'actual' ? ' <span class="pill pill-acento">Ahora</span>' : ''}</p>
        </div>
        <button type="button" class="btn-icono" data-accion="periodo-siguiente" aria-label="Ver el periodo siguiente" ${adelante ? '' : 'disabled'}>${ICONO.der}</button>
      </div>
      <div class="periodo-opciones">
        <div class="segmento" role="radiogroup" aria-label="Ver por">
          <button type="button" role="radio" aria-checked="${p.tipo === 'q'}" data-accion="modo" data-modo="q">Quincena</button>
          <button type="button" role="radio" aria-checked="${p.tipo === 'm'}" data-accion="modo" data-modo="m">Mes</button>
        </div>
        ${momento === 'actual' ? '' : '<button type="button" class="btn-texto" data-accion="periodo-hoy">Volver a hoy</button>'}
      </div>`;
  }

  function mesMinimo() {
    let min = datos.inicio;
    for (const m of datos.movimientos) {
      const clave = m.fecha.slice(0, 7);
      if (clave < min) min = clave;
    }
    return min;
  }

  function puedeIrA(p) {
    const r = rangoDe(p);
    const maximo = sumarMeses(hoyISO().slice(0, 7), MESES_ADELANTE);
    return r.fin.slice(0, 7) >= mesMinimo() && r.inicio.slice(0, 7) <= maximo;
  }

  /* ────────────────────────────── Resumen ─────────────────────────────── */

  function htmlHero(c) {
    const r = c.rango;
    const unidad = c.p.tipo === 'm' ? 'este mes' : 'esta quincena';
    let eyebrow;
    let cifra;
    let texto;
    let nivel = '';

    if (c.momento === 'futuro') {
      eyebrow = 'Tendrás para el día a día';
      cifra = plata(Math.max(c.libre, 0));
      if (c.libre > 0) {
        texto = `Unos <strong>${plata(Math.floor(c.libre / r.dias))} por día</strong>. Ya están descontados tus pagos fijos y tu ahorro.`;
      } else {
        nivel = 'mal';
        texto = 'Tus pagos fijos y tu ahorro se llevan todo lo que te entra en este periodo. Revisa tu plan.';
      }
    } else if (c.momento === 'pasado') {
      if (c.quedan >= 0) {
        eyebrow = 'Te sobró';
        cifra = plata(c.quedan);
        texto = `Gastaste ${plata(c.variable)} de los ${plata(Math.max(c.libre, 0))} que tenías para el día a día.`;
      } else {
        eyebrow = 'Te pasaste por';
        cifra = plata(-c.quedan);
        nivel = 'mal';
        texto = `Gastaste ${plata(c.variable)} en el día a día y tenías ${plata(Math.max(c.libre, 0))}.`;
      }
    } else if (c.libre <= 0) {
      eyebrow = 'No te alcanza';
      cifra = plata(c.quedan);
      nivel = 'mal';
      texto = `Tus pagos fijos y tu ahorro suman más de lo que te entra ${unidad}. Revisa tu plan o busca un ingreso extra.`;
    } else if (c.quedan >= 0) {
      eyebrow = 'Te quedan para el día a día';
      cifra = plata(c.quedan);
      if (c.diasRestantes > 1) {
        texto = `Puedes gastar <strong>${plata(c.porDia)} por día</strong> durante ${c.diasRestantes} días, hasta el ${fechaLarga(r.fin)}.`;
      } else {
        texto = `Hoy es el último día de ${unidad}.`;
      }
      if (c.quedan === 0) texto = `Ya usaste todo lo del día a día de ${unidad}. Aguanta hasta el próximo pago.`;
    } else {
      eyebrow = 'Te pasaste por';
      cifra = plata(-c.quedan);
      nivel = 'mal';
      texto = `Ya gastaste más de lo que tenías para el día a día ${unidad}. Trata de no gastar más hasta que te paguen.`;
    }

    let medidor = '';
    if (c.libre > 0) {
      const pct = Math.min(100, (c.variable / c.libre) * 100);
      const ritmo = c.momento === 'actual' ? (c.diasPasados / r.dias) * 100 : null;
      let estado = '';
      if (c.variable > c.libre) estado = 'mal';
      else if (pct >= 90 || (ritmo !== null && pct > ritmo + 10)) estado = 'ojo';
      const ideal = Math.round((c.libre * c.diasPasados) / r.dias);
      medidor = `
        <div class="medidor" role="img" aria-label="Gastaste ${plata(c.variable)} de ${plata(c.libre)} (${porcentaje(c.variable, c.libre)}%)">
          <div class="medidor-relleno" style="width:${pct.toFixed(1)}%"${estado ? ` data-nivel="${estado}"` : ''}></div>
          ${ritmo !== null ? `<div class="medidor-ritmo" style="left:${ritmo.toFixed(1)}%"></div>` : ''}
        </div>
        <div class="medidor-pie"><span>Gastado <strong>${plata(c.variable)}</strong></span><span>de <strong>${plata(c.libre)}</strong></span></div>
        ${ritmo !== null ? `<p class="medidor-nota"><i aria-hidden="true"></i>La rayita marca lo ideal a hoy: unos ${plata(ideal)}.</p>` : ''}`;
    }

    return `<section class="hero r-hero" aria-labelledby="hero-t">
      <p class="hero-eyebrow" id="hero-t">${eyebrow}</p>
      <p class="hero-cifra"${nivel ? ` data-nivel="${nivel}"` : ''}>${cifra}</p>
      <p class="hero-texto">${texto}</p>
      ${medidor}
    </section>`;
  }

  function htmlHeroSinPlan() {
    return `<section class="hero r-hero" aria-labelledby="hero-t">
      <p class="hero-eyebrow" id="hero-t">Empieza aquí</p>
      <p class="hero-cifra">Arma tu plan</p>
      <p class="hero-texto">Cuéntanos cuánto ganas y qué pagas cada mes. Con eso te decimos cuánto puedes gastar cada día sin quedarte corto.</p>
      <a class="btn btn-primario" href="#plan">Ir a Mi plan</a>
    </section>`;
  }

  function htmlCuenta(c) {
    const sub = (t) => (t ? `<span class="cuenta-sub">${t}</span>` : '');
    const fila = (op, label, detalle, valor, clase = '') =>
      `<li class="${clase}"><span class="cuenta-op" aria-hidden="true">${op}</span><span class="cuenta-label">${label}${sub(detalle)}</span><span class="cuenta-valor${valor < 0 ? ' neg' : ''}">${plata(valor)}</span></li>`;

    const entra = c.ingresoPlan + c.extras + c.retiros;
    let detalleEntra = c.p.tipo === 'm' ? 'Tu plata del mes' : 'Tu plata de esta quincena';
    const adicionales = [];
    if (c.extras) adicionales.push(`${plata(c.extras)} de ingresos extra`);
    if (c.retiros) adicionales.push(`${plata(c.retiros)} que sacaste de tus metas`);
    if (adicionales.length) detalleEntra = `Incluye ${listaBonita(adicionales)}`;

    const filas = [fila('', 'Te entra', detalleEntra, entra)];
    if (c.traspaso >= 1000) {
      filas.push(fila('+', 'Lo que apartaste antes', 'De la quincena pasada, para los pagos grandes', c.traspaso));
    } else if (c.traspaso <= -1000) {
      filas.push(fila('−', 'Apartar para la próxima', 'Guárdalo para los pagos de la otra quincena', -c.traspaso));
    }
    const pagados = c.ocs.filter((o) => o.pago).length;
    filas.push(fila('−', 'Pagos fijos', c.ocs.length ? `${pagados} de ${c.ocs.length} pagados` : 'Ninguno en este periodo', c.fijos));
    let detalleAhorro = 'No tienes ahorro en tu plan';
    if (c.ahorroPlan > 0 || c.abonos > 0) {
      detalleAhorro = c.abonos >= c.ahorroPlan ? `Ya separaste ${plata(c.abonos)}` : `Has separado ${plata(c.abonos)}`;
    }
    filas.push(fila('−', 'Ahorro', detalleAhorro, c.ahorro));
    filas.push(fila('=', 'Para el día a día', `Llevas gastado ${plata(c.variable)}`, c.libre, 'cuenta-total'));

    return `<section class="tarjeta r-cuenta" aria-labelledby="t-cuenta">
      <div class="tarjeta-cabeza"><h2 id="t-cuenta">La cuenta</h2><span class="cabeza-extra">${c.p.tipo === 'm' ? 'Del mes' : 'De la quincena'}</span></div>
      <ul class="cuenta">${filas.join('')}</ul>
    </section>`;
  }

  function htmlAlertas(c, hoy) {
    const lista = calcularAlertas(c, hoy);
    if (!lista.length) return '';
    return `<section class="tarjeta r-alertas" aria-labelledby="t-alertas">
      <div class="tarjeta-cabeza"><h2 id="t-alertas">${c.momento === 'pasado' ? 'Cómo te fue' : 'Para tener en cuenta'}</h2></div>
      <ul class="avisos-lista">${lista.map(htmlAviso).join('')}</ul>
    </section>`;
  }

  function htmlPagos(c, hoy) {
    const titulo = c.p.tipo === 'm' ? 'Pagos del mes' : 'Pagos de la quincena';
    const cabeza = (extra = '') => `<div class="tarjeta-cabeza"><h2 id="t-pagos">${titulo}</h2>${extra}</div>`;
    if (!datos.fijos.length) {
      return `<section class="tarjeta r-pagos" aria-labelledby="t-pagos">${cabeza()}
        <p class="ayuda">Aún no tienes pagos fijos. <a href="#plan">Agrégalos en Mi plan</a> y aquí verás cuándo vence cada uno.</p></section>`;
    }
    if (!c.ocs.length) {
      return `<section class="tarjeta r-pagos" aria-labelledby="t-pagos">${cabeza()}
        <p class="ayuda">No tienes pagos fijos en este periodo.</p></section>`;
    }

    const pagados = c.ocs.filter((o) => o.pago);
    const items = c.ocs.map((o) => {
      const cat = CAT[o.fijo.categoria] || CAT.otros;
      const nombre = esc(o.fijo.nombre || cat.nombre);
      const botonPagar = `<button type="button" class="btn btn-primario btn-chico" data-accion="pagar" data-fijo="${esc(o.fijo.id)}" data-occ="${o.occ}" aria-label="Ya pagué ${nombre}">Ya pagué</button>`;
      let estado;
      let accion = botonPagar;
      if (o.pago) {
        estado = `<span class="pill pill-bien">${ICONO.check} Pagado</span> el ${fechaCorta(o.pago.fecha)}`;
        accion = `<button type="button" class="btn-texto" data-accion="editar-mov" data-id="${esc(o.pago.id)}" aria-label="Ver el pago de ${nombre}">Ver</button>`;
      } else if (o.estado === 'vencido') {
        estado = `<span class="pill pill-mal">${ICONO.alerta} Venció</span> el ${fechaCorta(o.vence)}`;
      } else if (o.estado === 'hoy') {
        estado = '<span class="pill pill-ojo">Vence hoy</span>';
      } else {
        const faltan = diasEntre(hoy, o.vence);
        estado = `Vence el ${fechaCorta(o.vence)}${faltan <= 3 ? ` <span class="pill pill-ojo">en ${faltan} día${faltan === 1 ? '' : 's'}</span>` : ''}`;
      }
      return `<li class="pago" data-estado="${o.estado}">
        <span class="ico-redondo" aria-hidden="true">${cat.emoji}</span>
        <div class="pago-info"><span class="pago-nombre">${nombre}</span><span class="pago-estado">${estado}</span></div>
        <div class="pago-lado"><span class="pago-monto">${plata(o.monto)}</span>${accion}</div>
      </li>`;
    });
    const totalPagado = pagados.reduce((s, o) => s + o.monto, 0);
    const total = c.ocs.reduce((s, o) => s + o.monto, 0);
    return `<section class="tarjeta r-pagos" aria-labelledby="t-pagos">
      ${cabeza(`<span class="cabeza-extra">${pagados.length} de ${c.ocs.length} pagados</span>`)}
      <ul class="pagos">${items.join('')}</ul>
      <p class="pagos-pie">Pagado ${plata(totalPagado)} de ${plata(total)}. Toca “Ya pagué” cuando pagues: así no se te olvida y no lo cuentas dos veces.</p>
    </section>`;
  }

  function htmlCategorias(c) {
    const titulo = c.momento === 'pasado' ? '¿En qué se te fue la plata?' : '¿En qué se va tu plata?';
    const filas = Object.entries(c.porCategoria).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    if (!filas.length) {
      return `<section class="tarjeta r-cats" aria-labelledby="t-cats">
        <div class="tarjeta-cabeza"><h2 id="t-cats">${titulo}</h2></div>
        <p class="ayuda">Cuando anotes gastos, aquí verás en qué se te va la plata.</p></section>`;
    }
    const total = filas.reduce((s, [, v]) => s + v, 0);
    let mostrar = filas;
    if (filas.length > 7) {
      const resto = filas.slice(6).reduce((s, [, v]) => s + v, 0);
      mostrar = [...filas.slice(0, 6), ['', resto]];
    }
    const maximo = Math.max(...mostrar.map(([, v]) => v));
    const items = mostrar.map(([id, v]) => {
      const cat = id ? CAT[id] || CAT.otros : { nombre: 'Otras categorías', emoji: '➕' };
      const pct = porcentaje(v, total);
      return `<li><button type="button" class="barra-fila" data-accion="ver-categoria" data-cat="${id}" aria-label="${esc(cat.nombre)}: ${plata(v)}, ${pct}% de tus gastos. Ver gastos">
        <span class="barra-nombre"><span aria-hidden="true">${cat.emoji}</span>${esc(cat.nombre)}</span>
        <span class="barra-valor">${plata(v)}<small>${pct}%</small></span>
        <span class="barra-pista" aria-hidden="true"><span class="barra-relleno" style="width:${((v / maximo) * 100).toFixed(1)}%"></span></span>
      </button></li>`;
    });
    return `<section class="tarjeta r-cats" aria-labelledby="t-cats">
      <div class="tarjeta-cabeza"><h2 id="t-cats">${titulo}</h2><span class="cabeza-extra">Total ${plata(total)}</span></div>
      <ul class="barras">${items.join('')}</ul>
    </section>`;
  }

  function htmlUltimos(c) {
    const lista = ordenarMovs(c.movs).slice(0, 5);
    if (!lista.length) {
      return `<section class="tarjeta r-ultimos" aria-labelledby="t-ult">
        <div class="tarjeta-cabeza"><h2 id="t-ult">Últimos movimientos</h2></div>
        <p class="ayuda">Todavía no hay nada anotado en este periodo. Toca <strong>Anotar gasto</strong> cada vez que gastes, aunque sea poquito.</p></section>`;
    }
    return `<section class="tarjeta r-ultimos" aria-labelledby="t-ult">
      <div class="tarjeta-cabeza"><h2 id="t-ult">Últimos movimientos</h2><button type="button" class="btn-texto" data-accion="ver-todos">Ver todos (${c.movs.length})</button></div>
      <ul class="movs">${lista.map((m) => htmlMov(m, true)).join('')}</ul>
    </section>`;
  }

  function htmlConsejo() {
    if (ui.consejo === null) {
      const f = new Date();
      const diaDelAnio = Math.floor((f - new Date(f.getFullYear(), 0, 0)) / 86400000);
      ui.consejo = diaDelAnio % CONSEJOS.length;
    }
    return `<section class="tarjeta consejo r-consejo" aria-labelledby="t-consejo">
      <h2 class="aviso-etiqueta" id="t-consejo">Consejo</h2>
      <p>${esc(CONSEJOS[ui.consejo])}</p>
      <button type="button" class="btn btn-sutil btn-chico" data-accion="otro-consejo">Otro consejo</button>
    </section>`;
  }

  function renderResumen() {
    const hoy = hoyISO();
    const c = calcularPeriodo(ui.periodo, hoy);
    const sinIngresos = !datos.ingresos.some((i) => i.monto > 0);
    $('#resumen-cuerpo').innerHTML = `
      <div class="resumen-grid">
        <div class="resumen-col">
          ${sinIngresos ? htmlHeroSinPlan() : htmlHero(c)}
          ${sinIngresos ? '' : htmlAlertas(c, hoy)}
          ${htmlCategorias(c)}
          ${htmlUltimos(c)}
        </div>
        <div class="resumen-col">
          ${sinIngresos ? '' : htmlCuenta(c)}
          ${htmlPagos(c, hoy)}
          ${htmlConsejo()}
        </div>
      </div>`;
  }

  /* ────────────────────────────── Gastos ──────────────────────────────── */

  function renderGastos() {
    const hoy = hoyISO();
    const c = calcularPeriodo(ui.periodo, hoy);

    for (const b of $$('[data-accion="filtro-tipo"]')) b.setAttribute('aria-checked', String(b.dataset.tipo === ui.filtroTipo));
    const select = $('#filtro-cat');
    if (!select.options.length) {
      select.innerHTML = '<option value="">Todas las categorías</option>' +
        CATEGORIAS.map((cat) => `<option value="${cat.id}">${cat.emoji} ${esc(cat.nombre)}</option>`).join('');
    }
    select.value = ui.filtroCat;
    select.hidden = ui.filtroTipo === 'ingreso' || ui.filtroTipo === 'ahorro';

    let lista = c.movs;
    if (ui.filtroTipo === 'gasto') lista = lista.filter((m) => m.tipo === 'gasto');
    else if (ui.filtroTipo === 'ingreso') lista = lista.filter((m) => m.tipo === 'ingreso');
    else if (ui.filtroTipo === 'ahorro') lista = lista.filter((m) => m.tipo === 'ahorro' || m.tipo === 'retiro');
    if (ui.filtroCat && !select.hidden) lista = lista.filter((m) => m.tipo === 'gasto' && m.categoria === ui.filtroCat);
    lista = ordenarMovs(lista);

    let cuerpo;
    if (!c.movs.length) {
      cuerpo = `<div class="vacio"><h2>Nada anotado todavía</h2>
        <p>Anota cada gasto apenas lo hagas, aunque sea un tinto. Al final del mes vas a saber en qué se te va la plata.</p>
        <div class="vacio-botones"><button type="button" class="btn btn-primario" data-accion="anotar">Anotar gasto</button></div></div>`;
    } else if (!lista.length) {
      cuerpo = `<div class="vacio"><h2>No hay movimientos con ese filtro</h2>
        <div class="vacio-botones"><button type="button" class="btn btn-sutil" data-accion="limpiar-filtro">Ver todo</button></div></div>`;
    } else {
      const ayer = aISO(new Date(Date.now() - 86400000));
      const grupos = new Map();
      for (const m of lista) {
        if (!grupos.has(m.fecha)) grupos.set(m.fecha, []);
        grupos.get(m.fecha).push(m);
      }
      cuerpo = Array.from(grupos, ([fecha, movs]) => {
        let titulo = capital(fechaLarga(fecha));
        if (fecha === hoy) titulo = `Hoy · ${fechaLarga(fecha)}`;
        else if (fecha === ayer) titulo = `Ayer · ${fechaLarga(fecha)}`;
        const gastoDia = movs.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
        return `<section class="dia" aria-label="${esc(titulo)}">
          <h3 class="dia-titulo"><span>${esc(titulo)}</span>${gastoDia ? `<span>−${plata(gastoDia)}</span>` : ''}</h3>
          <ul class="movs">${movs.map((m) => htmlMov(m)).join('')}</ul>
        </section>`;
      }).join('');
    }
    $('#gastos-cuerpo').innerHTML = cuerpo;

    const gastado = c.variable + c.fijosPagados;
    $('#gastos-aside').innerHTML = `
      <section class="tarjeta mini" aria-label="Totales del periodo">
        <dl>
          <div><dt>Gastaste</dt><dd>${plata(gastado)}</dd></div>
          <div><dt>Ingresos extra</dt><dd>${plata(c.extras)}</dd></div>
          <div><dt>A tus metas</dt><dd>${plata(c.abonos - c.retiros)}</dd></div>
        </dl>
        <p class="ayuda">Del día a día llevas ${plata(c.variable)} de ${plata(Math.max(c.libre, 0))}. El resto son pagos fijos.</p>
      </section>
      ${htmlCategorias(c)}
      ${htmlMesAMes()}`;
  }

  /* ────────────────────────────── Mi plan ─────────────────────────────── */

  function opciones(mapa, actual) {
    return Object.entries(mapa).map(([valor, x]) => `<option value="${valor}"${valor === actual ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('');
  }

  function notaIngreso(i) {
    if (!i.monto) return 'Escribe lo que recibes cada vez que te pagan.';
    if (i.frecuencia === 'mensual') return '';
    const mes = i.monto * FREC_INGRESO[i.frecuencia].porMes;
    return i.frecuencia === 'semanal' ? `Son unos ${plata(mes)} al mes (52 semanas entre 12 meses).` : `Son ${plata(mes)} al mes.`;
  }

  function notaFijo(f) {
    if (f.frecuencia === 'quincenal') {
      const d1 = ((f.dia - 1) % 15) + 1;
      return `Se paga en las dos quincenas: los días ${d1} y ${d1 + 15}.`;
    }
    const extra = f.dia > 28 ? ' o el último día del mes, si el mes es más corto' : '';
    return `Se paga en la ${f.dia <= 15 ? '1ª' : '2ª'} quincena: el día ${f.dia}${extra}.`;
  }

  function htmlFilaIngreso(i) {
    const id = esc(i.id);
    return `<div class="fila fila-ingreso" data-lista="ingresos" data-id="${id}">
      <div class="campo campo-nombre">
        <label for="ing-n-${id}">¿De dónde sale?</label>
        <input type="text" id="ing-n-${id}" data-campo="nombre" value="${esc(i.nombre)}" maxlength="40" placeholder="Ej: Sueldo">
      </div>
      <div class="campo">
        <label for="ing-m-${id}">¿Cuánto recibes cada vez?</label>
        <div class="campo-plata"><span aria-hidden="true">$</span><input type="text" id="ing-m-${id}" data-campo="monto" data-monto inputmode="numeric" autocomplete="off" value="${i.monto ? miles(i.monto) : ''}" placeholder="0"></div>
      </div>
      <div class="campo">
        <label for="ing-f-${id}">¿Cada cuánto?</label>
        <select id="ing-f-${id}" data-campo="frecuencia">${opciones(FREC_INGRESO, i.frecuencia)}</select>
      </div>
      <button type="button" class="btn-icono btn-icono-chico btn-quitar" data-accion="quitar-ingreso" data-id="${id}" aria-label="Quitar ${esc(i.nombre || 'este ingreso')}">${ICONO.basura}</button>
      <p class="fila-nota" data-nota${notaIngreso(i) ? '' : ' hidden'}>${esc(notaIngreso(i))}</p>
    </div>`;
  }

  function resumenFijo(f) {
    if (f.frecuencia === 'quincenal') {
      const d1 = ((f.dia - 1) % 15) + 1;
      return `Quincenal · días ${d1} y ${d1 + 15}`;
    }
    return `Mensual · día ${f.dia} · ${f.dia <= 15 ? '1ª' : '2ª'} quincena`;
  }

  // Cada pago fijo se ve como una fila corta; al tocarla se abre para editar.
  function htmlFilaFijo(f) {
    const id = esc(f.id);
    const cat = CAT[f.categoria] || CAT.otros;
    const cats = CATEGORIAS.map((c) => `<option value="${c.id}"${c.id === f.categoria ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('');
    return `<details class="fijo" data-lista="fijos" data-id="${id}"${ui.fijosAbiertos.has(f.id) ? ' open' : ''}>
      <summary class="fijo-resumen">
        <span class="ico-redondo" aria-hidden="true" data-r-emoji>${cat.emoji}</span>
        <span class="fijo-info">
          <span class="fijo-nombre" data-r-nombre>${esc(f.nombre || 'Pago sin nombre')}</span>
          <span class="fijo-detalle" data-r-detalle>${esc(resumenFijo(f))}</span>
        </span>
        <span class="fijo-monto" data-r-monto>${f.monto ? plata(f.monto) : 'Sin valor'}</span>
        <svg class="fijo-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="fila fila-fijo">
      <div class="campo campo-nombre">
        <label for="fij-n-${id}">¿Qué pagas?</label>
        <input type="text" id="fij-n-${id}" data-campo="nombre" value="${esc(f.nombre)}" maxlength="40" placeholder="Ej: Arriendo">
      </div>
      <div class="campo campo-monto">
        <label for="fij-m-${id}">¿Cuánto?</label>
        <div class="campo-plata"><span aria-hidden="true">$</span><input type="text" id="fij-m-${id}" data-campo="monto" data-monto inputmode="numeric" autocomplete="off" value="${f.monto ? miles(f.monto) : ''}" placeholder="0"></div>
      </div>
      <div class="campo campo-cat">
        <label for="fij-c-${id}">Categoría</label>
        <select id="fij-c-${id}" data-campo="categoria">${cats}</select>
      </div>
      <div class="campo campo-frec">
        <label for="fij-f-${id}">¿Cada cuánto?</label>
        <select id="fij-f-${id}" data-campo="frecuencia">${opciones(FREC_FIJO, f.frecuencia)}</select>
      </div>
      <div class="campo campo-dia">
        <label for="fij-d-${id}">Día de pago</label>
        <input type="number" id="fij-d-${id}" data-campo="dia" min="1" max="31" step="1" inputmode="numeric" value="${f.dia}">
      </div>
      <p class="fila-nota" data-nota>${esc(notaFijo(f))}</p>
      <div class="fila-acciones">
        <button type="button" class="btn btn-peligro-texto btn-chico" data-accion="quitar-fijo" data-id="${id}">${ICONO.basura}Quitar este pago</button>
      </div>
      </div>
    </details>`;
  }

  function actualizarResumenFijo(caja, f) {
    if (!caja.matches('details.fijo')) return;
    $('[data-r-emoji]', caja).textContent = (CAT[f.categoria] || CAT.otros).emoji;
    $('[data-r-nombre]', caja).textContent = f.nombre || 'Pago sin nombre';
    $('[data-r-detalle]', caja).textContent = resumenFijo(f);
    $('[data-r-monto]', caja).textContent = f.monto ? plata(f.monto) : 'Sin valor';
  }

  function renderSugerenciasFijos() {
    const usados = new Set(datos.fijos.map((f) => f.nombre.trim().toLowerCase()));
    $('#sugerencias-fijos').innerHTML = SUGERENCIAS_FIJOS
      .filter((s) => !usados.has(s.nombre.toLowerCase()))
      .map((s) => `<button type="button" class="chip" data-accion="sugerir-fijo" data-nombre="${esc(s.nombre)}">${ICONO.mas}${esc(s.nombre)}</button>`)
      .join('');
  }

  function renderPlanListas() {
    $('#lista-ingresos').innerHTML = datos.ingresos.map(htmlFilaIngreso).join('');
    $('#lista-fijos').innerHTML = datos.fijos.map(htmlFilaFijo).join('');
    renderSugerenciasFijos();
    $('#lista-topes').innerHTML = datos.topes.map(htmlFilaTope).join('');
    const conTope = new Set(datos.topes.map((t) => t.categoria));
    $('#sugerencias-topes').innerHTML = ['comida', 'hormiga', 'salidas', 'ropa']
      .filter((id) => !conTope.has(id))
      .map((id) => `<button type="button" class="chip" data-accion="sugerir-tope" data-cat="${id}">${ICONO.mas}${esc(CAT[id].nombre)}</button>`)
      .join('');
    $('#btn-calendario').hidden = Boolean(window.CUENTAS_CLARAS_ALMACEN);
    $('#ahorro-pct').value = String(datos.ahorroPct);
    if (document.activeElement !== $('#nombre')) $('#nombre').value = datos.nombre;
  }

  function htmlReparto() {
    const ingreso = ingresoMensual();
    const fijos = fijosMensual();
    const ahorro = ahorroMensual();
    const libre = ingreso - fijos - ahorro;
    if (!ingreso) return '<p class="ayuda">Escribe cuánto ganas en el paso 1 y aquí verás cómo se reparte.</p>';

    const base = Math.max(ingreso, fijos + ahorro);
    const partes = [
      { clase: 'parte-fijos', nombre: 'Pagos fijos', valor: fijos },
      { clase: 'parte-ahorro', nombre: 'Ahorro', valor: ahorro },
      { clase: 'parte-libre', nombre: 'Día a día', valor: Math.max(libre, 0) },
    ];
    const barra = partes.filter((p) => p.valor > 0).map((p) => {
      const pct = porcentaje(p.valor, ingreso);
      const etiqueta = p.valor / base >= 0.15 ? `${pct}%` : '';
      return `<div class="reparto-parte ${p.clase}" style="flex:${p.valor} 1 0" title="${p.nombre}: ${plata(p.valor)} (${pct}% de lo que ganas)">${etiqueta}</div>`;
    }).join('');
    const descripcion = partes.map((p) => `${p.nombre}: ${porcentaje(p.valor, ingreso)}%`).join(', ');

    const f1 = fijosPlanQuincena(1);
    const f2 = fijosPlanQuincena(2);
    const t = apartadoParaQ1();
    const iq = ingreso / 2;
    const aq = ahorro / 2;
    const l1 = iq + t - f1 - aq;
    const l2 = iq - t - f2 - aq;
    const [a, m] = hoyISO().split('-').map(Number);
    const ultimo = diasEnMes(a, m);
    // Solo el "día a día" se pinta de rojo cuando no alcanza.
    const celda = (v, { signo = false, alerta = false } = {}) =>
      `<td${alerta && v < 0 ? ' class="neg"' : ''}>${signo && v > 0 ? '+' : ''}${plata(v)}</td>`;
    const filaApartado = Math.abs(t) >= 1000
      ? `<tr><td>Apartado entre quincenas</td>${celda(t, { signo: true })}${celda(-t, { signo: true })}<td>—</td></tr>`
      : '';
    const alerta = { alerta: true };

    return `
      <div class="reparto-barra" role="img" aria-label="Cómo se reparte lo que ganas. ${descripcion}">${barra}</div>
      <ul class="leyenda">${partes.map((p) => `<li><i class="${p.clase}" aria-hidden="true"></i>${p.nombre}</li>`).join('')}</ul>
      ${libre < 0 ? `<p class="error">Te faltan ${plata(-libre)} al mes para cubrir tus pagos fijos y tu ahorro.</p>` : ''}
      <div class="tabla-scroll">
        <table class="tabla-plan">
          <thead><tr><th scope="col"><span class="sr-only">Concepto</span></th><th scope="col">1ª quincena</th><th scope="col">2ª quincena</th><th scope="col">Mes</th></tr></thead>
          <tbody>
            <tr><td>Te entra</td>${celda(iq)}${celda(iq)}${celda(ingreso)}</tr>
            <tr><td>Pagos fijos</td>${celda(-f1)}${celda(-f2)}${celda(-fijos)}</tr>
            <tr><td>Ahorro</td>${celda(-aq)}${celda(-aq)}${celda(-ahorro)}</tr>
            ${filaApartado}
            <tr class="fila-total"><td>Día a día</td>${celda(l1, alerta)}${celda(l2, alerta)}${celda(libre, alerta)}</tr>
            <tr class="fila-dia"><td>Por día</td>${celda(l1 / 15, alerta)}${celda(l2 / (ultimo - 15), alerta)}${celda(libre / ultimo, alerta)}</tr>
          </tbody>
        </table>
      </div>`;
  }

  function renderPlanResultado() {
    const ingreso = ingresoMensual();
    const fijos = fijosMensual();
    const ahorro = ahorroMensual();
    $('#total-ingresos').innerHTML = ingreso ? `Total al mes: <strong>${plata(ingreso)}</strong>` : '';
    $('#total-fijos').innerHTML = fijos ? `Total al mes: <strong>${plata(fijos)}</strong>` : '';
    $('#ahorro-valor').textContent = `${datos.ahorroPct}%`;
    $('#ahorro-salida').innerHTML = ingreso
      ? `<strong>${plata(ahorro)}</strong> al mes · ${plata(ahorro / 2)} por quincena`
      : 'Primero escribe cuánto ganas.';
    $('#reparto').innerHTML = htmlReparto();
    $('#diagnostico').innerHTML = calcularDiagnostico().map(htmlAviso).join('');

    for (const fila of $$('#lista-ingresos .fila')) {
      const i = datos.ingresos.find((x) => x.id === fila.dataset.id);
      if (i) {
        const nota = $('[data-nota]', fila);
        nota.textContent = notaIngreso(i);
        nota.hidden = !nota.textContent;
      }
    }
    for (const fila of $$('#lista-topes [data-lista]')) {
      const tope = datos.topes.find((x) => x.id === fila.dataset.id);
      if (tope) $('[data-nota]', fila).textContent = notaTope(tope);
    }
    for (const caja of $$('#lista-fijos [data-lista]')) {
      const f = datos.fijos.find((x) => x.id === caja.dataset.id);
      if (f) {
        $('[data-nota]', caja).textContent = notaFijo(f);
        actualizarResumenFijo(caja, f);
      }
    }
    $('#datos-donde').textContent = almacen.donde === 'este navegador'
      ? 'Se guardan solo en este navegador. Si borras el historial o cambias de celular, se pierden: descarga una copia de vez en cuando.'
      : `Se guardan en ${almacen.donde}. También puedes descargar una copia.`;
  }

  function renderPlan() {
    renderPlanListas();
    renderPlanResultado();
  }

  /* ─────────────────────────────── Metas ──────────────────────────────── */

  function htmlMeta(meta, hoy) {
    const id = esc(meta.id);
    const ahorrado = ahorradoEnMeta(meta);
    const objetivo = meta.objetivo;
    const pct = objetivo ? Math.min(100, (ahorrado / objetivo) * 100) : 0;
    const lograda = objetivo > 0 && ahorrado >= objetivo;
    const falta = Math.max(0, objetivo - ahorrado);
    const notas = [];
    if (lograda) {
      notas.push(`<span class="pill pill-bien">${ICONO.check} ¡Lo lograste!</span>`);
    } else if (objetivo) {
      notas.push(`Vas en el ${Math.floor(pct)}%. Te faltan ${plata(falta)}.`);
      if (meta.fecha && meta.fecha < hoy) {
        notas.push(`<span class="pill pill-ojo">${ICONO.alerta} La fecha (${fechaCorta(meta.fecha)}) ya pasó</span>`);
      } else if (meta.fecha) {
        const pagos = Math.max(1, diasDePago(hoy, meta.fecha));
        const cuota = Math.ceil(falta / pagos / 1000) * 1000;
        notas.push(pagos === 1
          ? `Para llegar el ${fechaCorta(meta.fecha)} abona <strong>${plata(cuota)}</strong> en tu próximo pago.`
          : `Para llegar el ${fechaCorta(meta.fecha)} abona unos <strong>${plata(cuota)}</strong> cada quincena (${pagos} pagos).`);
      }
    }
    return `<article class="tarjeta meta"${lograda ? ' data-lista' : ''} aria-labelledby="meta-t-${id}">
      <div class="meta-cabeza">
        <h2 id="meta-t-${id}">${esc(meta.nombre)}</h2>
        <button type="button" class="btn-icono btn-icono-chico" data-accion="editar-meta" data-id="${id}" aria-label="Editar ${esc(meta.nombre)}">${ICONO.lapiz}</button>
      </div>
      <p class="meta-cifras"><strong>${plata(ahorrado)}</strong>${objetivo ? `de ${plata(objetivo)}` : 'ahorrados'}</p>
      ${objetivo ? `<div class="meta-barra" role="progressbar" aria-label="Avance de ${esc(meta.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(pct)}"><span style="width:${pct.toFixed(1)}%"></span></div>` : ''}
      ${notas.map((n) => `<p class="meta-nota">${n}</p>`).join('')}
      <div class="meta-botones">
        <button type="button" class="btn btn-primario btn-chico" data-accion="abonar" data-id="${id}">Abonar</button>
        ${ahorrado > 0 ? `<button type="button" class="btn btn-sutil btn-chico" data-accion="sacar" data-id="${id}">Sacar</button>` : ''}
      </div>
    </article>`;
  }

  function renderMetas() {
    const hoy = hoyISO();
    let html = '';
    const total = datos.metas.reduce((s, m) => s + ahorradoEnMeta(m), 0);
    if (datos.metas.length) html += `<p class="metas-total">Tienes ahorrado <strong>${plata(total)}</strong> en total.</p>`;

    const fijos = fijosMensual();
    if (fijos > 0 && !datos.metas.some((m) => /emergencia/i.test(m.nombre))) {
      const sugerido = Math.ceil((fijos * 3) / 100000) * 100000;
      html += `<section class="tarjeta sugerida" aria-labelledby="t-sugerida">
        <h2 id="t-sugerida">Te recomendamos un fondo de emergencia</h2>
        <p>Es plata guardada solo para imprevistos: una enfermedad, quedarte sin trabajo, un daño en la casa. Lo ideal son 3 meses de tus pagos fijos: <strong>${plata(sugerido)}</strong>. Puedes empezar con menos.</p>
        <button type="button" class="btn btn-primario btn-chico" data-accion="crear-emergencia" data-monto="${sugerido}">Crear esta meta</button>
      </section>`;
    }

    if (!datos.metas.length) {
      html += `<div class="vacio"><h2>Aún no tienes metas</h2>
        <p>Una meta con nombre y fecha, como “Regalos de diciembre”, es más fácil de cumplir que solo “ahorrar”.</p>
        <div class="vacio-botones"><button type="button" class="btn btn-primario" data-accion="nueva-meta">Crear mi primera meta</button></div></div>`;
    } else {
      html += `<div class="metas-grid">${datos.metas.map((m) => htmlMeta(m, hoy)).join('')}</div>`;
    }
    $('#metas-cuerpo').innerHTML = html;
  }

  /* ───────────────────────────── Topes ────────────────────────────────── */

  // Lo gastado en un mes (pagos fijos incluidos), en total y por categoría.
  // hasta: fecha "AAAA-MM-DD"; solo cuenta lo anotado hasta ese día.
  function gastoDelMes(a, m, hasta = null) {
    const p = { tipo: 'm', a, m };
    let total = 0;
    const porCat = {};
    for (const mv of datos.movimientos) {
      if (mv.tipo !== 'gasto' || !movEnPeriodo(mv, p)) continue;
      if (hasta && mv.fecha > hasta) continue;
      total += mv.monto;
      porCat[mv.categoria] = (porCat[mv.categoria] || 0) + mv.monto;
    }
    return { total, porCat };
  }

  function notaTope(tope) {
    if (!tope.monto) return 'Escribe el máximo que quieres gastar al mes.';
    const [a, m] = hoyISO().split('-').map(Number);
    const usado = gastoDelMes(a, m).porCat[tope.categoria] || 0;
    return `Este mes llevas ${plata(usado)} de ${plata(tope.monto)} (${porcentaje(usado, tope.monto)}%).`;
  }

  function htmlFilaTope(t) {
    const id = esc(t.id);
    const cats = CATEGORIAS.map((c) => `<option value="${c.id}"${c.id === t.categoria ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('');
    return `<div class="fila fila-tope" data-lista="topes" data-id="${id}">
      <div class="campo campo-nombre">
        <label for="tope-c-${id}">Categoría</label>
        <select id="tope-c-${id}" data-campo="categoria">${cats}</select>
      </div>
      <div class="campo">
        <label for="tope-m-${id}">Máximo al mes</label>
        <div class="campo-plata"><span aria-hidden="true">$</span><input type="text" id="tope-m-${id}" data-campo="monto" data-monto inputmode="numeric" autocomplete="off" value="${t.monto ? miles(t.monto) : ''}" placeholder="0"></div>
      </div>
      <button type="button" class="btn-icono btn-icono-chico btn-quitar" data-accion="quitar-tope" data-id="${id}" aria-label="Quitar el tope de ${esc(CAT[t.categoria].nombre)}">${ICONO.basura}</button>
      <p class="fila-nota" data-nota>${esc(notaTope(t))}</p>
    </div>`;
  }

  function agregarTope(categoria) {
    const usadas = new Set(datos.topes.map((t) => t.categoria));
    const cat = categoria || (CATEGORIAS.find((c) => !usadas.has(c.id)) || CATEGORIAS[0]).id;
    const tope = { id: nuevoId(), categoria: cat, monto: 0 };
    datos.topes.push(tope);
    guardar();
    renderPlan();
    $(`#tope-m-${tope.id}`).focus();
  }

  /* ─────────────────────────── Mes a mes ──────────────────────────────── */

  // 1250000 → "$1,3 M"; 350000 → "$350 mil" (para etiquetas cortas)
  function plataCorta(n) {
    const v = Math.round(n);
    if (v >= 1000000) return `$${(v / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
    if (v >= 1000) return `$${Math.round(v / 1000)} mil`;
    return plata(v);
  }

  function htmlMesAMes() {
    const p = ui.periodo;
    const hoy = hoyISO();
    const minimo = mesMinimo();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const clave = sumarMeses(mesClave(p.a, p.m), -i);
      if (clave < minimo) continue;
      const [a, m] = clave.split('-').map(Number);
      meses.push({ clave, a, m, ...gastoDelMes(a, m) });
    }
    while (meses.length && !meses[0].total) meses.shift(); // sin meses vacíos al comienzo
    const titulo = '<div class="tarjeta-cabeza"><h2 id="t-mes">Mes a mes</h2><span class="cabeza-extra">Todo lo que gastaste</span></div>';
    if (meses.length < 2) {
      return `<section class="tarjeta r-mes" aria-labelledby="t-mes">${titulo}
        <p class="ayuda">Cuando tengas más de un mes anotado, aquí vas a ver cómo te va comparado con los meses anteriores.</p></section>`;
    }
    const maximo = Math.max(...meses.map((x) => x.total), 1);
    const actual = mesClave(p.a, p.m);
    const columnas = meses.map((x) => `
      <div class="columna"${x.clave === actual ? ' data-actual' : ''} title="${capital(MESES[x.m - 1])} ${x.a}: ${plata(x.total)}">
        <span class="columna-valor">${x.total ? plataCorta(x.total) : '—'}</span>
        <span class="columna-barra" style="height:${Math.round((x.total / maximo) * 110)}px"></span>
      </div>`).join('');
    const etiquetas = meses.map((x) => `<span>${capital(MESES_CORTOS[x.m - 1])}</span>`).join('');
    const tabla = meses.map((x) => `<tr><th scope="row">${capital(MESES[x.m - 1])} ${x.a}</th><td>${plata(x.total)}</td></tr>`).join('');

    // Comparación con el mes anterior (a la misma fecha, si es el mes de hoy)
    const anterior = sumarMeses(actual, -1);
    let comparacion = '';
    if (anterior >= minimo) {
      const [aa, ma] = anterior.split('-').map(Number);
      const esHoy = actual === hoy.slice(0, 7);
      const dia = Math.min(Number(hoy.slice(8)), diasEnMes(aa, ma));
      const ahora = esHoy ? gastoDelMes(p.a, p.m, hoy) : gastoDelMes(p.a, p.m);
      const antes = esHoy ? gastoDelMes(aa, ma, `${anterior}-${dos(dia)}`) : gastoDelMes(aa, ma);
      const diferencia = ahora.total - antes.total;
      const pct = porcentaje(Math.abs(diferencia), antes.total);
      const pastilla = !antes.total || Math.abs(diferencia) < 1000 ? ''
        : diferencia > 0 ? `<span class="pill pill-ojo">▲ ${pct}% más</span>` : `<span class="pill pill-bien">▼ ${pct}% menos</span>`;
      const frase = esHoy
        ? `Este mes llevas <strong>${plata(ahora.total)}</strong>. A esta fecha del mes pasado llevabas ${plata(antes.total)}.`
        : `En ${MESES[p.m - 1]} gastaste <strong>${plata(ahora.total)}</strong> y en ${MESES[ma - 1]}, ${plata(antes.total)}.`;
      const cambios = CATEGORIAS
        .map((cat) => ({ cat, d: (ahora.porCat[cat.id] || 0) - (antes.porCat[cat.id] || 0) }))
        .filter((x) => Math.abs(x.d) >= 5000)
        .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
        .slice(0, 3)
        .map((x) => `<li><span aria-hidden="true">${x.cat.emoji}</span> ${esc(x.cat.nombre)}: <strong>${x.d > 0 ? '+' : '−'}${plata(Math.abs(x.d))}</strong> ${x.d > 0 ? 'más' : 'menos'}</li>`)
        .join('');
      comparacion = `<p class="comparacion">${frase} ${pastilla}</p>${cambios ? `<ul class="cambios">${cambios}</ul>` : ''}`;
    }

    return `<section class="tarjeta r-mes" aria-labelledby="t-mes">${titulo}
      <div class="columnas" role="img" aria-label="Gasto por mes: ${meses.map((x) => `${MESES[x.m - 1]} ${plata(x.total)}`).join(', ')}">${columnas}</div>
      <div class="columnas-meses" aria-hidden="true">${etiquetas}</div>
      <table class="sr-only"><caption>Gasto por mes</caption><tbody>${tabla}</tbody></table>
      ${comparacion}
    </section>`;
  }

  /* ─────────────────────── Aviso de pagos arriba ──────────────────────── */

  function renderAvisoPagos() {
    const hoy = hoyISO();
    const ocs = ocurrencias(periodoDe(hoy, 'm'), hoy);
    const nombres = (lista) => listaBonita(lista.map((o) => `<strong>${esc(o.fijo.nombre || 'un pago')}</strong> (${plata(o.monto)})`));
    const partes = [];
    const vencidos = ocs.filter((o) => o.estado === 'vencido');
    const deHoy = ocs.filter((o) => o.estado === 'hoy');
    const manana = ocs.filter((o) => o.estado === 'pendiente' && diasEntre(hoy, o.vence) === 1);
    if (deHoy.length) partes.push(`Hoy vence ${nombres(deHoy)}.`);
    if (manana.length) partes.push(`Mañana vence ${nombres(manana)}.`);
    if (vencidos.length) partes.push(vencidos.length === 1 ? `Se pasó la fecha de ${nombres(vencidos)}.` : `Tienes ${vencidos.length} pagos con la fecha vencida.`);
    $('#aviso-pagos-texto').innerHTML = partes.join(' ');
    $('#aviso-pagos').hidden = !partes.length || ui.vista === 'resumen';
  }

  /* ───────────────────── Recordatorios de calendario ──────────────────── */

  // Arma un archivo .ics con un evento que se repite cada mes por cada pago
  // fijo, con aviso el día anterior. El celular lo agrega a su calendario.
  function crearCalendario() {
    const hoy = hoyISO();
    const [a, m, d] = hoy.split('-').map(Number);
    const escICS = (t) => String(t).replace(/\\/g, '\\\\').replace(/[,;]/g, (x) => `\\${x}`).replace(/\n/g, '\\n');
    const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agente de Dinero//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Pagos (Agente de Dinero)'];
    for (const f of datos.fijos.filter((x) => x.monto > 0)) {
      const base = ((f.dia - 1) % 15) + 1;
      const dias = f.frecuencia === 'quincenal' ? [base, base + 15] : [f.dia];
      dias.forEach((dia, i) => {
        let aa = a;
        let mm = m;
        if (Math.min(dia, diasEnMes(aa, mm)) < d) {
          mm += 1;
          if (mm > 12) { mm = 1; aa += 1; }
        }
        const inicio = new Date(aa, mm - 1, Math.min(dia, diasEnMes(aa, mm)));
        const fin = new Date(inicio);
        fin.setDate(fin.getDate() + 1);
        const fecha = (x) => aISO(x).replace(/-/g, '');
        lineas.push(
          'BEGIN:VEVENT',
          `UID:${f.id}-${i}@agente-de-dinero`,
          `DTSTAMP:${sello}`,
          `DTSTART;VALUE=DATE:${fecha(inicio)}`,
          `DTEND;VALUE=DATE:${fecha(fin)}`,
          `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dia > 28 ? -1 : dia}`,
          `SUMMARY:${escICS(`Pagar ${f.nombre || 'pago fijo'} (${plata(f.monto)})`)}`,
          `DESCRIPTION:${escICS(`Cuando pagues, toca “Ya pagué” en Agente de Dinero.${dia > 28 ? ' En los meses cortos el aviso cae el último día.' : ''}`)}`,
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escICS(`Mañana vence ${f.nombre || 'un pago'}`)}`,
          'TRIGGER:-PT15H',
          'END:VALARM',
          'END:VEVENT'
        );
      });
    }
    lineas.push('END:VCALENDAR');
    return lineas.join('\r\n');
  }

  async function descargarCalendario() {
    if (!datos.fijos.some((f) => f.monto > 0)) {
      notificar('Primero agrega tus pagos fijos en el paso 2.');
      return;
    }
    let ok = false;
    try {
      ok = await descargarConEnlace('agente-de-dinero-pagos.ics', crearCalendario());
    } catch (e) {
      ok = false;
    }
    notificar(ok ? 'Ábrelo en el celular para agregar los avisos a tu calendario' : 'No se pudo descargar el archivo.');
  }

  /* ───────────────────────────── Deudas ───────────────────────────────── */

  function tasaMensual(dd) {
    return dd.tasaEA > 0 ? Math.pow(1 + dd.tasaEA / 100, 1 / 12) - 1 : 0;
  }

  function fijoDeDeuda(dd) {
    return dd.fijoId ? datos.fijos.find((f) => f.id === dd.fijoId) || null : null;
  }

  function cuotaDeDeuda(dd) {
    const f = fijoDeDeuda(dd);
    return f ? f.monto * (f.frecuencia === 'quincenal' ? 2 : 1) : dd.cuota;
  }

  // Un pago baja la deuda si es un abono a ella o el pago fijo de su cuota,
  // hecho después de la última vez que se escribió el saldo.
  function pagoDeDeuda(mv, dd) {
    if (mv.tipo !== 'gasto') return false;
    if (mv.deudaId !== dd.id && !(dd.fijoId && mv.fijoId === dd.fijoId)) return false;
    if (mv.ts && dd.base.ts) return mv.ts > dd.base.ts;
    return mv.fecha > dd.base.fecha;
  }

  // Aproximado: cada pago se resta completo; con el extracto se corrige.
  function saldoDeDeuda(dd) {
    const pagado = datos.movimientos.reduce((s, mv) => s + (pagoDeDeuda(mv, dd) ? mv.monto : 0), 0);
    return Math.max(0, dd.saldo - pagado);
  }

  // Cuántos meses faltan pagando "cuota" al mes con interés mensual r.
  function proyectar(saldo, r, cuota) {
    if (saldo <= 0) return { meses: 0, intereses: 0 };
    if (cuota <= 0) return null;
    if (r === 0) return { meses: Math.ceil(saldo / cuota), intereses: 0 };
    if (cuota <= saldo * r) return { nunca: true };
    const meses = Math.ceil(-Math.log(1 - (r * saldo) / cuota) / Math.log(1 + r));
    return { meses, intereses: Math.max(0, Math.round(meses * cuota - saldo)) };
  }

  function tiempoTexto(n) {
    if (n < 12) return `${n} ${n === 1 ? 'mes' : 'meses'}`;
    const anios = Math.floor(n / 12);
    const resto = n % 12;
    return `${anios} ${anios === 1 ? 'año' : 'años'}${resto ? ` y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : ''}`;
  }

  function mesDentroDe(n) {
    const [a, m] = sumarMeses(hoyISO().slice(0, 7), n).split('-').map(Number);
    return `${MESES[m - 1]} de ${a}`;
  }

  function htmlDeuda(x) {
    const { dd, saldo, cuota, r } = x;
    const id = esc(dd.id);
    const pagada = saldo <= 0;
    const avance = dd.inicial ? Math.min(100, ((dd.inicial - saldo) / dd.inicial) * 100) : 0;
    const fijo = fijoDeDeuda(dd);
    const notas = [];
    if (pagada) {
      notas.push(`<span class="pill pill-bien">${ICONO.check} ¡Pagada!</span>`);
    } else {
      notas.push(cuota ? `Cuota: ${plata(cuota)} al mes${fijo ? ` (es tu pago fijo “${esc(fijo.nombre)}”)` : ''}.` : 'Escribe cuánto pagas al mes para saber cuándo terminas.');
      notas.push(dd.tasaEA ? `Interés: ${dd.tasaEA.toLocaleString('es-CO')}% efectivo anual.` : 'Sin dato de interés: el cálculo no los cuenta.');
      const pr = proyectar(saldo, r, cuota);
      if (pr && pr.nunca) notas.push(`<span class="pill pill-mal">${ICONO.alerta} La cuota no alcanza ni para los intereses</span>`);
      else if (pr) notas.push(`Terminas en <strong>${tiempoTexto(pr.meses)}</strong> (por ahí en ${mesDentroDe(pr.meses)})${pr.intereses ? ` y pagarías unos ${plata(pr.intereses)} en intereses` : ''}.`);
    }
    return `<article class="tarjeta meta deuda"${pagada ? ' data-lista' : ''} aria-labelledby="deuda-t-${id}">
      <div class="meta-cabeza">
        <h2 id="deuda-t-${id}">${esc(dd.nombre)}</h2>
        <button type="button" class="btn-icono btn-icono-chico" data-accion="editar-deuda" data-id="${id}" aria-label="Editar ${esc(dd.nombre)}">${ICONO.lapiz}</button>
      </div>
      <p class="meta-cifras"><strong>${plata(saldo)}</strong>${pagada ? 'no debes nada' : 'debes hoy'}</p>
      ${dd.inicial ? `<div class="meta-barra" role="progressbar" aria-label="Lo pagado de ${esc(dd.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(avance)}"><span style="width:${avance.toFixed(1)}%"></span></div>
      <p class="meta-nota">Has pagado el ${Math.floor(avance)}% de ${plata(dd.inicial)}.</p>` : ''}
      ${notas.map((n) => `<p class="meta-nota">${n}</p>`).join('')}
      <div class="meta-botones">
        ${pagada ? '' : `<button type="button" class="btn btn-primario btn-chico" data-accion="abonar-deuda" data-id="${id}">Abonar extra</button>`}
        <button type="button" class="btn btn-sutil btn-chico" data-accion="actualizar-saldo" data-id="${id}">Actualizar saldo</button>
      </div>
    </article>`;
  }

  function renderDeudas() {
    const lista = datos.deudas.map((dd) => ({ dd, saldo: saldoDeDeuda(dd), cuota: cuotaDeDeuda(dd), r: tasaMensual(dd) }));
    if (!lista.length) {
      $('#deudas-cuerpo').innerHTML = `<div class="vacio"><h2>No tienes deudas anotadas</h2>
        <p>Si debes algo (tarjeta, crédito, un préstamo), anótalo. Ver cuánto falta y cuándo terminas ayuda a salir más rápido.</p>
        <div class="vacio-botones"><button type="button" class="btn btn-primario" data-accion="nueva-deuda">Agregar deuda</button></div></div>`;
      return;
    }
    const pendientes = lista.filter((x) => x.saldo > 0);
    const total = pendientes.reduce((s, x) => s + x.saldo, 0);
    const cuotas = pendientes.reduce((s, x) => s + x.cuota, 0);
    const ingreso = ingresoMensual();
    const avisos = [];

    if (pendientes.length) {
      const conTasa = pendientes.some((x) => x.r > 0);
      const objetivo = pendientes.slice().sort((x, y) => (conTasa ? y.r - x.r : x.saldo - y.saldo))[0];
      if (pendientes.length > 1) {
        avisos.push({
          nivel: 'info',
          texto: conTasa
            ? `Paga la cuota de todas y, si te sobra algo, abónalo a <strong>${esc(objetivo.dd.nombre)}</strong>: es la que más intereses cobra. Cuando la termines, pasa esa cuota a la siguiente.`
            : `Paga la cuota de todas y, si te sobra algo, abónalo a <strong>${esc(objetivo.dd.nombre)}</strong>, la más pequeña. Terminarla rápido te libera esa cuota para la siguiente.`,
        });
      }
      const antes = proyectar(objetivo.saldo, objetivo.r, objetivo.cuota);
      const despues = proyectar(objetivo.saldo, objetivo.r, objetivo.cuota + 50000);
      if (antes && despues && !despues.nunca) {
        const ahorroMeses = antes.nunca ? null : antes.meses - despues.meses;
        if (antes.nunca) {
          avisos.push({ nivel: 'mal', texto: `Con la cuota de ahora, <strong>${esc(objetivo.dd.nombre)}</strong> no baja. Si le pagas ${plata(50000)} más al mes, la terminas en ${tiempoTexto(despues.meses)}.` });
        } else if (ahorroMeses > 0) {
          const ahorroInteres = antes.intereses - despues.intereses;
          avisos.push({ nivel: 'bien', texto: `Si le abonas ${plata(50000)} más al mes a <strong>${esc(objetivo.dd.nombre)}</strong>, terminas ${tiempoTexto(ahorroMeses)} antes${ahorroInteres > 0 ? ` y te ahorras unos ${plata(ahorroInteres)} en intereses` : ''}.` });
        }
      }
      if (ingreso && cuotas / ingreso > 0.3) {
        avisos.push({ nivel: 'ojo', texto: `Tus cuotas se llevan el <strong>${porcentaje(cuotas, ingreso)}%</strong> de lo que ganas. Lo sano es que no pasen del 30%: evita sacar más créditos por ahora.` });
      }
    }

    $('#deudas-cuerpo').innerHTML = `
      <p class="metas-total">${pendientes.length ? `Debes <strong>${plata(total)}</strong> en total y pagas ${plata(cuotas)} al mes en cuotas.` : '¡No debes nada! 🎉'}</p>
      ${avisos.length ? `<section class="tarjeta estrategia" aria-labelledby="t-estrategia"><h2 id="t-estrategia">Cómo salir más rápido</h2><ul class="avisos-lista">${avisos.sort((x, y) => ORDEN_NIVEL[x.nivel] - ORDEN_NIVEL[y.nivel]).map(htmlAviso).join('')}</ul></section>` : ''}
      <div class="metas-grid">${lista.map(htmlDeuda).join('')}</div>
      <p class="ayuda nota-deudas">Los cálculos son aproximados. De vez en cuando toca “Actualizar saldo” con lo que diga el extracto.</p>`;
  }

  let deudaEditando = null;

  function actualizarCuotaDeuda() {
    $('#deuda-cuota-campo').hidden = Boolean($('#deuda-fijo').value);
  }

  function abrirDeuda(dd = null, enfocarSaldo = false) {
    deudaEditando = dd;
    $('#dlg-deuda-titulo').textContent = dd ? (enfocarSaldo ? 'Actualizar saldo' : 'Editar deuda') : 'Agregar deuda';
    $('#deuda-nombre').value = dd ? dd.nombre : '';
    const saldo = dd ? saldoDeDeuda(dd) : 0;
    $('#deuda-saldo').value = saldo ? miles(saldo) : '';
    $('#deuda-saldo').dataset.antes = String(saldo);
    $('#deuda-fijo').innerHTML = '<option value="">No, la escribo aquí</option>' + datos.fijos
      .map((f) => `<option value="${esc(f.id)}"${dd && dd.fijoId === f.id ? ' selected' : ''}>${esc(f.nombre || 'Pago sin nombre')} · ${plata(f.monto * (f.frecuencia === 'quincenal' ? 2 : 1))} al mes</option>`)
      .join('');
    $('#deuda-cuota').value = dd && dd.cuota ? miles(dd.cuota) : '';
    $('#deuda-tasa').value = dd && dd.tasaEA ? String(dd.tasaEA) : '';
    $('#deuda-eliminar').hidden = !dd;
    actualizarCuotaDeuda();
    ocultarError('deuda');
    $('#dlg-deuda').showModal();
    if (enfocarSaldo) $('#deuda-saldo').focus();
    else $('#deuda-nombre').focus();
  }

  function guardarDeuda(e) {
    e.preventDefault();
    const nombre = $('#deuda-nombre').value.trim().slice(0, 40);
    const saldo = leerMonto($('#deuda-saldo').value);
    const fijoId = $('#deuda-fijo').value;
    const cuota = fijoId ? 0 : leerMonto($('#deuda-cuota').value);
    const textoTasa = $('#deuda-tasa').value.trim().replace(',', '.');
    const tasa = textoTasa ? Number(textoTasa) : 0;
    if (!nombre) return mostrarError('deuda', 'Ponle un nombre a la deuda.', $('#deuda-nombre'));
    if (!deudaEditando && !saldo) return mostrarError('deuda', 'Escribe cuánto debes hoy.', $('#deuda-saldo'));
    if (!fijoId && !cuota) return mostrarError('deuda', 'Escribe cuánto pagas al mes, o elige el pago fijo de la cuota.', $('#deuda-cuota'));
    if (!Number.isFinite(tasa) || tasa < 0 || tasa > 200) return mostrarError('deuda', 'Revisa el interés: es un número entre 0 y 200.', $('#deuda-tasa'));

    const ahora = { fecha: hoyISO(), ts: marca() };
    if (deudaEditando) {
      const dd = deudaEditando;
      Object.assign(dd, { nombre, cuota, fijoId, tasaEA: Math.round(tasa * 100) / 100 });
      if (saldo !== Number($('#deuda-saldo').dataset.antes)) {
        dd.saldo = saldo;
        dd.base = ahora;
        dd.inicial = Math.max(dd.inicial, saldo);
      }
    } else {
      datos.deudas.push({ id: nuevoId(), nombre, saldo, inicial: saldo, cuota, tasaEA: Math.round(tasa * 100) / 100, fijoId, base: ahora });
    }
    $('#dlg-deuda').close();
    guardar();
    renderVista();
    notificar(deudaEditando ? 'Deuda guardada' : 'Deuda agregada');
  }

  /* ─────────────────────────── Vistas y rutas ─────────────────────────── */

  function renderSaludo() {
    const hoy = hoyISO();
    $('#saludo').textContent = `Hola${datos.nombre ? `, ${datos.nombre}` : ''}. Hoy es ${fechaLarga(hoy)}.`;
  }

  function renderVista() {
    $('#aviso-ejemplo').hidden = !datos.ejemplo;
    renderAvisoPagos();
    for (const el of $$('[data-donde]')) el.textContent = almacen.donde;
    renderSaludo();
    if (ui.vista === 'resumen' || ui.vista === 'gastos') {
      for (const el of $$('[data-periodo]')) el.innerHTML = htmlPeriodo();
    }
    if (ui.vista === 'resumen') renderResumen();
    else if (ui.vista === 'gastos') renderGastos();
    else if (ui.vista === 'plan') renderPlan();
    else if (ui.vista === 'deudas') renderDeudas();
    else renderMetas();
  }

  function rutear() {
    const pedida = location.hash.replace('#', '');
    ui.vista = VISTAS.includes(pedida) ? pedida : 'resumen';
    for (const v of VISTAS) $(`#vista-${v}`).hidden = v !== ui.vista;
    for (const a of $$('.pestana')) {
      if (a.dataset.vista === ui.vista) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    renderVista();
    if (ui.enfocar) {
      const el = $(ui.enfocar);
      ui.enfocar = null;
      if (el) el.focus();
    }
  }

  // Cambia de pestaña. "enfocar" es un selector que recibe el cursor cuando
  // la vista ya está dibujada.
  function irA(vista, enfocar = null) {
    ui.enfocar = enfocar;
    if (location.hash === `#${vista}`) rutear();
    else location.hash = `#${vista}`;
  }

  /* ──────────────────────── Diálogo: movimiento ───────────────────────── */

  let movEstado = { mov: null, fijo: null, occ: null, deuda: null, tipo: 'gasto' };

  function mostrarError(prefijo, texto, enfocar) {
    const el = $(`#${prefijo}-error`);
    el.textContent = texto;
    el.hidden = false;
    if (enfocar) enfocar.focus();
  }

  function ocultarError(prefijo) {
    $(`#${prefijo}-error`).hidden = true;
  }

  function actualizarTipoMov() {
    const tipo = movEstado.tipo;
    for (const b of $$('[data-accion="mov-tipo"]')) b.setAttribute('aria-checked', String(b.dataset.tipo === tipo));
    $('#mov-categorias').hidden = tipo !== 'gasto';
    $('#mov-nota').placeholder = tipo === 'gasto' ? 'Ej: almuerzo' : 'Ej: trabajo extra';
    if (!movEstado.mov && !movEstado.occ && !movEstado.deuda) $('#dlg-mov-titulo').textContent = tipo === 'gasto' ? 'Anotar gasto' : 'Anotar ingreso extra';
  }

  function abrirMovimiento({ mov = null, fijo = null, occ = null, deuda = null } = {}) {
    if (mov && mov.fijoId) {
      fijo = datos.fijos.find((f) => f.id === mov.fijoId) || null;
      occ = mov.occ;
    }
    if (mov && mov.deudaId) deuda = datos.deudas.find((x) => x.id === mov.deudaId) || null;
    movEstado = { mov, fijo, occ, deuda, tipo: mov ? mov.tipo : 'gasto' };
    const esPago = Boolean(occ);

    let titulo = 'Anotar gasto';
    if (esPago) titulo = mov ? 'Pago fijo' : 'Registrar pago';
    else if (deuda) titulo = mov ? 'Abono a deuda' : 'Abonar a la deuda';
    else if (mov) titulo = mov.tipo === 'ingreso' ? 'Editar ingreso extra' : 'Editar gasto';
    $('#dlg-mov-titulo').textContent = titulo;
    $('#mov-tipo').hidden = esPago || Boolean(mov) || Boolean(deuda);

    const info = $('#mov-fijo-info');
    if (esPago) {
      const [a, m, q] = occ.split('-').map(Number);
      const nombre = fijo ? fijo.nombre : (mov && mov.nota) || 'Pago fijo';
      info.textContent = `${nombre}: pago de la ${q === 1 ? '1ª' : '2ª'} quincena de ${MESES[m - 1]} de ${a}. Si pagaste un valor distinto, cámbialo.`;
      info.hidden = false;
    } else if (deuda) {
      info.textContent = `Abono extra a ${deuda.nombre}. Se descuenta de lo que debes y cuenta como gasto de deudas.`;
      info.hidden = false;
    } else {
      info.hidden = true;
    }

    const monto = mov ? mov.monto : fijo ? fijo.monto : 0;
    $('#mov-monto').value = monto ? miles(monto) : '';
    const categoria = mov ? mov.categoria : fijo ? fijo.categoria : deuda ? 'deudas' : '';
    for (const r of $$('input[name="mov-cat"]')) r.checked = r.value === categoria;
    $('#mov-fecha').value = mov ? mov.fecha : hoyISO();
    $('#mov-nota').value = mov ? mov.nota : fijo ? fijo.nombre : deuda ? `Abono a ${deuda.nombre}` : '';
    $('#mov-eliminar').hidden = !mov;
    $('#mov-eliminar').textContent = esPago ? 'Desmarcar pago' : 'Eliminar';
    $('#mov-guardar').textContent = esPago && !mov ? 'Guardar pago' : 'Guardar';
    ocultarError('mov');
    actualizarTipoMov();
    $('#dlg-mov').showModal();
    if (esPago && !mov) $('#mov-guardar').focus();
    else $('#mov-monto').focus();
  }

  function guardarMovimiento(e) {
    e.preventDefault();
    const monto = leerMonto($('#mov-monto').value);
    const fecha = $('#mov-fecha').value;
    const marcada = $('input[name="mov-cat"]:checked');
    const categoria = movEstado.tipo === 'gasto' ? (marcada ? marcada.value : '') : '';
    const nota = $('#mov-nota').value.trim().slice(0, 60);

    if (!monto) return mostrarError('mov', 'Escribe cuánto fue.', $('#mov-monto'));
    if (!esFecha(fecha)) return mostrarError('mov', 'Elige la fecha.', $('#mov-fecha'));
    if (movEstado.tipo === 'gasto' && !CAT[categoria]) {
      return mostrarError('mov', 'Elige en qué fue el gasto.', $('input[name="mov-cat"]'));
    }

    const { mov, fijo, occ } = movEstado;
    if (mov) {
      Object.assign(mov, { monto, fecha, categoria, nota });
    } else {
      const nuevo = { id: nuevoId(), tipo: movEstado.tipo, monto, fecha, categoria, nota, ts: marca() };
      if (occ) {
        nuevo.fijoId = fijo ? fijo.id : '';
        nuevo.occ = occ;
      } else if (movEstado.deuda) {
        nuevo.deudaId = movEstado.deuda.id;
      }
      datos.movimientos.push(nuevo);
    }
    $('#dlg-mov').close();
    guardar();
    renderVista();
    let texto = 'Cambios guardados';
    if (!mov) texto = occ ? 'Pago registrado' : movEstado.deuda ? 'Abono registrado' : movEstado.tipo === 'ingreso' ? 'Ingreso anotado' : 'Gasto anotado';
    notificar(texto);
  }

  function eliminarMovimiento(mov) {
    const i = datos.movimientos.indexOf(mov);
    if (i < 0) return;
    datos.movimientos.splice(i, 1);
    guardar();
    renderVista();
    notificar(mov.occ ? 'Pago desmarcado' : 'Movimiento eliminado', {
      texto: 'Deshacer',
      fn: () => {
        datos.movimientos.splice(Math.min(i, datos.movimientos.length), 0, mov);
        guardar();
        renderVista();
      },
    });
  }

  /* ─────────────────────────── Diálogo: metas ─────────────────────────── */

  let metaEditando = null;

  function abrirMeta(meta = null, prellenado = {}) {
    metaEditando = meta;
    $('#dlg-meta-titulo').textContent = meta ? 'Editar meta' : 'Nueva meta';
    $('#meta-nombre').value = meta ? meta.nombre : prellenado.nombre || '';
    const objetivo = meta ? meta.objetivo : prellenado.objetivo || 0;
    $('#meta-objetivo').value = objetivo ? miles(objetivo) : '';
    $('#meta-inicial').value = meta && meta.inicial ? miles(meta.inicial) : '';
    $('#meta-inicial-label').textContent = meta ? 'Lo que tenías antes de empezar' : '¿Cuánto tienes ya?';
    $('#meta-fecha').value = meta ? meta.fecha : '';
    $('#meta-eliminar').hidden = !meta;
    const usadas = new Set(datos.metas.map((m) => m.nombre.toLowerCase()));
    $('#meta-sugerencias').innerHTML = meta ? '' : SUGERENCIAS_METAS
      .filter((n) => !usadas.has(n.toLowerCase()))
      .map((n) => `<button type="button" class="chip" data-accion="nombre-meta" data-nombre="${esc(n)}">${esc(n)}</button>`)
      .join('');
    ocultarError('meta');
    $('#dlg-meta').showModal();
    if (!meta && !prellenado.nombre) $('#meta-nombre').focus();
    else $('#meta-objetivo').focus();
  }

  function guardarMeta(e) {
    e.preventDefault();
    const nombre = $('#meta-nombre').value.trim().slice(0, 40);
    const objetivo = leerMonto($('#meta-objetivo').value);
    const inicial = leerMonto($('#meta-inicial').value);
    const fecha = $('#meta-fecha').value;
    if (!nombre) return mostrarError('meta', 'Ponle un nombre a la meta.', $('#meta-nombre'));
    if (!objetivo) return mostrarError('meta', 'Escribe cuánto necesitas.', $('#meta-objetivo'));
    if (fecha && !esFecha(fecha)) return mostrarError('meta', 'Revisa la fecha.', $('#meta-fecha'));
    if (fecha && !metaEditando && fecha < hoyISO()) return mostrarError('meta', 'La fecha ya pasó: elige una fecha que venga.', $('#meta-fecha'));

    if (metaEditando) {
      Object.assign(metaEditando, { nombre, objetivo, inicial, fecha: fecha || '' });
    } else {
      datos.metas.push({ id: nuevoId(), nombre, objetivo, inicial, fecha: fecha || '', creada: hoyISO() });
    }
    $('#dlg-meta').close();
    guardar();
    renderVista();
    notificar(metaEditando ? 'Meta guardada' : 'Meta creada');
  }

  /* ─────────────────────── Diálogo: abonar o sacar ────────────────────── */

  let abonoEstado = { meta: null, mov: null, modo: 'ahorro' };

  function actualizarAbono() {
    const { meta, mov, modo } = abonoEstado;
    const nombre = meta ? meta.nombre : 'una meta borrada';
    $('#dlg-abono-titulo').textContent = `${modo === 'retiro' ? 'Sacar de' : 'Abonar a'} ${nombre}`;
    for (const b of $$('[data-accion="abono-modo"]')) b.setAttribute('aria-checked', String(b.dataset.modo === modo));
    let ayuda = '';
    if (meta) {
      const tiene = ahorradoEnMeta(meta, mov);
      ayuda = modo === 'retiro'
        ? `Tienes ${plata(tiene)} en esta meta. Saca solo lo necesario.`
        : `Llevas ${plata(tiene)}${meta.objetivo ? ` de ${plata(meta.objetivo)}` : ''}.`;
    }
    $('#abono-ayuda').textContent = ayuda;
  }

  function abrirAbono({ meta = null, mov = null, modo = 'ahorro' } = {}) {
    if (mov) {
      meta = datos.metas.find((x) => x.id === mov.metaId) || null;
      modo = mov.tipo;
    }
    abonoEstado = { meta, mov, modo };
    $('#abono-monto').value = mov ? miles(mov.monto) : '';
    $('#abono-fecha').value = mov ? mov.fecha : hoyISO();
    $('#abono-eliminar').hidden = !mov;
    ocultarError('abono');
    actualizarAbono();
    $('#dlg-abono').showModal();
    $('#abono-monto').focus();
  }

  function guardarAbono(e) {
    e.preventDefault();
    const { meta, mov, modo } = abonoEstado;
    const monto = leerMonto($('#abono-monto').value);
    const fecha = $('#abono-fecha').value;
    if (!monto) return mostrarError('abono', 'Escribe cuánto.', $('#abono-monto'));
    if (!esFecha(fecha)) return mostrarError('abono', 'Elige la fecha.', $('#abono-fecha'));
    if (modo === 'retiro' && meta) {
      const tiene = ahorradoEnMeta(meta, mov);
      if (monto > tiene) return mostrarError('abono', `No puedes sacar más de lo que tienes (${plata(tiene)}).`, $('#abono-monto'));
    }
    if (mov) {
      Object.assign(mov, { tipo: modo, monto, fecha });
    } else {
      datos.movimientos.push({ id: nuevoId(), tipo: modo, monto, fecha, categoria: '', nota: '', metaId: meta.id, ts: marca() });
    }
    $('#dlg-abono').close();
    guardar();
    renderVista();
    notificar(mov ? 'Cambios guardados' : modo === 'retiro' ? 'Listo, sacaste la plata de la meta' : '¡Abono guardado!');
  }

  /* ─────────────────────────── Copias de datos ────────────────────────── */

  async function exportar() {
    const texto = JSON.stringify({ app: 'agente-de-dinero', exportado: new Date().toISOString(), ...datos }, null, 2);
    const nombre = `agente-de-dinero-${hoyISO()}.json`;
    let ok = false;
    try {
      const descargar = window.CUENTAS_CLARAS_DESCARGAR || almacen.descargar || descargarConEnlace;
      ok = await descargar(nombre, texto);
    } catch (e) {
      ok = false;
    }
    notificar(ok ? 'Copia descargada' : 'No se pudo descargar la copia.');
  }

  async function importar(input) {
    const archivo = input.files && input.files[0];
    input.value = '';
    if (!archivo) return;
    let crudo = null;
    try {
      crudo = JSON.parse(await archivo.text());
    } catch (e) {
      crudo = null;
    }
    if (!crudo || typeof crudo !== 'object' || !Array.isArray(crudo.movimientos)) {
      notificar('Ese archivo no es una copia de Agente de Dinero.');
      return;
    }
    const nuevos = normalizar(crudo, hoyISO());
    const si = await confirmar({
      titulo: '¿Restaurar esta copia?',
      texto: `Tus datos de ahora se reemplazan por los de la copia: ${nuevos.movimientos.length} movimientos y ${nuevos.metas.length} metas.`,
      si: 'Sí, restaurar',
      peligro: false,
    });
    if (!si) return;
    datos = nuevos;
    datos.ejemplo = false;
    guardar();
    renderVista();
    notificar('Copia restaurada');
  }

  function empezarDeCero() {
    const hoy = hoyISO();
    datos = datosVacios(hoy);
    datos.ingresos.push({ id: nuevoId(), nombre: 'Sueldo', monto: 0, frecuencia: 'quincenal' });
    ui.periodo = periodoDe(hoy, 'q');
    ui.filtroTipo = 'todo';
    ui.filtroCat = '';
    ui.fijosAbiertos.clear();
    guardar();
    window.scrollTo(0, 0);
    irA('plan', '#lista-ingresos [data-campo="monto"]');
  }

  /* ───────────────────────────── Acciones ─────────────────────────────── */

  function quitarDeLista(lista, id, texto) {
    const i = lista.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [quitado] = lista.splice(i, 1);
    registrarHistorial();
    guardar();
    renderPlan();
    notificar(texto, {
      texto: 'Deshacer',
      fn: () => {
        lista.splice(Math.min(i, lista.length), 0, quitado);
        registrarHistorial();
        guardar();
        renderVista();
      },
    });
  }

  function agregarFijo(base) {
    const hoy = hoyISO();
    const [a, m, d] = hoy.split('-').map(Number);
    const fijo = {
      id: nuevoId(),
      nombre: base.nombre || '',
      monto: 0,
      categoria: base.categoria || 'otros',
      frecuencia: base.frecuencia || 'mensual',
      dia: base.dia || 1,
      desde: claveQuincena(a, m, d <= 15 ? 1 : 2),
    };
    datos.fijos.push(fijo);
    ui.fijosAbiertos.add(fijo.id);
    guardar();
    renderPlan();
    const campo = $(`#fij-${base.nombre ? 'm' : 'n'}-${fijo.id}`);
    if (campo) campo.focus();
  }

  const ACCIONES = {
    anotar: () => abrirMovimiento(),
    'cerrar-dialogo': (el) => el.closest('dialog').close(),
    'mov-tipo': (el) => {
      movEstado.tipo = el.dataset.tipo;
      actualizarTipoMov();
    },
    'eliminar-mov': () => {
      const { mov } = movEstado;
      $('#dlg-mov').close();
      if (mov) eliminarMovimiento(mov);
    },
    pagar: (el) => {
      const fijo = datos.fijos.find((f) => f.id === el.dataset.fijo);
      if (fijo) abrirMovimiento({ fijo, occ: el.dataset.occ });
    },
    'editar-mov': (el) => {
      const mov = datos.movimientos.find((m) => m.id === el.dataset.id);
      if (!mov) return;
      if (mov.tipo === 'ahorro' || mov.tipo === 'retiro') abrirAbono({ mov });
      else abrirMovimiento({ mov });
    },
    'periodo-anterior': () => {
      const p = moverPeriodo(ui.periodo, -1);
      if (puedeIrA(p)) { ui.periodo = p; renderVista(); }
    },
    'periodo-siguiente': () => {
      const p = moverPeriodo(ui.periodo, 1);
      if (puedeIrA(p)) { ui.periodo = p; renderVista(); }
    },
    'periodo-hoy': () => {
      ui.periodo = periodoDe(hoyISO(), ui.periodo.tipo);
      renderVista();
    },
    modo: (el) => {
      const tipo = el.dataset.modo;
      if (tipo === ui.periodo.tipo) return;
      const hoy = hoyISO();
      const { a, m } = ui.periodo;
      if (tipo === 'm') ui.periodo = { tipo: 'm', a, m };
      else ui.periodo = mesClave(a, m) === hoy.slice(0, 7) ? periodoDe(hoy, 'q') : { tipo: 'q', a, m, q: 1 };
      renderVista();
    },
    'filtro-tipo': (el) => {
      ui.filtroTipo = el.dataset.tipo;
      if (ui.filtroTipo === 'ingreso' || ui.filtroTipo === 'ahorro') ui.filtroCat = '';
      renderGastos();
    },
    'limpiar-filtro': () => {
      ui.filtroTipo = 'todo';
      ui.filtroCat = '';
      renderGastos();
    },
    'ver-todos': () => {
      ui.filtroTipo = 'todo';
      ui.filtroCat = '';
      window.scrollTo(0, 0);
      irA('gastos');
    },
    'ver-categoria': (el) => {
      ui.filtroCat = el.dataset.cat || '';
      ui.filtroTipo = 'gasto';
      window.scrollTo(0, 0);
      irA('gastos');
    },
    'otro-consejo': () => {
      ui.consejo = (ui.consejo + 1) % CONSEJOS.length;
      const tarjeta = $('.r-consejo');
      if (tarjeta) tarjeta.outerHTML = htmlConsejo();
      const boton = $('[data-accion="otro-consejo"]');
      if (boton) boton.focus();
    },
    'ir-abonar': () => {
      if (datos.metas.length === 1) abrirAbono({ meta: datos.metas[0] });
      else irA('metas');
    },
    empezar: () => empezarDeCero(),
    exportar: () => exportar(),
    'borrar-todo': async () => {
      const si = await confirmar({
        titulo: '¿Borrar todos tus datos?',
        texto: 'Se borran tu plan, tus gastos y tus metas. Si quieres guardarlos, primero descarga una copia.',
        si: 'Sí, borrar todo',
      });
      if (!si) return;
      empezarDeCero();
      notificar('Listo, empezaste de cero');
    },
    'agregar-ingreso': () => {
      const ingreso = { id: nuevoId(), nombre: '', monto: 0, frecuencia: 'mensual' };
      datos.ingresos.push(ingreso);
      guardar();
      renderPlan();
      $(`#ing-n-${ingreso.id}`).focus();
    },
    'quitar-ingreso': (el) => quitarDeLista(datos.ingresos, el.dataset.id, 'Ingreso quitado'),
    'agregar-fijo': () => agregarFijo({}),
    'sugerir-fijo': (el) => {
      const base = SUGERENCIAS_FIJOS.find((s) => s.nombre === el.dataset.nombre);
      if (base) agregarFijo(base);
    },
    'quitar-fijo': (el) => quitarDeLista(datos.fijos, el.dataset.id, 'Pago quitado del plan'),
    'nueva-meta': () => abrirMeta(),
    'editar-meta': (el) => {
      const meta = datos.metas.find((m) => m.id === el.dataset.id);
      if (meta) abrirMeta(meta);
    },
    'nombre-meta': (el) => {
      $('#meta-nombre').value = el.dataset.nombre;
      $('#meta-objetivo').focus();
    },
    'crear-emergencia': (el) => abrirMeta(null, { nombre: 'Fondo de emergencia', objetivo: Number(el.dataset.monto) || 0 }),
    'eliminar-meta': async () => {
      const meta = metaEditando;
      if (!meta) return;
      const si = await confirmar({
        titulo: `¿Borrar la meta “${meta.nombre}”?`,
        texto: 'Sus abonos se quedan en tu lista de movimientos, para que tus cuentas pasadas no cambien.',
        si: 'Sí, borrar meta',
      });
      if (!si) return;
      datos.metas = datos.metas.filter((m) => m !== meta);
      $('#dlg-meta').close();
      guardar();
      renderVista();
      notificar('Meta borrada');
    },
    abonar: (el) => {
      const meta = datos.metas.find((m) => m.id === el.dataset.id);
      if (meta) abrirAbono({ meta, modo: 'ahorro' });
    },
    sacar: (el) => {
      const meta = datos.metas.find((m) => m.id === el.dataset.id);
      if (meta) abrirAbono({ meta, modo: 'retiro' });
    },
    'abono-modo': (el) => {
      abonoEstado.modo = el.dataset.modo;
      ocultarError('abono');
      actualizarAbono();
    },
    'eliminar-abono': () => {
      const { mov } = abonoEstado;
      $('#dlg-abono').close();
      if (mov) eliminarMovimiento(mov);
    },
    'agregar-tope': () => agregarTope(''),
    'sugerir-tope': (el) => agregarTope(el.dataset.cat),
    'quitar-tope': (el) => quitarDeLista(datos.topes, el.dataset.id, 'Tope quitado'),
    calendario: () => descargarCalendario(),
    'nueva-deuda': () => abrirDeuda(),
    'editar-deuda': (el) => {
      const dd = datos.deudas.find((x) => x.id === el.dataset.id);
      if (dd) abrirDeuda(dd);
    },
    'actualizar-saldo': (el) => {
      const dd = datos.deudas.find((x) => x.id === el.dataset.id);
      if (dd) abrirDeuda(dd, true);
    },
    'abonar-deuda': (el) => {
      const deuda = datos.deudas.find((x) => x.id === el.dataset.id);
      if (deuda) abrirMovimiento({ deuda });
    },
    'eliminar-deuda': async () => {
      const dd = deudaEditando;
      if (!dd) return;
      const si = await confirmar({
        titulo: `¿Borrar la deuda “${dd.nombre}”?`,
        texto: 'Sus abonos se quedan en tus gastos, para que tus cuentas pasadas no cambien.',
        si: 'Sí, borrar deuda',
      });
      if (!si) return;
      datos.deudas = datos.deudas.filter((x) => x !== dd);
      $('#dlg-deuda').close();
      guardar();
      renderVista();
      notificar('Deuda borrada');
    },
  };

  /* ───────────────────────────── Eventos ──────────────────────────────── */

  // Pone los puntos de mil mientras escribes, sin mover el cursor de lugar.
  function formatearMonto(input) {
    const antes = input.value;
    const cursor = input.selectionStart ?? antes.length;
    const digitosAntes = antes.slice(0, cursor).replace(/\D/g, '').length;
    const digitos = antes.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12);
    const nuevo = digitos ? miles(Number(digitos)) : '';
    if (nuevo === antes) return;
    input.value = nuevo;
    if (document.activeElement !== input) return;
    let pos = 0;
    let vistos = 0;
    while (pos < nuevo.length && vistos < digitosAntes) {
      if (/\d/.test(nuevo[pos])) vistos += 1;
      pos += 1;
    }
    input.setSelectionRange(pos, pos);
  }

  function editarFila(fila, el) {
    const lista = datos[fila.dataset.lista];
    const item = lista && lista.find((x) => x.id === fila.dataset.id);
    if (!item) return;
    const campo = el.dataset.campo;
    if (campo === 'monto') item.monto = leerMonto(el.value);
    else if (campo === 'nombre') item.nombre = el.value.trim().slice(0, 40);
    else if (campo === 'dia') {
      const d = Math.round(Number(el.value));
      if (d >= 1 && d <= 31) item.dia = d;
    } else if (campo === 'frecuencia') {
      item.frecuencia = el.value;
    } else if (campo === 'categoria') {
      item.categoria = CAT[el.value] ? el.value : 'otros';
    }
    registrarHistorial();
    guardar();
    renderPlanResultado();
  }

  function conectarEventos() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-accion]');
      if (!el || el.disabled) return;
      const accion = ACCIONES[el.dataset.accion];
      if (accion) {
        e.preventDefault();
        accion(el, e);
      }
    });

    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('[data-monto]')) formatearMonto(el);
      const fila = el.closest('[data-lista][data-id]');
      if (fila && el.dataset.campo) {
        editarFila(fila, el);
      } else if (el.id === 'ahorro-pct') {
        datos.ahorroPct = Math.min(40, Math.max(0, Number(el.value) || 0));
        registrarHistorial();
        guardar();
        renderPlanResultado();
      } else if (el.id === 'nombre') {
        datos.nombre = el.value.trim().slice(0, 30);
        guardar();
        renderSaludo();
      }
    });

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'filtro-cat') {
        ui.filtroCat = el.value;
        if (el.value) ui.filtroTipo = 'gasto';
        renderGastos();
      } else if (el.id === 'importar-archivo') {
        importar(el);
      } else if (el.id === 'deuda-fijo') {
        actualizarCuotaDeuda();
      } else if (el.matches('[data-campo="dia"]')) {
        const caja = el.closest('[data-lista][data-id]');
        const f = caja && datos.fijos.find((x) => x.id === caja.dataset.id);
        if (f) el.value = String(f.dia);
      } else if (el.matches('.fila-fijo [data-campo="nombre"]')) {
        renderSugerenciasFijos();
      }
    });

    // Recordar qué pagos fijos están abiertos (el evento "toggle" no burbujea).
    document.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.matches('details.fijo')) return;
      if (d.open) ui.fijosAbiertos.add(d.dataset.id);
      else ui.fijosAbiertos.delete(d.dataset.id);
    }, true);

    $('#form-mov').addEventListener('submit', guardarMovimiento);
    $('#form-meta').addEventListener('submit', guardarMeta);
    $('#form-abono').addEventListener('submit', guardarAbono);
    $('#form-deuda').addEventListener('submit', guardarDeuda);

    // Tocar fuera de una ventana la cierra.
    for (const d of $$('dialog.dialogo')) {
      d.addEventListener('click', (e) => {
        if (e.target === d) d.close();
      });
    }

    window.addEventListener('hashchange', () => {
      window.scrollTo(0, 0);
      rutear();
    });

    // No perder nada si se cierra la página justo después de un cambio.
    const guardarPendiente = () => {
      if (temporizadorGuardar) guardarYa();
    };
    window.addEventListener('pagehide', guardarPendiente);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') guardarPendiente();
    });
  }

  /* ───────────────────────────── Arranque ─────────────────────────────── */

  async function iniciar() {
    $('#mov-cat-grid').innerHTML = CATEGORIAS.map((c) =>
      `<label class="cat-chip"><input type="radio" name="mov-cat" id="mov-cat-${c.id}" value="${c.id}"><span><b aria-hidden="true">${c.emoji}</b>${esc(c.nombre)}</span></label>`
    ).join('');
    conectarEventos();

    almacen = await elegirAlmacen();
    let guardados = null;
    let fallo = false;
    try {
      guardados = await almacen.cargar();
    } catch (e) {
      fallo = true;
    }
    const hoy = hoyISO();
    datos = guardados ? normalizar(guardados, hoy) : crearEjemplo(hoy);
    ui.periodo = periodoDe(hoy, 'q');

    if (fallo) {
      // Mejor no guardar nada en esta visita que borrar lo que ya estaba guardado.
      almacen = { donde: almacen.donde, guardar: async () => false };
      $('#aviso-guardado-texto').textContent = 'No pudimos leer tus datos guardados, así que en esta visita no se guardará nada. Vuelve a abrir la página en un rato.';
      $('#aviso-guardado').hidden = false;
    } else if (almacen.ok === false) {
      $('#aviso-guardado').hidden = false;
    }

    $('#cargando').hidden = true;
    rutear();

    // Instalable y sin internet cuando la página está publicada en https.
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.CUENTAS_CLARAS_ALMACEN) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
