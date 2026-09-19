/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        acorn: {
          blue: '#0967F7',
          'blue-dark': '#0758D8',
          'deep-blue': '#082051',
          'slate-blue': '#5969AB',
          gray: '#656C79',
          surface: '#F3F6FC',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: [
          'Switzer',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
