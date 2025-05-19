
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
// Uncomment and use if you plan to add Firebase Authentication
// import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDVPUmXes77UsGu3QYuASM02bxGwdHTfDs",
  authDomain: "ai-quiz-faa35.firebaseapp.com",
  projectId: "ai-quiz-faa35",
  storageBucket: "ai-quiz-faa35.firebasestorage.app", // Corrected as per image
  messagingSenderId: "1049520882301",
  appId: "1:1049520882301:web:05395861301101560e6714",
  measurementId: "G-KS5531H2PG"
};

let app: FirebaseApp;
let db: Firestore;
// let auth: Auth;

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");
  } catch (error: any) {
    console.error("Firebase initialization error:", error.code, error.message, error);
    // Fallback or dummy app to prevent further errors if init fails
    app = initializeApp({projectId: "fallback-project-due-to-error"}); // Provide a minimal config
  }
} else {
  app = getApps()[0];
  console.log("Firebase app already initialized.");
}

try {
  db = getFirestore(app);
  console.log("Firestore instance obtained successfully.");
  // auth = getAuth(app); // Initialize Auth if needed
} catch (error: any) {
  console.error("Firestore (or Auth) initialization error:", error.code, error.message, error);
  // Provide a dummy db to prevent app crashes if running in an environment where Firebase can't init
  if (typeof window === 'undefined' && !process.env.FIREBASE_CONFIG_JSON) { // Basic check
     db = {} as Firestore; // Dummy Firestore
     console.warn("Firestore not initialized, using dummy instance. Ensure Firebase config is correct and environment is suitable.");
  } else {
    // If already in fallback, don't throw again, just log.
    if (app.options.projectId?.startsWith("fallback-project")) {
        db = {} as Firestore;
        console.warn("Using dummy Firestore due to earlier initialization failure.");
    } else {
        throw error; // Re-throw if it's not a known safe-to-ignore scenario
    }
  }
}


export { app, db /*, auth */ };
