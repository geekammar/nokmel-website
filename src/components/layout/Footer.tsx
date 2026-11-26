import Link from 'next/link';
import { AnalyticsPreferences } from '@/components/analytics/AnalyticsPreferences';
import { Logo } from '@/components/brand/Logo';
import { Container } from '@/components/ui/Container';
import { ar } from '@/i18n/messages/ar';
import { loadPublicSettings } from '@/lib/settings/service';
import { publicSettingsChannels } from '@/lib/settings/model';

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="text-text-secondary hover:text-text-primary">
        {label}
      </Link>
    </li>
  );
}

function externalProps(href: string): { target?: '_blank'; rel?: 'noopener noreferrer' } {
  return href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

export async function Footer({
  analyticsAvailable = false,
}: {
  analyticsAvailable?: boolean;
}) {
  const result = await loadPublicSettings();
  const channels = publicSettingsChannels(result.settings);
  return (
    <footer data-theme="dark" className="bg-page text-text-primary">
      <Container className="flex flex-col gap-10 py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <Logo variant="dark-surface" size={40} withWordmark wordmarkLang="ar" />
            <p className="max-w-sm leading-relaxed text-text-secondary">{ar.footer.description}</p>
            <p className="text-brand-highlight">{ar.footer.tagline}</p>
          </div>
          <nav aria-label={ar.nav.footerExplore}>
            <h2 className="text-sm font-bold">{ar.footer.exploreTitle}</h2>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {ar.footer.explore.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </nav>
          <nav aria-label={ar.footer.legalTitle}>
            <h2 className="text-sm font-bold">{ar.footer.legalTitle}</h2>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0 text-sm">
              {ar.footer.legal.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </nav>
        </div>
        {channels.length > 0 ? (
          <nav aria-label={ar.footer.contactTitle} data-testid="footer-contact">
            <h2 className="text-sm font-bold">{ar.footer.contactTitle}</h2>
            <ul className="mt-3 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm">
              {channels.map((channel) => (
                <li key={channel.type}>
                  <a
                    href={channel.href}
                    className="break-all text-text-secondary hover:text-text-primary"
                    {...externalProps(channel.href)}
                  >
                    {channel.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <AnalyticsPreferences available={analyticsAvailable} />
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-6 text-sm text-text-secondary">
          <p>{ar.footer.earlyAccessNote}</p>
          <p>{ar.footer.wordmarkNote}</p>
          <p>{ar.footer.rights}</p>
        </div>
      </Container>
    </footer>
  );
}
