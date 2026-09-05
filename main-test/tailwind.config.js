/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        inkOnOrange: 'rgb(var(--c-ink-on-orange) / <alpha-value>)',
        orange: {
          DEFAULT: 'rgb(var(--c-orange) / <alpha-value>)',
          soft: 'rgb(var(--c-orange-soft) / <alpha-value>)',
          dim: 'rgb(var(--c-orange-dim) / <alpha-value>)'
        },
        pass: 'rgb(var(--c-pass) / <alpha-value>)',
        alert: 'rgb(var(--c-alert) / <alpha-value>)',
        pending: 'rgb(var(--c-pending) / <alpha-value>)'
      },
      fontFamily: {
        head: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
