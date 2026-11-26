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

describe('homepage showcase visibility', () => {
  it('renders no showcase container or client action when hidden', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    expect(html).not.toContain('id="product-showcase"');
    expect(html).not.toContain('data-testid="product-showcase"');
    expect(html).not.toContain('showcase-action-product');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('id="how-it-works"');
  });

  it('renders the existing showcase and its controls when visible', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(true)} />);
    expect(html).toContain('id="product-showcase"');
    expect(html).toContain('data-testid="product-showcase"');
    expect(html).toContain('data-testid="showcase-action-product"');
    expect(html).toContain('بيانات اصطناعية');
  });

  it('falls back from a missing showcase anchor to the visible how-it-works section', () => {
    const content = structuredClone(homeContent(false));
    content.hero.secondaryCta = {
      label: 'شوف كيف يعمل',
      href: '#product-showcase',
    };
    const html = renderToStaticMarkup(<HomeView content={content} />);
    expect(html).not.toContain('href="#product-showcase"');
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('شوف كيف يعمل');
  });
});
