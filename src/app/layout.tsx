
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a common, clean sans-serif font
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AI Quiz Maker',
  description: 'Generate MCQs and test your knowledge with AI!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Header />
        <main className="container mx-auto p-4 md:p-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
