import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

export const metadata: Metadata = {
  title: 'Snapshort — Visual Bookmark Manager',
  description: 'Smart visual bookmark manager with automated headless screenshot preview',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

// Matches the manifest's theme_color so browser chrome agrees with the app shell.
export const viewport: Viewport = {
  themeColor: '#101418',
};

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* h-dvh tracks the mobile URL bar; 100vh (h-screen) is taller than the
          visible area on phones and would clip the bottom of the app. */}
      <body
        className={`${jakarta.variable} font-sans antialiased bg-[#ECEEF2] text-zinc-900 h-dvh overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
