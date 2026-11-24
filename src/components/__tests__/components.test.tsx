import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextLink } from '@/components/ui/TextLink';
import { Logo } from '@/components/brand/Logo';
import { Wordmark } from '@/components/brand/Wordmark';

describe('design system components', () => {
  it('Button renders a <button> with token-driven classes by default', () => {
    const html = renderToStaticMarkup(<Button>CTA</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('bg-action-primary-bg');
    expect(html).toContain('text-action-primary-fg');
    expect(html).toContain('min-h-control');
    expect(html).toContain('rounded-control');
  });

  it('Button renders an <a> when href is provided and supports disabled state', () => {
    const link = renderToStaticMarkup(<Button href="#join-preview">Join</Button>);
    expect(link).toContain('<a');
    expect(link).toContain('href="#join-preview"');
    const disabled = renderToStaticMarkup(<Button disabled>Off</Button>);
    expect(disabled).toContain('disabled');
    expect(disabled).toContain('disabled:opacity-60');
  });

  it('Button secondary variant uses the interactive border token', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Sec</Button>);
    expect(html).toContain('border-border-interactive');
  });

  it('Input associates its label with the control and exposes error state', () => {
    const html = renderToStaticMarkup(<Input label="Name" name="name" error="Required" />);
    expect(html).toContain('<label');
    expect(html).toContain('for="name"');
    expect(html).toContain('id="name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('border-border-interactive');
  });

  it('Textarea associates its label with the control', () => {
    const html = renderToStaticMarkup(<Textarea label="Message" name="message" />);
    expect(html).toContain('for="message"');
    expect(html).toContain('<textarea');
  });

  it('TextLink uses the secondary interaction color', () => {
    const html = renderToStaticMarkup(<TextLink href="#tokens">Tokens</TextLink>);
    expect(html).toContain('text-action-secondary');
  });

  it('Card uses surface, subtle border and card radius tokens', () => {
    const html = renderToStaticMarkup(<Card>x</Card>);
    expect(html).toContain('bg-surface');
    expect(html).toContain('border-border-subtle');
    expect(html).toContain('rounded-card');
  });

  it('Section dark tone applies data-theme="dark"', () => {
    const html = renderToStaticMarkup(<Section tone="dark">x</Section>);
    expect(html).toContain('data-theme="dark"');
  });

  it('Logo references committed mark assets and marks the wordmark as temporary', () => {
    const logo = renderToStaticMarkup(<Logo variant="primary" size={40} withWordmark />);
    expect(logo).toContain('/brand/logos/nokmel-mark-primary-color.svg');
    const wordmark = renderToStaticMarkup(<Wordmark lang="ar" />);
    expect(wordmark).toContain('data-wordmark="temporary"');
    expect(wordmark).toContain('font-wordmarkAr');
    const wordmarkEn = renderToStaticMarkup(<Wordmark lang="en" />);
    expect(wordmarkEn).toContain('lang="en"');
    expect(wordmarkEn).toContain('dir="ltr"');
    expect(wordmarkEn).toContain('font-wordmarkEn');
  });
});
