import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Primary backgrounds ──────────────────────────────────────────────
        bg: {
          primary:  '#0A0A0A',
          surface:  '#111111',
          elevated: '#1A1A1A',
        },
        // ── Borders ─────────────────────────────────────────────────────────
        border: {
          subtle: '#262626',
          strong: '#333333',
          // legacy alias
          muted:  '#262626',
        },
        // ── Text ─────────────────────────────────────────────────────────────
        text: {
          primary:   '#E5E5E5',
          secondary: '#A3A3A3',
          muted:     '#737373',
        },
        // ── Gold — restricted use ─────────────────────────────────────────
        gold: {
          primary: '#C9A227',
          hover:   '#E0B93B',
          deep:    '#A8841A',
          // legacy aliases
          muted:   '#C9A84C',
        },
        // ── Status ───────────────────────────────────────────────────────────
        success: '#4CAF50',
        warning: '#E6A23C',
        danger:  '#D64545',
        info:    '#4D7EA8',
        status: {
          success: '#4CAF50',
          warning: '#E6A23C',
          danger:  '#D64545',
          info:    '#4D7EA8',
        },
        // ── Legacy aliases (do not use in new code) ───────────────────────
        obsidian: '#0A0A0A',
        charcoal: {
          deep:  '#111111',
          panel: '#1A1A1A',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'h1': ['48px', { lineHeight: '1.1', fontWeight: '600' }],
        'h2': ['36px', { lineHeight: '1.15', fontWeight: '600' }],
        'h3': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'h4': ['22px', { lineHeight: '1.25', fontWeight: '600' }],
        'lg':   ['18px', { lineHeight: '1.4' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'sm':   ['14px', { lineHeight: '1.5' }],
        'xs':   ['12px', { lineHeight: '1.4' }],
        'micro':['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
      },
      borderRadius: {
        card:   '10px',
        input:  '8px',
        button: '8px',
        chip:   '9999px',
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      spacing: {
        '18': '72px',
        '22': '88px',
        '68': '272px',
        '72': '288px',
        '76': '304px',
        '88': '352px',
      },
      maxWidth: {
        'content':        '1400px',
        'content-wide':   '1600px',
        'content-narrow': '840px',
        'content-form':   '760px',
        'content-editor': '1000px',
      },
      animation: {
        'fade-in':   'fadeIn 0.18s ease-out',
        'slide-up':  'slideUp 0.18s ease-out',
        'slide-down': 'slideDown 0.18s ease-out',
        'shimmer':   'shimmer 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        card:    '0 1px 3px rgba(0,0,0,0.4)',
        elevated:'0 4px 12px rgba(0,0,0,0.5)',
        gold:    '0 0 0 1px rgba(201,162,39,0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
