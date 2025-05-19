
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
  const { signUpWithEmail } = useAuth(); // sendVerificationEmail is called within signUpWithEmail now
  const { toast } = useToast();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit: SubmitHandler<SignUpFormValues> = async (data) => {
    setIsLoading(true);
    try {
      const signedUpUser = await signUpWithEmail(data.email, data.password, data.displayName || undefined);
      if (signedUpUser) {
        toast({ 
          title: "Account Created!", 
          description: "Welcome! A verification email has been sent. Please check your inbox." 
        });
        onSuccess(); // This will close the modal
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
