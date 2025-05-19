
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth'; // Added getAuth

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
let db: Firestore | null = null;
let auth: Auth | null = null; // Initialize auth as null

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
    app = { options: { projectId: "initialization-failed" } } as FirebaseApp;
  }
} else {
  app = getApps()[0];
  console.log("Firebase: App already initialized. Project ID:", app.options.projectId);
}

if (app && app.options && app.options.projectId && app.options.projectId !== "initialization-failed") {
  try {
    console.log("Firebase: Attempting to get Firestore instance...");
    db = getFirestore(app);
    console.log("Firebase: Firestore instance obtained successfully.");
    
    console.log("Firebase: Attempting to get Auth instance...");
    auth = getAuth(app); // Initialize Auth
    console.log("Firebase: Auth instance obtained successfully.");

  } catch (error: any) {
    console.error("Firebase: CRITICAL - Firestore or Auth instance initialization error.", error);
    if (error.message.includes("Firestore")) {
      db = null; // Ensure db is null if its init failed
    }
    if (error.message.includes("Auth")) {
        auth = null; // Ensure auth is null if its init failed
    }
     console.error("Firebase error code:", error.code);
    console.error("Firebase error message:", error.message);
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
} else {
  if (app && app.options && app.options.projectId === "initialization-failed") {
    console.error("Firebase: App initialization failed previously. Skipping Firestore/Auth initialization.");
  } else {
    console.warn("Firebase: App not properly initialized or projectId is invalid. Skipping Firestore/Auth initialization.");
    console.error("Firebase: App object details:", JSON.stringify(app, null, 2));
  }
}

export { app, db, auth };
