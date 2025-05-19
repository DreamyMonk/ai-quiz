
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const signInSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});
type SignInFormValues = z.infer<typeof signInSchema>;

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}

export function SignInForm({ onSuccess, onSwitchToSignUp }: SignInFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signInWithEmail, signInWithGoogle, sendPasswordResetEmail } = useAuth();
  const { toast } = useToast();

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit: SubmitHandler<SignInFormValues> = async (data) => {
    setIsLoading(true);
    try {
      await signInWithEmail(data.email, data.password);
      toast({ title: "Signed In", description: "Welcome back!" });
      onSuccess();
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({ title: "Sign In Failed", description: error.message || "Could not sign you in.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        toast({ title: "Signed In with Google", description: `Welcome, ${user.displayName || 'user'}!` });
        onSuccess();
      }
    } catch (error: any) {
      console.error("Google sign in error:", error);
      toast({ title: "Google Sign In Failed", description: error.message || "Could not sign you in with Google.", variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };
  
  const handlePasswordReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({ title: "Email Required", description: "Please enter your email address to reset password.", variant: "destructive" });
      form.setFocus("email");
      return;
    }
    try {
      await sendPasswordResetEmail(email);
      toast({ title: "Password Reset Email Sent", description: "Check your inbox for instructions to reset your password." });
    } catch (error: any) {
      toast({ title: "Password Reset Failed", description: error.message || "Could not send password reset email.", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email-signin">Email</Label>
        <Input id="email-signin" type="email" {...form.register("email")} placeholder="you@example.com" disabled={isLoading || isGoogleLoading} />
        {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
      </div>
      <div>
        <Label htmlFor="password-signin">Password</Label>
        <Input id="password-signin" type="password" {...form.register("password")} placeholder="••••••••" disabled={isLoading || isGoogleLoading} />
        {form.formState.errors.password && <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Sign In
      </Button>
      <Button variant="outline" type="button" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
        {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
          <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 398.8 0 256S110.3 0 244 0c72.5 0 132.8 29.4 177.8 75.5L373.3 128C340.7 99.4 298.2 80 244 80c-66.6 0-120.5 47.8-134.6 110.1H244v76.3h244z"></path>
          </svg>
        )}
        Sign In with Google
      </Button>
      <div className="text-sm text-center">
        <button type="button" onClick={handlePasswordReset} className="font-medium text-primary hover:underline" disabled={isLoading || isGoogleLoading}>
          Forgot password?
        </button>
      </div>
      <div className="text-sm text-center">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToSignUp} className="font-medium text-primary hover:underline" disabled={isLoading || isGoogleLoading}>
          Sign Up
        </button>
      </div>
    </form>
  );
}
