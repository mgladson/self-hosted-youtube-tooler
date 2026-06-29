/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#ffffff',
        'text-muted': '#65676b',
        'accent-orange': '#166fe5',
        'accent-cyan': '#0a5fd0',
        'accent-purple': '#385898',
        'accent-green': '#1a7f37',
        'btn-stake': '#166fe5',
        'btn-info': '#65676b',
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'Segoe UI', 'system-ui', 'sans-serif'],
        heading: ['var(--font-ui)', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ui)', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
