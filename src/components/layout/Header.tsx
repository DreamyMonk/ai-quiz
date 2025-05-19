
import Link from 'next/link';
import { BookMarked } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-card border-b shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-accent transition-colors">
          <BookMarked className="h-7 w-7" />
          <span>AI Quiz Maker</span>
        </Link>
      </div>
    </header>
  );
}
