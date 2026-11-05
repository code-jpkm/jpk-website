import localFont from 'next/font/local';
import './globals.css';

const brandFont = localFont({
  src: [
    { path: './fonts/titilliumweb-fa83a2e0.woff2', weight: '400', style: 'normal' },
    { path: './fonts/titilliumweb-6eb57c12.woff2', weight: '600', style: 'normal' },
    { path: './fonts/titilliumweb-b3a162f7.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-brand',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});

export const metadata = {
  title: { default: 'JPK Admin', template: '%s · JPK Admin' },
  description: 'JPK Metallics admin: JPK Updates, products, careers and enquiries.',
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#203444', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={brandFont.variable}>
      <body>{children}</body>
    </html>
  );
}
