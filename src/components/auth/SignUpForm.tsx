
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
import { Loader2, MailCheck, Send } from 'lucide-react';

const signUpSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }).optional(),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});
type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [signupStep, setSignupStep] = useState<'form' | 'verifyPrompt'>('form');
  const { user, signUpWithEmail, sendVerificationEmail } = useAuth();
  const { toast } = useToast();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const handleFinalSuccess = () => {
    onSuccess(); // Close the main AuthModal
    setSignupStep('form'); // Reset step for next time
    form.reset(); // Reset form fields
  };

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    setIsLoading(true);
    try {
      const signedUpUser = await signUpWithEmail(data.email, data.password, data.displayName || undefined);
      if (signedUpUser) {
        // Initial verification email is sent by signUpWithEmail
        toast({ 
          title: "Account Created!", 
          description: "Please check your email to verify your account." 
        });
        setSignupStep('verifyPrompt'); 
        // Do NOT call onSuccess here yet. It will be called when user clicks "Okay" in verifyPrompt step.
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      let description = error.message || "Could not create your account.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This email address is already in use. Please try signing in or use a different email.";
      }
      toast({ 
        title: "Sign Up Failed", 
        description: description, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (!user || user.emailVerified) return; // Should ideally have user here from AuthContext after signup
    setIsResendingEmail(true);
    try {
      await sendVerificationEmail();
      toast({
        title: "Verification Email Sent",
        description: "Please check your inbox (and spam folder).",
      });
    } catch (error: any) {
      toast({
        title: "Error Sending Email",
        description: error.message || "Could not resend verification email.",
        variant: "destructive",
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  if (signupStep === 'verifyPrompt') {
    return (
      <div className="space-y-6 text-center">
        <MailCheck className="mx-auto h-16 w-16 text-primary" />
        <h3 className="text-xl font-semibold">Verify Your Email</h3>
        <p className="text-muted-foreground">
          Your account has been created successfully! A verification email has been sent to{" "}
          <strong className="text-foreground">{user?.email || form.getValues("email")}</strong>.
          Please check your inbox (and spam folder) and click the link to verify your email address.
        </p>
        <p className="text-sm text-muted-foreground">
            Verifying your email helps secure your account and enables all features.
        </p>
        <div className="space-y-3 pt-4">
          <Button 
            onClick={handleResendVerificationEmail} 
            disabled={isResendingEmail} 
            variant="outline" 
            className="w-full"
          >
            {isResendingEmail ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Resend Verification Email
          </Button>
          <Button onClick={handleFinalSuccess} className="w-full">
            Okay, I'll Check My Email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="displayName-signup">Display Name (Optional)</Label>
        <Input id="displayName-signup" type="text" {...form.register("displayName")} placeholder="Your Name" disabled={isLoading} />
        {form.formState.errors.displayName && <p className="text-sm text-destructive mt-1">{form.formState.errors.displayName.message}</p>}
      </div>
      <div>
        <Label htmlFor="email-signup">Email</Label>
        <Input id="email-signup" type="email" {...form.register("email")} placeholder="you@example.com" disabled={isLoading} />
        {form.formState.errors.email && <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>}
      </div>
      <div>
        <Label htmlFor="password-signup">Password</Label>
        <Input id="password-signup" type="password" {...form.register("password")} placeholder="••••••••" disabled={isLoading} />
        {form.formState.errors.password && <p className="text-sm text-destructive mt-1">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign Up
      </Button>
       <div className="text-sm text-center">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToSignIn} className="font-medium text-primary hover:underline" disabled={isLoading}>
          Sign In
        </button>
      </div>
    </form>
  );
}
