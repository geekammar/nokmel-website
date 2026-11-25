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

  it('Button renders an <a> when href is provided and supports disabled state on native buttons', () => {
    const link = renderToStaticMarkup(<Button href="#join-preview">Join</Button>);
    expect(link).toContain('<a');
    expect(link).toContain('href="#join-preview"');
    expect(link).not.toContain('disabled=""');
    const disabled = renderToStaticMarkup(<Button disabled>Off</Button>);
    expect(disabled).toContain('<button');
    expect(disabled).toContain('disabled=""');
    expect(disabled).toContain('disabled:opacity-60');
  });

  it('Button rejects disabled link-style buttons at runtime and at the type level', () => {
    expect(() =>
      renderToStaticMarkup(
        <Button href="#x" {...({ disabled: true } as Record<string, unknown>)}>
          x
        </Button>,
      ),
    ).toThrow(/disabled link-style buttons are not supported/);
    // @ts-expect-error disabled is not a valid prop on the link variant
    const invalid = <Button href="#x" disabled>x</Button>;
    expect(invalid).toBeTruthy();
  });

  it('Button secondary variant uses the interactive border token', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Sec</Button>);
    expect(html).toContain('border-border-interactive');
  });

  it('Input associates its label with the control and exposes error state', () => {
    const html = renderToStaticMarkup(<Input label="Name" id="name" name="name" error="Required" />);
    expect(html).toContain('<label');
    expect(html).toContain('for="name"');
    expect(html).toContain('id="name"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-error"');
    expect(html).toContain('id="name-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('border-border-interactive');
  });

  it('Input falls back to useId(), never to name, for the control id', () => {
    const html = renderToStaticMarkup(<Input label="Name" name="name" />);
    expect(html).not.toContain('for="name"');
    expect(html).not.toContain('id="name"');
  });

  it('Input generates stable unique ids when no id is provided', () => {
    const html = renderToStaticMarkup(
      <>
        <Input label="A" />
        <Input label="B" />
      </>,
    );
    const ids = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    const fors = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(fors).toEqual(ids);
  });

  it('multiple controls with identical names keep unique ids and correct label/error associations', () => {
    const html = renderToStaticMarkup(
      <>
        <Input label="First phone" name="phone" error="Required" />
        <Input label="Second phone" name="phone" error="Invalid" />
        <Textarea label="First message" name="message" error="Required" />
        <Textarea label="Second message" name="message" error="Too long" />
      </>,
    );
    const inputs = [...html.matchAll(/<(?:input|textarea)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    const labels = [...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]);
    const errors = [...html.matchAll(/role="alert"/g)];
    expect(inputs).toHaveLength(4);
    expect(new Set(inputs).size).toBe(4);
    expect(labels).toEqual(inputs);
    expect(errors).toHaveLength(4);
    for (const id of inputs) {
      expect(html).toContain(`aria-describedby="${id}-error"`);
      expect(html).toContain(`id="${id}-error"`);
    }
  });

  it('Input keeps caller-provided aria-describedby alongside the error association', () => {
    const html = renderToStaticMarkup(
      <Input label="Name" id="name" name="name" error="Required" aria-describedby="hint" />,
    );
    expect(html).toContain('aria-describedby="hint name-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  it('Textarea generates stable unique ids and merges caller aria attributes with errors', () => {
    const html = renderToStaticMarkup(
      <>
        <Textarea label="A" />
        <Textarea label="B" error="Bad" aria-describedby="hint" />
      </>,
    );
    const ids = [...html.matchAll(/<textarea[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(html).toMatch(/aria-describedby="hint [^"]*-error"/);
    expect(html).toContain('aria-invalid="true"');
  });

  it('Textarea associates its label with the control via explicit id or useId()', () => {
    const explicit = renderToStaticMarkup(<Textarea label="Message" id="message" name="message" />);
    expect(explicit).toContain('for="message"');
    expect(explicit).toContain('<textarea');
    const generated = renderToStaticMarkup(<Textarea label="Message" name="message" />);
    expect(generated).not.toContain('for="message"');
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
