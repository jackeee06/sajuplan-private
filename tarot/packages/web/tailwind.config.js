/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 사주플랜 브랜드 — 보라(기본) + 핑크(강조). 타로의 신비로운 톤과 일치.
        primary: { 300: '#b9a3f9', 400: '#9b7af7', 500: '#8259F5', 600: '#7c3aed', 700: '#6d28d9' },
        accent: { 50: '#fdf2f8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777' },
        gold: { 300: '#f3d99b', 400: '#e8c46a', 500: '#d4a93f' },
        night: { 800: '#1b1230', 900: '#130b24', 950: '#0b0518' },
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", 'Pretendard', '-apple-system', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
