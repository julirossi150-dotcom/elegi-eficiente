import type { Metadata, Viewport } from 'next';
import { Rubik } from 'next/font/google';
import { SITE } from '@/lib/site';
import './globals.css';

const rubik = Rubik({ subsets: ['latin'], variable: '--font-rubik', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${SITE.name} — comparador de eficiencia energética`, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: '#0a2627',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={rubik.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
