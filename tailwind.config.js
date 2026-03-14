/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a8a', // Navy Blue
          dark: '#172554',
          light: '#3b82f6',
        },
        success: '#15803d', // Dark Green
        pending: '#b45309', // Dark Amber
        rejected: '#b91c1c', // Dark Red
        background: '#f1f5f9',
        border: '#e2e8f0',
      },
      borderRadius: {
        DEFAULT: '4px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
};
