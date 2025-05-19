
"use client";

import Link from 'next/link';
import { BookMarked, UserCircle, LogOut, Loader2, MailWarning, Send, LockKeyhole, PanelLeft } from 'lucide-react'; // Added LockKeyhole, PanelLeft
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'; // Added
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from '@/components/ui/sidebar'; // Added

export function Header() {
  const { user, signOut, loading, sendVerificationEmail } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signIn' | 'signUp'>('signIn');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false); // Added
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const { toast } = useToast();

  const handleOpenAuthModal = (view: 'signIn' | 'signUp') => {
    setAuthModalView(view);
    setIsAuthModalOpen(true);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleResendVerificationEmail = async () => {
    if (!user || user.emailVerified) return;
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

  return (
    <>
      <header className="bg-card border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="mr-2 md:hidden" /> {/* Sidebar trigger for mobile */}
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-accent transition-colors">
              <BookMarked className="h-7 w-7" />
              <span>AI Quiz Maker</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                      <AvatarFallback>{getInitials(user.displayName || user.email)}</AvatarFallback>
                    </Avatar>
                     {!user.emailVerified && (
                        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-yellow-400 ring-2 ring-card border-transparent" title="Email not verified">
                           <MailWarning className="h-full w-full p-0.5 text-yellow-900" />
                        </span>
                     )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!user.emailVerified && (
                    <>
                    <DropdownMenuItem onClick={handleResendVerificationEmail} disabled={isResendingEmail} className="cursor-pointer text-yellow-600 hover:!text-yellow-700 focus:!text-yellow-700 focus:!bg-yellow-50">
                      {isResendingEmail ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Resend Verification Email
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)} className="cursor-pointer">
                    <LockKeyhole className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" onClick={() => handleOpenAuthModal('signIn')}>
                  Sign In
                </Button>
                <Button onClick={() => handleOpenAuthModal('signUp')}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onOpenChange={setIsAuthModalOpen}
        initialView={authModalView}
      />
      <ChangePasswordModal // Added
        isOpen={isChangePasswordModalOpen}
        onOpenChange={setIsChangePasswordModalOpen}
      />
    </>
  );
}
