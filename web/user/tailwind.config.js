/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        pretendard: ['Pretendard', 'sans-serif'],
      },
      colors: {
        brand: {
          25: '#f8f5ff',
          50: '#f1ecfe',
          100: '#e3dafe',
          200: '#cabbfd',
          300: '#b09cfb',
          400: '#9c7ff8',
          500: '#8259f5',
          600: '#6e3eea',
          700: '#5723c7',
          800: '#421b9b',
        },
        gray: {
          25: '#fcfcfd',
          50: '#f9fafb',
          100: '#f2f4f7',
          200: '#e4e7ec',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
        },
        kakao: '#fee500',
        naver: '#03a94d',
      },
    },
  },
  plugins: [],
}
