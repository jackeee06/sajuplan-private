import {readFileSync, writeFileSync} from 'node:fs';
const p = 'c:/claudeworkspace/sajumoon/web/mng/src/data/alertCatalog.ts';
let s = readFileSync(p,'utf-8');
const i = s.indexOf('export const ALERT_CATALOG');
if (i < 0) { console.error('marker not found'); process.exit(1); }
const head = s.slice(0,i).replace(/\s+$/,'\n\n');
const note = '// ── 데이터(이벤트 × 3채널 매트릭스)는 단일출처(SSOT) _HANDBOOK/alert/_matrix.json 으로 이전됨 (2026-06-18).\n'
  + '//    /alert-guide 페이지가 GET /api/admin/handbook/alert-matrix 로 fetch 한다.\n'
  + '//    이 파일에는 타입 / 표시 META / 헬퍼(코드)만 유지 — 사실(facts)은 _HANDBOOK 이 진실원천.\n';
writeFileSync(p, head + note, 'utf-8');
console.log('truncated alertCatalog.ts head len=' + (head+note).length);
