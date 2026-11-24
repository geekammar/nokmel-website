import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { ar } from '@/i18n/messages/ar';
import { site } from '@/lib/site';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface">
      <Container className="relative flex min-h-16 items-center justify-between gap-x-4 gap-y-2 py-2">
        <Link href="/" aria-label={ar.nav.home} className="inline-flex items-center">
          <Logo variant="primary" size={30} withWordmark wordmarkLang="ar" />
        </Link>
        <nav aria-label={ar.nav.primary} className="hidden items-center gap-6 text-sm md:flex">
          {ar.nav.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-medium text-text-secondary hover:text-text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/join" size="md" className="px-4 text-sm sm:px-5 sm:text-base">
            {site.ctaLabel}
          </Button>
          <details data-nav className="relative md:hidden" data-testid="mobile-nav">
            <summary className="flex min-h-control cursor-pointer list-none items-center gap-2 rounded-control border border-border-interactive px-3 font-semibold [&::-webkit-details-marker]:hidden">
              <span className="details-closed-only">{ar.nav.menu}</span>
              <span className="details-open-only">{ar.nav.closeMenu}</span>
              <span aria-hidden="true" className="nav-menu-chevron text-text-secondary">
                ▾
              </span>
            </summary>
            <nav
              aria-label={ar.nav.mobile}
              data-testid="mobile-nav-panel"
              className="nav-mobile-panel absolute start-0 end-0 top-full z-50 mt-2 flex-col gap-1 rounded-card border border-border-subtle bg-surface p-2 text-base"
            >
              {ar.nav.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-control items-center rounded-control px-4 font-medium text-text-primary hover:bg-page"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-1 border-t border-border-subtle" />
              {ar.footer.legal.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-control items-center rounded-control px-4 text-sm text-text-secondary hover:bg-page"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </Container>
    </header>
  );
}
