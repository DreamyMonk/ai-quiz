
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
  const { signInWithEmail, sendPasswordResetEmail } = useAuth();
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
  
  const handlePasswordReset = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({ title: "Email Required", description: "Please enter your email address to reset password.", variant: "destructive" });
      form.setFocus("email");
      return;
    }
    setIsLoading(true); // Indicate loading for password reset
    try {
      await sendPasswordResetEmail(email);
      toast({ title: "Password Reset Email Sent", description: "Check your inbox for instructions to reset your password." });
    } catch (error: any) {
      toast({ title: "Password Reset Failed", description: error.message || "Could not send password reset email.", variant: "destructive" });
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email-signin">Email</Label>
        <Input id="email-signin" type="email" {...form.register("email")} placeholder="you@example.com" disabled={isLoading} />
        {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
      </div>
      <div>
        <Label htmlFor="password-signin">Password</Label>
        <Input id="password-signin" type="password" {...form.register("password")} placeholder="••••••••" disabled={isLoading} />
        {form.formState.errors.password && <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Sign In
      </Button>
      <div className="text-sm text-center">
        <button type="button" onClick={handlePasswordReset} className="font-medium text-primary hover:underline" disabled={isLoading}>
          Forgot password?
        </button>
      </div>
      <div className="text-sm text-center">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToSignUp} className="font-medium text-primary hover:underline" disabled={isLoading}>
          Sign Up
        </button>
      </div>
    </form>
  );
}
