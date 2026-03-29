import type { Metadata } from 'next';
import './globals.css';
import SplashScreen from '@/components/ui/SplashScreen';

export const metadata: Metadata = {
  title: 'Dominion Edge Holdings — Acquisition OS',
  description: 'Private equity-grade acquisition command center for disciplined solo operators.',
  robots: 'noindex',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        <SplashScreen />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
