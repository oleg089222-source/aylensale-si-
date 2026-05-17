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

// Initialize Firebase when SDK is loaded
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized (aylensale-com)');
  } catch (e) {
    if (e.code === 'app/duplicate-app') {
      console.log('ℹ️ Firebase already initialized');
    } else {
      console.error('❌ Firebase init error:', e);
    }
  }
} else {
  console.warn('⚠️ Firebase SDK not loaded yet');
}
