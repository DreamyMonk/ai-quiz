
"use client";

import Link from 'next/link';
import { BookMarked, UserCircle, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { AuthModal } from '@/components/auth/AuthModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const { user, signOut, loading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signIn' | 'signUp'>('signIn');

  const handleOpenAuthModal = (view: 'signIn' | 'signUp') => {
    setAuthModalView(view);
    setIsAuthModalOpen(true);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <header className="bg-card border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-accent transition-colors">
            <BookMarked className="h-7 w-7" />
            <span>AI Quiz Maker</span>
          </Link>
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
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
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
                  {/* <DropdownMenuItem>Profile</DropdownMenuItem> */}
                  {/* <DropdownMenuItem>Settings</DropdownMenuItem> */}
                  {/* <DropdownMenuSeparator /> */}
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
    </>
  );
}
