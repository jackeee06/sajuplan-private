/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 사주플랜/만세력 브랜드 패밀리 — 보라(기본) + 핑크(활성·강조). 만세 토큰과 동일.
        primary: { 400: "#9b7af7", 500: "#8259F5", 600: "#7c3aed" },
        accent: { 50: "#fdf2f8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777" },
        ink: "#1f2430",
        canvas: "#f7f7fb",
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
      },
      maxWidth: {
        app: "600px",
      },
    },
  },
  plugins: [],
};
