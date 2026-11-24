import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/brand-tokens.css';
import './globals.css';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { defaultLocale, dirByLocale } from '@/i18n/config';
import { ar } from '@/i18n/messages/ar';
import { home } from '@/content/ar/home';
import { readTokens } from '@/lib/brand-tokens';
import { site, siteUrl } from '@/lib/site';

const plexSansArabic = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-plex-ar',
  display: 'swap',
});

const geist = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2' },
    { path: '../../node_modules/@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2' },
  ],
  variable: '--font-geist',
  display: 'swap',
});

const alexandria = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/alexandria/files/alexandria-arabic-wght-normal.woff2' },
    { path: '../../node_modules/@fontsource-variable/alexandria/files/alexandria-latin-wght-normal.woff2' },
    { path: '../../node_modules/@fontsource-variable/alexandria/files/alexandria-latin-ext-wght-normal.woff2' },
  ],
  variable: '--font-alexandria',
  display: 'swap',
});

const tokens = readTokens();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.nameAr} (${site.name})`,
    template: `%s — ${site.name}`,
  },
  description: home.hero.subheadline,
  alternates: { canonical: '/' },
  openGraph: {
    siteName: site.name,
    url: siteUrl,
    locale: 'ar_AR',
    type: 'website',
    images: [
      {
        url: '/brand/logos/nokmel-mark-transparent-1024.png',
        width: 1024,
        height: 785,
        alt: 'Nokmel Completion Mark',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: tokens.light['--brand-primary'],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={defaultLocale}
      dir={dirByLocale[defaultLocale]}
      className={`${plexSansArabic.variable} ${geist.variable} ${alexandria.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#main-content" className="skip-link rounded-control bg-action-primary-bg px-4 py-2 text-sm font-semibold" style={{ color: 'var(--action-primary-fg)' }}>
          {ar.common.skipLink}
        </a>
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
