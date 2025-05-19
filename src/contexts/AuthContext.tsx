
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebase'; // Assuming auth is exported from firebase.ts
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification, // Added
  updateProfile
} from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface User extends FirebaseUser {
  // Add any custom user properties if needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>; // Added
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      console.error("AuthContext: Firebase Auth is not initialized!");
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser as User | null);
      setLoading(false);
      if (firebaseUser) {
        console.log("Auth State Changed: User logged in. Email verified:", firebaseUser.emailVerified);
      }
    });
    return () => unsubscribe();
  }, []);

  const signUpWithEmail = async (email: string, password: string, displayName?: string): Promise<User | null> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user && displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      // User is available in userCredential.user
      // Send verification email after successful sign-up
      if (userCredential.user) {
         await firebaseSendEmailVerification(userCredential.user);
         console.log("AuthContext: Verification email sent to new user:", userCredential.user.email);
      }
      setUser(userCredential.user as User); // This will trigger re-render and update context
      return userCredential.user as User;
    } catch (error) {
      console.error("Error signing up:", error);
      console.error("Firebase error code:", (error as any).code);
      console.error("Firebase error message:", (error as any).message);
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string): Promise<User | null> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user as User);
      return userCredential.user as User;
    } catch (error) {
      console.error("Error signing in:", error);
      console.error("Firebase error code:", (error as any).code);
      console.error("Firebase error message:", (error as any).message);
      throw error; 
    } finally {
      setLoading(false);
    }
  };
  
  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      console.log("AuthContext: Password reset email sent via Firebase for:", email);
    } catch (error: any) {
      console.error("Error sending password reset email via Firebase:", error);
      console.error("Firebase error code:", error.code);
      console.error("Firebase error message:", error.message);
      throw error;
    }
  };

  const sendVerificationEmail = async (): Promise<void> => {
    if (!auth || !auth.currentUser) {
      throw new Error("User not logged in or Firebase Auth not initialized.");
    }
    try {
      await firebaseSendEmailVerification(auth.currentUser);
      console.log("AuthContext: Verification email sent to:", auth.currentUser.email);
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      console.error("Firebase error code:", error.code);
      console.error("Firebase error message:", error.message);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !auth) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-destructive mb-4" />
        <p className="text-lg text-destructive-foreground">Auth service failed to initialize. Check console.</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUpWithEmail, signInWithEmail, sendPasswordResetEmail, sendVerificationEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
