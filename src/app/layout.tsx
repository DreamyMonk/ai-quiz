
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { LayoutContentWrapper } from '@/components/layout/LayoutContentWrapper'; // Import the new component

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
          <LayoutProvider> {/* My LayoutProvider */}
            <LayoutContentWrapper>{children}</LayoutContentWrapper>
          </LayoutProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
