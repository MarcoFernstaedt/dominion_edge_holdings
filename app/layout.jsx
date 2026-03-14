import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import Sidebar from '@/components/layout/Sidebar';

export const metadata = {
  title: 'Dominion Edge Holdings — QLA Platform',
  description: "Marco Fernstaedt's QLA acquisition platform for Phoenix pest control consolidation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <main style={{ flex: 1, overflowY: 'auto', background: '#0A0A0A' }}>
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
