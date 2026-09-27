/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: '#5b4bff',
        'primary-hover': '#4938e6',
        secondary: '#eef1ff',

        // Accent (Amber CTA)
        cta: '#ffc107',
        'cta-hover': '#e6ac00',
        'cta-text': '#4a3500',

        // Status
        success: '#22c55e',
        warning: '#f59e0b',

        // Neutrals — backgrounds
        'bg-main': '#f8f9fc',
        'bg-card': '#ffffff',
        'bg-soft': '#eef1ff',
        'bg-nav': '#ffffff',

        // Neutrals — text
        'text-primary': '#1f2937',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',

        // Neutrals — borders
        border: '#e5e7eb',
        divider: '#eef2f7',

        // Design tokens — the current palette. `danger`, `danger-soft`,
        // `success-soft` and `warning-soft` are defined here rather than in
        // the older groups above, which some components/screens still use
        // until they move onto this set. Dark text shades are named `-ink`
        // (e.g. `danger-ink`).
        ink: '#101114',
        'ink-hi': '#1C1D23',
        paper: '#FFFFFF',
        haze: '#F4F4F6',
        line: '#E7E7EC',
        muted: '#71727C',
        'muted-dark': '#9A9BA6',
        signal: '#FF4A1C',
        'signal-soft': '#FFF1EC',
        'signal-ink': '#8A3517',
        danger: '#E5484D',
        'danger-soft': '#FDECEC',
        'danger-ink': '#C22F35',
        'success-soft': '#E8F6EE',
        'success-ink': '#16794C',
        'warning-soft': '#FFF3DF',
        'warning-ink': '#96570A',

        // TextInput's placeholder text, named so it can be styled by class
        // name instead of a raw hex.
        placeholder: '#A3A4AE',

        // PasswordStrengthMeter's medium bar fill. Its label text uses
        // `warning-ink`; the fill has no other token of its own.
        'strength-medium': '#E8A33D',
      },
      spacing: {
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',

        // Design-token radii. `lg`/`md`/`sm` would collide with the older
        // scale above at different pixel values, and Button/Card/Dropdown/
        // TextInput/ComponentDemoScreen still use those older names, so this
        // scale is namespaced `ds-*` until those components move onto it, at
        // which point the older keys above can be retired and this namespace
        // dropped.
        'ds-sheet': '34px',
        'ds-lg': '18px',
        'ds-card': '22px',
        'ds-md': '14px',
        'ds-sm': '10px',
      },
      fontFamily: {
        // Design tokens. `display` is always used at weight 700 in
        // the type scale below, so it maps directly to the bold static
        // font loaded in App.js rather than a separate weight utility.
        display: ['SchibstedGrotesk_700Bold'],
        body: ['InterTight_400Regular'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',

        // Design-token type scale.
        h1: ['42px', { lineHeight: '1.02', letterSpacing: '-0.042em', fontWeight: '700' }],
        title: ['19px', { letterSpacing: '-0.02em', fontWeight: '700' }],
        wordmark: ['16px', { letterSpacing: '-0.02em', fontWeight: '700' }],
        body: '16px',
        lede: ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        desc: ['14px', { lineHeight: '1.45', fontWeight: '400' }],
        label: ['13px', { fontWeight: '600' }],
        caption: ['12px', { letterSpacing: '0.04em', fontWeight: '600' }],
        overline: ['11px', { letterSpacing: '0.06em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
