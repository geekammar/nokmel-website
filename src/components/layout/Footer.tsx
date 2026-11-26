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
      <Link
        href={href}
        className="inline-flex min-h-control items-center text-sm text-text-secondary hover:text-text-primary"
      >
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
    <footer data-theme="dark" className="border-t border-border-subtle bg-page text-text-primary">
      <Container className="py-10 sm:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-x-12">
          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
            <Logo variant="dark-surface" size={36} withWordmark wordmarkLang="ar" />
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              {ar.footer.description}
            </p>
            <p className="text-sm font-semibold text-brand-highlight">{ar.footer.tagline}</p>
          </div>
          <nav aria-label={ar.nav.footerExplore}>
            <h2 className="text-sm font-bold">{ar.footer.exploreTitle}</h2>
            <ul className="mt-2 flex list-none flex-col p-0">
              {ar.footer.explore.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </nav>
          <nav aria-label={ar.footer.legalTitle}>
            <h2 className="text-sm font-bold">{ar.footer.legalTitle}</h2>
            <ul className="mt-2 flex list-none flex-col p-0">
              {ar.footer.legal.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </nav>
        </div>

        {channels.length > 0 ? (
          <nav
            aria-label={ar.footer.contactTitle}
            data-testid="footer-contact"
            className="mt-8 border-t border-border-subtle pt-5"
          >
            <h2 className="text-sm font-bold">{ar.footer.contactTitle}</h2>
            <ul className="mt-2 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
              {channels.map((channel) => (
                <li key={channel.type}>
                  <a
                    href={channel.href}
                    className="inline-flex min-h-control items-center break-all text-text-secondary hover:text-text-primary"
                    {...externalProps(channel.href)}
                  >
                    {channel.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 border-t border-border-subtle pt-6 lg:flex-row lg:items-center lg:justify-between">
          <AnalyticsPreferences available={analyticsAvailable} />
          <p className="text-sm text-text-secondary">{ar.footer.rights}</p>
        </div>
        <p className="mt-4 text-xs leading-5 text-text-secondary">
          {ar.footer.earlyAccessNote}
        </p>
      </Container>
    </footer>
  );
}
