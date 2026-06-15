import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#18181b',
        'surface-elevated': '#27272a',
        border: '#3f3f46',
        'text-primary': '#f4f4f5',
        'text-secondary': '#a1a1aa',
        accent: {
          DEFAULT: '#10b981',
          hover: '#059669',
          muted: '#064e3b',
        },
        danger: {
          DEFAULT: '#f43f5e',
          muted: '#4c0519',
        },
        warning: {
          DEFAULT: '#f59e0b',
          muted: '#451a03',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
