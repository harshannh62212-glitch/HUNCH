/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#04070e',
          900: '#070a13',
          800: '#0b0f19',
          700: '#141b2d',
          600: '#1f293d',
          500: '#2e3a54',
          400: '#4b5b7c',
        },
        nasa: {
          orange: '#f97316',
          'orange-glow': '#ff8a3d',
          'orange-dark': '#c2410c',
          cyan: '#06b6d4',
          'cyan-glow': '#22d3ee',
          'cyan-dark': '#0891b2',
          red: '#ef4444',
          green: '#10b981',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'sweep 4s linear infinite',
      },
      keyframes: {
        sweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
