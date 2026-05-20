/**
 * @insurtech/shared-ui -- Tailwind CSS preset Skalean Sofidemy
 * Tache 1.4.8 implementera le preset complet. Ce stub pose la structure minimale.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharedPreset: Record<string, any> = {
  content: [],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#E95D2C', foreground: '#ffffff' },
        secondary: { DEFAULT: '#1A2730', foreground: '#ffffff' },
        accent: { DEFAULT: '#B0CEE2', foreground: '#1A2730' },
        'acaps-teal': { DEFAULT: '#2D5773', foreground: '#ffffff' },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'Noto Naskh Arabic', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};

export default sharedPreset;
