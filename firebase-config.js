import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCRbUS6L7O4I_gGaaCmCyHi7wt_WgMwZFc",
  authDomain: "set-hardware.firebaseapp.com",
  projectId: "set-hardware",
  storageBucket: "set-hardware.firebasestorage.app",
  messagingSenderId: "613195230835",
  appId: "1:613195230835:web:c9e3e78db3e8b99f6ec406"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize anonymous authentication
signInAnonymously(auth).catch(err => {
  console.error('Firebase anonymous auth failed:', err);
});
