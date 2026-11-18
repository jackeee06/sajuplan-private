/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 사주플랜 브랜드 패밀리 — 보라(기본) + 핑크(활성·강조)
        primary: { 400: "#9b7af7", 500: "#8259F5", 600: "#7c3aed" },
        accent: { 50: "#fdf2f8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777" },
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "system-ui", "sans-serif"],
        // 한자는 Pretendard에 글리프가 없어 Noto Sans KR(굵기 900 지원)로 렌더
        hanja: ["'Noto Sans KR'", "'Pretendard Variable'", "'Apple SD Gothic Neo'", "'Malgun Gothic'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
