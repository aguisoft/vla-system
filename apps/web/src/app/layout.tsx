import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VLA Virtual Office',
  description: 'Oficina virtual interactiva de VLA Academy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
