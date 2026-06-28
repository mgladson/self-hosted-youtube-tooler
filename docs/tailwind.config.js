/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        doc: {
          bg: '#ffffff',
          sidebar: '#f8f9fa',
          'sidebar-border': '#e3e6e8',
          text: '#1c1e21',
          'text-muted': '#606770',
          link: '#2e64e6',
          'link-hover': '#1d4ed8',
          'active-bg': '#eef2ff',
          'active-border': '#4f6ef7',
          heading: '#1c1e21',
          border: '#e5e7eb',
          'code-bg': '#f6f7f8',
          navbar: '#ffffff',
          'navbar-border': '#ebedf0',
          'toc-text': '#525860',
          'toc-active': '#4f6ef7',
          'callout-bg': '#eef6ff',
          'callout-border': '#4f6ef7',
        },
      },
    },
  },
  plugins: [],
};
