import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCGaHiPcEXjiZpeopDny7JMVFwfFudUBCA',
  authDomain: 'inventario-de-administracion.firebaseapp.com',
  projectId: 'inventario-de-administracion',
  storageBucket: 'inventario-de-administracion.firebasestorage.app',
  messagingSenderId: '243668377632',
  appId: '1:243668377632:web:99e1c99345d6dca10e5c45',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: 'hca.edu.uy',
  prompt: 'select_account',
});
