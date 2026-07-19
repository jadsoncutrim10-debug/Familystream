import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app;
let auth;
let db;
let isFirebaseEnabled = false;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    // Check if app already initialized
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    
    auth = getAuth(app);
    // Ensure persistence is set
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase persistence failed to set:', err);
    });
    
    isFirebaseEnabled = true;
    console.log('Firebase initialized successfully with config:', firebaseConfig.projectId);
  } else {
    console.warn('Firebase config has no apiKey. Running in Local Storage/Offline mode.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase. Falling back to offline-only state.', error);
}

export { app, auth, db, isFirebaseEnabled };
