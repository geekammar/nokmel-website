import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/brand-tokens.css';
import './globals.css';
import { THEME_COLOR_LIGHT } from '@/lib/viewport-theme';
import { site, siteUrl } from '@/lib/site';
import { home } from '@/content/ar/home';

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
  themeColor: THEME_COLOR_LIGHT,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexSansArabic.variable} ${geist.variable} ${alexandria.variable}`}
    >
      <body className="flex min-h-screen flex-col antialiased">{children}</body>
    </html>
  );
}
