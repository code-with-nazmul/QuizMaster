import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyD6guQ-S6j5EOx0NyBLg1ACr6NFDPpc7aY",
  authDomain: "quizmaster-36703.firebaseapp.com",
  projectId: "quizmaster-36703",
  storageBucket: "quizmaster-36703.firebasestorage.app",
  messagingSenderId: "392284692505",
  appId: "1:392284692505:web:f16927608782794188ca88",
  measurementId: "G-ZZ97B8L2F3"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence
const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch (error) {
    // If auth is already initialized elsewhere, fall back to standard helper
    const { getAuth } = require('firebase/auth');
    return getAuth(app);
  }
})();

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
