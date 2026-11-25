import type { Metadata } from 'next';
import { ContactView } from '@/components/pages/ContactView';
import { contact } from '@/content/ar/contact';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'تواصل معنا — نكمّل',
  description: contact.hero.lead,
  path: '/contact',
});

export default async function ContactPage() {
  const content = await getPublishedPageContent('contact', 'ar');
  return <ContactView content={content} />;
}
