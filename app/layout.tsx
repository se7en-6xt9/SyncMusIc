import type {Metadata} from 'next';
import './globals.css';
import { ThemeProvider } from '@/hooks/use-theme';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'SyncWave',
  description: 'Real-time synchronized music listening with friends using YouTube.',
  manifest: '/manifest.json',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-white dark:bg-[#0f0f0f] text-black dark:text-white transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ServiceWorkerRegister />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function ServiceWorkerRegister() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => console.log('SW registered: ', registration),
        (registrationError) => console.log('SW registration failed: ', registrationError)
      );
    });
  }
  return null;
}
