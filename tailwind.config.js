/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Thunderbird brand - storm/sky inspired
        thunder: {
          50: '#f4f6f7',
          100: '#e2e8eb',
          200: '#c8d4d9',
          300: '#a1b5be',
          400: '#738e9c',
          500: '#587381',
          600: '#4b606d',
          700: '#41515b',
          800: '#3a464e',
          900: '#343d43',
          950: '#1e2528',
        },
        storm: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffd',
          300: '#7cc7fc',
          400: '#36abf8',
          500: '#0c90e9',
          600: '#0072c7',
          700: '#015aa1',
          800: '#064d85',
          900: '#0b406e',
          950: '#072949',
        },
        lightning: {
          400: '#facc15',
          500: '#eab308',
        },
        danger: {
          0: '#22c55e',
          1: '#eab308',
          2: '#f97316',
          3: '#ef4444',
          4: '#7c2d12',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
