import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HomeView } from '@/components/pages/HomeView';
import {
  DEFAULT_FAQ_FOR_RENDER,
  composePageContent,
  defaultSectionPayloads,
} from '@/content/cms/registry';
import type { HomeContent } from '@/content/ar/home';

function homeContent(visible: boolean): HomeContent {
  const payloads = defaultSectionPayloads('home');
  payloads.showcase.visible = visible;
  return composePageContent('home', payloads, DEFAULT_FAQ_FOR_RENDER);
}

describe('homepage with unavailable showcase', () => {
  it('renders no showcase container, interactive content or broken anchor when hidden', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    expect(html).not.toContain('id="product-showcase"');
    expect(html).not.toContain('data-testid="product-showcase"');
    expect(html).not.toContain('showcase-action-product');
    expect(html).not.toContain('href="#product-showcase"');
    expect(html).not.toContain('الطلبات من المحادثة، والمتابعة من مكان واحد.');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('id="how-it-works"');
  });

  it('still renders no showcase when the stored visibility preference is enabled', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(true)} />);
    expect(html).not.toContain('id="product-showcase"');
    expect(html).not.toContain('data-testid="product-showcase"');
    expect(html).not.toContain('showcase-action-product');
    expect(html).not.toContain('href="#product-showcase"');
    expect(html).not.toContain('الطلبات من المحادثة، والمتابعة من مكان واحد.');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('id="how-it-works"');
  });

  it('preserves the approved hero, brand-only composition and primary join CTA', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    expect(html).toContain('متجرك في المحادثة. وبزنسك في مكان واحد.');
    expect(html).toContain('خلي بزنسك يكمل.');
    expect(html).toContain('اطلب الانضمام');
    expect(html).toContain('nokmel-mark-primary-color.svg');
    expect(html).toContain('شوف كيف يعمل');
  });
});
