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

describe('homepage product-led composition', () => {
  it('keeps the approved section order and removes the old problems column', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    const sections = [
      'data-testid="product-hero"',
      'data-testid="benefit-card"',
      'id="how-it-works"',
      'الانضمام المبكر قبل أي تسعير',
      'id="faq"',
      'جاهز تخلّي',
    ];
    let previous = -1;
    for (const marker of sections) {
      const index = html.indexOf(marker);
      expect(index, marker).toBeGreaterThan(previous);
      previous = index;
    }
    expect(html).not.toContain('قبل نكمّل');
    expect(html).toContain('لماذا نكمّل؟');
    expect((html.match(/data-testid="benefit-card"/g) ?? []).length).toBe(4);
  });

  it('renders no product visual, assets or empty column when the preference is hidden', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    expect(html).not.toContain('data-testid="product-visual"');
    expect(html).not.toContain('data-testid="merchant-order-card"');
    expect(html).not.toContain('hoodie');
    expect(html).toContain('data-layout="text-only"');
    expect(html).not.toContain('data-layout="two-column"');
    expect(html).not.toContain('id="product-showcase"');
    expect(html).not.toContain('href="#product-showcase"');
  });

  it('renders the dual product visual beside the copy when enabled', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(true)} />);
    expect(html).toContain('data-layout="two-column"');
    expect(html).toContain('data-testid="product-visual"');
    expect(html).toContain('data-testid="merchant-order-card"');
    expect(html).toContain('hoodie.avif');
    expect(html).toContain('NW-1042');
    expect(html).not.toContain('data-layout="text-only"');
  });

  it('preserves the approved hero, early-access note and primary join CTA', () => {
    const html = renderToStaticMarkup(<HomeView content={homeContent(false)} />);
    expect(html).toContain('متجرك في المحادثة. وإدارة طلباتك في مكان واحد.');
    expect(html).toContain('خلي بزنسك يكمل.');
    expect(html).toContain('اعرض منتجاتك لعملائك في تيليجرام');
    expect(html).toContain('اطلب الانضمام');
    expect(html).toContain('href="/join"');
    expect(html).toContain('استكشف المميزات');
    expect(html).toContain('href="/features"');
    expect(html).toContain('الانضمام المبكر لا يتضمن دفعاً أو اشتراكاً في هذه المرحلة.');
    expect(html).toContain('id="how-it-works"');
  });
});
