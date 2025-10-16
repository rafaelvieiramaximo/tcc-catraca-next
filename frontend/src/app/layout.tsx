import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppAuthProvider } from './contexts/app-auth-context';
import { AuthProvider } from './contexts/auth-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FATEC Catraca - Sistema',
  description: 'Sistema de controle de acesso FATEC Itu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="min-h-screen min-w-full flex flex-col">
          <AppAuthProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AppAuthProvider>
        </div>
      </body>
    </html>
  );
}
