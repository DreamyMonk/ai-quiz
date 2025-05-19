
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
// Uncomment and use if you plan to add Firebase Authentication
// import { getAuth, type Auth } from 'firebase/auth';

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
  measurementId: "YOUR_FIREBASE_MEASUREMENT_ID" // Optional
};

let app: FirebaseApp;
let db: Firestore;
// let auth: Auth;

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // Fallback or dummy app to prevent further errors if init fails
    // This is a basic fallback. In a real app, you'd handle this more gracefully.
    app = getApps()[0] || initializeApp({projectId: "fallback-project"});
  }
} else {
  app = getApps()[0];
}

try {
  db = getFirestore(app);
  // auth = getAuth(app); // Initialize Auth if needed
} catch (error) {
  console.error("Firestore (or Auth) initialization error:", error);
  // Provide a dummy db to prevent app crashes if running in an environment where Firebase can't init
  // (e.g. server-side rendering without proper checks or during build if config is missing)
  if (typeof window === 'undefined' && !process.env.FIREBASE_CONFIG_JSON) { // Basic check
     db = {} as Firestore; // Dummy Firestore
     console.warn("Firestore not initialized, using dummy instance. Ensure Firebase config is correct and environment is suitable.");
  } else {
    throw error; // Re-throw if it's not a known safe-to-ignore scenario
  }
}


export { app, db /*, auth */ };
