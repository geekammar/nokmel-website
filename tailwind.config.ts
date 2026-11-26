import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          highlight: 'var(--brand-highlight)',
        },
        action: {
          primary: {
            bg: 'var(--action-primary-bg)',
            fg: 'var(--action-primary-fg)',
            'bg-hover': 'var(--action-primary-bg-hover)',
            'bg-active': 'var(--action-primary-bg-active)',
          },
          secondary: 'var(--action-secondary)',
        },
        page: 'var(--color-background)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          input: 'var(--color-border-input)',
          interactive: 'var(--color-border-interactive)',
        },
        focus: 'var(--color-focus-ring)',
        status: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          error: 'var(--color-error)',
          info: 'var(--color-info)',
        },
      },
      borderRadius: {
        card: 'var(--corner-card)',
        control: 'var(--corner-control)',
      },
      minHeight: {
        control: 'var(--control-min-height)',
      },
      maxWidth: {
        container: '72rem',
      },
      fontFamily: {
        ar: ['var(--font-ar)'],
        en: ['var(--font-en)'],
        wordmarkAr: ['var(--font-wordmark-ar)'],
        wordmarkEn: ['var(--font-wordmark-en)'],
      },
    },
  },
  plugins: [],
};

export default config;
