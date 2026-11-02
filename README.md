# Agente de Dinero

Una página para organizar la plata del mes y de cada quincena.

**Cómo abrirla:** abre `index.html` en el navegador (doble clic). No hay que instalar nada.
Sin internet también funciona; solo cambia el tipo de letra.

La primera vez muestra un **ejemplo con números inventados** para que veas cómo funciona.
Cuando quieras, toca **Empezar con mis datos**.

## Qué hace

- **Mi plan**: escribes cuánto ganas (quincenal, mensual o semanal), lo que pagas sí o sí
  (arriendo, servicios, cuotas, mercado…) y qué porcentaje vas a ahorrar. La página calcula
  cuánto te queda para el día a día en cada quincena y por día. Si los pagos grandes caen en
  una sola quincena, te dice cuánto apartar de la otra para que ambas queden parejas.
- **Resumen**: cuánto te queda en la quincena (o en el mes), cuánto puedes gastar por día,
  qué pagos vencen y cuáles ya pagaste, en qué se te va la plata y avisos útiles
  (pagos vencidos, gastos hormiga, si vas gastando más rápido de lo planeado).
- **Gastos**: anotas cada gasto o ingreso extra en segundos y los ves por día, con filtros.
- **Metas**: metas de ahorro (fondo de emergencia, regalos de diciembre…) con cuánto abonar
  cada quincena para llegar a tiempo.

## Tus datos

Se guardan **solo en tu navegador** (localStorage) y no se envían a ningún lado.
Si borras el historial del navegador o cambias de celular, se pierden; por eso en
*Mi plan → Tus datos* puedes **descargar una copia** (.json) y **restaurarla** donde quieras.

## Archivos

- `index.html`: la estructura de la página.
- `estilos.css`: el diseño (modo claro y oscuro, celular y computador).
- `app.js`: los cálculos y el guardado, con comentarios en español.
