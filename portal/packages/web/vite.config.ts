import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 만세 엔진(@manse/engine) 정식 결합 — 포털→만세엔진 단방향(원칙 준수).
// 빌드 시 만세 dist를 번들에 흡수(런타임 경로 의존 없음).
const manseEngine = fileURLToPath(
  new URL("../../../manse/packages/engine/dist/index.js", import.meta.url),
);

// 절대경로 base — pushState 라우팅(/tojeong 등)에서 /assets·정적페이지가 깨지지 않게.
// (상대 "./"는 해시라우터 땐 OK였으나 /tojeong/index.html에서 ./assets→/tojeong/assets 404 사고)
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: { alias: { "@manse/engine": manseEngine } },
  build: { outDir: "dist", sourcemap: false },
});
