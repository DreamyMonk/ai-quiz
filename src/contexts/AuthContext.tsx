
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth } from '@/lib/firebase'; // Assuming auth is exported from firebase.ts
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface User extends FirebaseUser {
  // Add any custom user properties if needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User | null>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User | null>;
  signInWithEmail: (email: string, password: string) => Promise<User | null>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
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
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user as User);
      return result.user as User;
    } catch (error: any) {
      console.error("AuthContext: Google sign-in error object:", error);
      console.error("AuthContext: Google sign-in error code:", error.code);
      console.error("AuthContext: Google sign-in error message:", error.message);
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string): Promise<User | null> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user && displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      setUser(userCredential.user as User);
      return userCredential.user as User;
    } catch (error) {
      console.error("Error signing up:", error);
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
      throw error; 
    } finally {
      setLoading(false);
    }
  };
  
  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    if (!auth) throw new Error("Firebase Auth not initialized.");
    try {
      await firebaseSendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
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
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordResetEmail, signOut }}>
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
