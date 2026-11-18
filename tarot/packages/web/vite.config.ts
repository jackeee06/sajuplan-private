import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 위젯/임베드 대비: 상대경로 base 로 빌드(어느 경로에 올려도 동작).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
