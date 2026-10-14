/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // One restrained accent (burnt orange). Everything else is neutral.
        accent: { DEFAULT: '#c2410c', hover: '#9a3412', soft: '#fff4ed' },
        ink: { DEFAULT: '#1c1f23', muted: '#5b636d', faint: '#8a919a' },
        surface: { DEFAULT: '#ffffff', page: '#f6f6f4', line: '#e3e4e1' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '6px', md: '8px', lg: '10px' },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.05)' },
    },
  },
  plugins: [],
};
