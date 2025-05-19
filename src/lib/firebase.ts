
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
// Uncomment and use if you plan to add Firebase Authentication
// import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDVPUmXes77UsGu3QYuASM02bxGwdHTfDs",
  authDomain: "ai-quiz-faa35.firebaseapp.com",
  projectId: "ai-quiz-faa35",
  storageBucket: "ai-quiz-faa35.firebasestorage.app",
  messagingSenderId: "1049520882301",
  appId: "1:1049520882301:web:05395861301101560e6714",
  measurementId: "G-KS5531H2PG"
};

let app: FirebaseApp;
let db: Firestore | null = null; // Initialize db as null
// let auth: Auth;

if (!getApps().length) {
  try {
    console.log("Firebase: Attempting to initialize app with config:", firebaseConfig);
    app = initializeApp(firebaseConfig);
    console.log("Firebase: App initialized successfully. Project ID:", app.options.projectId);
  } catch (error: any) {
    console.error("Firebase: CRITICAL - App initialization error.", error);
    console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    // Assign a temporary app object to prevent crashes if 'app' is accessed later, though it's non-functional.
    app = { options: { projectId: "initialization-failed" } } as FirebaseApp; // Non-functional app with a distinct projectId
  }
} else {
  app = getApps()[0];
  console.log("Firebase: App already initialized. Project ID:", app.options.projectId);
}

// Only attempt to get Firestore if app initialization seemed to succeed
if (app && app.options && app.options.projectId && app.options.projectId !== "initialization-failed") {
  try {
    console.log("Firebase: Attempting to get Firestore instance...");
    db = getFirestore(app);
    console.log("Firebase: Firestore instance obtained successfully. DB Object:", db); // Log the db object
    // auth = getAuth(app); // Initialize Auth if needed
  } catch (error: any) {
    console.error("Firebase: CRITICAL - Firestore instance initialization error.", error);
    console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    // db remains null if Firestore init fails
  }
} else {
  if (app && app.options && app.options.projectId === "initialization-failed") {
    console.error("Firebase: App initialization failed previously. Skipping Firestore initialization.");
  } else {
    console.warn("Firebase: App not properly initialized or projectId is invalid. Skipping Firestore initialization.");
    console.error("Firebase: App object details:", app);
  }
}

export { app, db /*, auth */ };
