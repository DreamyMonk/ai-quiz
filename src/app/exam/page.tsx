
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ExamBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the homepage as /exam is not meant to be accessed directly
    router.replace('/');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting...</p>
    </div>
  );
}
