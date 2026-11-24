import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/brand/Logo';
import { ar } from '@/i18n/messages/ar';
import { site } from '@/lib/site';

const navItems = [
  { href: '#tokens', label: ar.nav.tokens },
  { href: '#typography', label: ar.nav.typography },
  { href: '#components', label: ar.nav.components },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <Link href="/" aria-label={ar.nav.home} className="inline-flex items-center">
          <Logo variant="primary" size={36} withWordmark wordmarkLang="ar" />
        </Link>
        <nav aria-label={ar.nav.primary} className="hidden items-center gap-6 text-sm sm:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-medium text-text-secondary hover:text-text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Button href="#join-preview" size="md">
          {site.ctaLabel}
        </Button>
      </Container>
    </header>
  );
}
