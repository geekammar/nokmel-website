import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ar } from '@/i18n/messages/ar';

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main-content"
        className="skip-link rounded-control bg-action-primary-bg px-4 py-2 text-sm font-semibold"
        style={{ color: 'var(--action-primary-fg)' }}
      >
        {ar.common.skipLink}
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
