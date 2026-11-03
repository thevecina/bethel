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
4. Ábrela en el celular y elige **Agregar a la pantalla de inicio**. Queda con su icono y
   funciona sin internet.

## Tus datos

Se guardan **solo en tu navegador** (localStorage) y no se envían a ningún lado.
Si borras el historial del navegador o cambias de celular, se pierden; por eso en
*Mi plan → Tus datos* puedes **descargar una copia** (.json) y **restaurarla** donde quieras.

## Archivos

- `index.html`: la estructura de la página.
- `estilos.css`: el diseño (crema, verde y amarillo; celular y computador).
- `app.js`: los cálculos y el guardado, con comentarios en español.
- `manifest.webmanifest`, `sw.js` e `icono*`: lo necesario para instalarla como app y usarla sin internet.
