
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: 'signIn' | 'signUp';
}

export function AuthModal({ isOpen, onOpenChange, initialView = 'signIn' }: AuthModalProps) {
  const [view, setView] = useState<'signIn' | 'signUp'>(initialView);

  const switchToSignIn = () => setView('signIn');
  const switchToSignUp = () => setView('signUp');

  const handleSuccessfulAuth = () => {
    onOpenChange(false); // Close modal on successful sign-in/sign-up
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl text-center">
            {view === 'signIn' ? 'Welcome Back!' : 'Create an Account'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {view === 'signIn' 
              ? 'Sign in to continue to AI Quiz Maker.' 
              : 'Join us to create and take AI-powered quizzes.'}
          </DialogDescription>
        </DialogHeader>
        
        {view === 'signIn' ? (
          <SignInForm onSuccess={handleSuccessfulAuth} onSwitchToSignUp={switchToSignUp} />
        ) : (
          <SignUpForm onSuccess={handleSuccessfulAuth} onSwitchToSignIn={switchToSignIn} />
        )}
        
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
