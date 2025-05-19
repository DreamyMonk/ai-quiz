
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar'; // Added Sidebar components
import { QuizHistorySidebarContent } from '@/components/layout/QuizHistorySidebarContent'; // Added

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
        <AuthProvider>
          <SidebarProvider>
            <Sidebar>
              <QuizHistorySidebarContent />
            </Sidebar>
            <SidebarInset>
              <Header />
              <main className="container mx-auto p-4 md:p-8">
                {children}
              </main>
              <Toaster />
            </SidebarInset>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
