/* Agente de Dinero: iniciar sesión y ver tus datos en cualquier dispositivo.

   Aquí va la configuración de tu proyecto de Firebase. Los pasos para crearlo
   están en el README ("Iniciar sesión y ver tus datos en cualquier dispositivo").

   Mientras diga null, la app funciona sin cuenta y los datos quedan solo en
   este navegador. Estos valores no son secretos: identifican el proyecto, y lo
   que protege tus datos son las reglas de Firestore. */
window.AGENTE_FIREBASE = {
  apiKey: 'AIzaSyCKhhwEKrfp1kra4iNeFV4cFNndkprDBTk',
  authDomain: 'agentedeldinero.firebaseapp.com',
  projectId: 'agentedeldinero',
  storageBucket: 'agentedeldinero.firebasestorage.app',
  messagingSenderId: '885424290906',
  appId: '1:885424290906:web:23ae9749a0d8e854e92c63',
};

/* Así queda cuando lo llenas (con los valores de tu proyecto):

window.AGENTE_FIREBASE = {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
*/
