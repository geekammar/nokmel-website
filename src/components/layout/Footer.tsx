import { Container } from '@/components/ui/Container';
import { Logo } from '@/components/brand/Logo';
import { ar } from '@/i18n/messages/ar';

const footerNav = [
  { href: '#tokens', label: ar.nav.tokens },
  { href: '#typography', label: ar.nav.typography },
  { href: '#components', label: ar.nav.components },
  { href: '#join-preview', label: ar.joinPreview.title },
];

export function Footer() {
  return (
    <footer data-theme="dark" className="bg-page text-text-primary">
      <Container className="flex flex-col gap-8 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo variant="dark-surface" size={44} withWordmark wordmarkLang="ar" />
          <nav aria-label={ar.nav.primary} className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {footerNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-text-secondary hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-6 text-sm text-text-secondary">
          <p>{ar.footer.tagline}</p>
          <p>{ar.footer.wordmarkNote}</p>
          <p>{ar.footer.rights}</p>
        </div>
      </Container>
    </footer>
  );
}
