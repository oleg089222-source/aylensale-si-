// For Firebase JS SDK v7.20.0 and later, measurementId is optional
var firebaseConfig = {
  apiKey: "AIzaSyBpnzLxvk3uGQL-8jOIqQ_M_gTlh0a4mqg",
  authDomain: "aylensale.firebaseapp.com",
  projectId: "aylensale",
  storageBucket: "aylensale.firebasestorage.app",
  messagingSenderId: "554559570562",
  appId: "1:554559570562:web:714d322ab781b4314cea9b",
  measurementId: "G-8XWD4DQFDX"
};

console.log('[Firebase Config] Configuration loaded');

// Инициализируем Firebase сразу после загрузки compat SDK
function initFirebaseSDK() {
  console.log('[Firebase Config] Checking Firebase SDK...');
  
  if (typeof firebase === 'undefined') {
    console.log('[Firebase Config] Firebase SDK not ready yet, retrying...');
    setTimeout(initFirebaseSDK, 200);
    return;
  }
  
  try {
    console.log('[Firebase Config] Firebase SDK found, initializing...');
    firebase.initializeApp(firebaseConfig);
    console.log('[Firebase Config] ✅ Firebase initialized successfully');
    window.firebaseInitialized = true;
  } catch (error) {
    console.error('[Firebase Config] Error initializing Firebase:', error.message);
  }
}

// Начинаем проверку при загрузке этого скрипта
setTimeout(initFirebaseSDK, 100);
