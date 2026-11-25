import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { DesktopNavLinks } from '@/components/layout/NavLinks';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ar } from '@/i18n/messages/ar';
import { site } from '@/lib/site';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface">
      <Container className="relative flex min-h-16 items-center justify-between gap-x-2 py-2">
        <Link href="/" aria-label={ar.nav.home} className="inline-flex items-center">
          <Logo variant="primary" size={28} withWordmark wordmarkLang="ar" />
        </Link>
        <nav aria-label={ar.nav.primary} className="hidden md:block">
          <DesktopNavLinks items={ar.nav.items} />
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/join" size="md" className="whitespace-nowrap px-4 text-sm sm:px-5 sm:text-base">
            {site.ctaLabel}
          </Button>
          <MobileMenu
            items={ar.nav.items}
            legalItems={ar.footer.legal}
            labels={{ open: ar.nav.menu, close: ar.nav.closeMenu, panel: ar.nav.mobile }}
            ctaLabel={site.ctaLabel}
          />
        </div>
      </Container>
    </header>
  );
}
