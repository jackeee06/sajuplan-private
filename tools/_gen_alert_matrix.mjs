// alertCatalog.ts 의 ALERT_CATALOG 배열을 추출 → 드리프트 정정 → _HANDBOOK/alert/_matrix.json 생성.
// (b) 단일출처화: 매트릭스 데이터의 진실원천을 _HANDBOOK 으로 이전.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'c:/claudeworkspace/sajumoon';
const src = readFileSync(`${ROOT}/web/mng/src/data/alertCatalog.ts`, 'utf-8');

// ALERT_CATALOG 배열 리터럴 추출 (= [ ... ] 까지 대괄호 균형 카운트)
const marker = 'export const ALERT_CATALOG';
const mi = src.indexOf(marker);
const eq = src.indexOf('=', mi);          // 타입의 [] 이후의 할당 =
const startBracket = src.indexOf('[', eq); // = 다음의 배열 [
let depth = 0, end = -1;
for (let i = startBracket; i < src.length; i++) {
  const ch = src[i];
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const arrText = src.slice(startBracket, end + 1);
// 객체 리터럴(주석 포함)은 유효한 JS → eval 로 안전 파싱
const items = eval('(' + arrText + ')');

// ── 드리프트 정정 (코드 실제와 일치) ──
const fix = (id, patch) => {
  const it = items.find((x) => x.id === id);
  if (!it) { console.error('NOT FOUND:', id); return; }
  Object.assign(it, patch);
};

// 1) 새 후기: FCM 푸시 추가됨(2026-06-18) → push active
fix('new_review', {
  push: { status: 'active', note: 'FCM (후기 작성 시 상담사에게 발송, 2026-06-18 추가)' },
  recommend: '✅ 알림톡 + FCM 둘 다 발송. 푸시 탭 시 후기 상세로 직행(event_url).',
});
// 2) 새 Q&A(문의 도착): FCM 발송중 → push active
fix('new_qna', {
  push: { status: 'active', note: 'FCM (sendToTokens, 해당 상담사)' },
  recommend: '✅ 알림톡 + FCM 둘 다 발송 (상담사 즉시 인지).',
});
// 3) 월 정산 완료: 알림톡 발송중 → alimtalk active
fix('settlement_complete', {
  alimtalk: { status: 'active', note: 'BizM settlement_complete (발송중)' },
  recommend: '✅ 알림톡 발송중. 푸시는 검토 후 안 함(상담사는 알림톡 선호).',
});

const out = {
  _comment: '알림 3채널 매트릭스 단일 출처(SSOT). 이 파일이 진실원천 — /alert-guide 페이지가 API로 읽어 렌더. 수정 후 _sync_handbook.py 로 prod 동기화. 표시 META/타입/헬퍼는 web/mng/src/data/alertCatalog.ts(코드).',
  _updated: '2026-06-18',
  _note_fcm_expansion: '"알림톡 전체 → FCM 푸시도 보내자" 확대안은 보류(park). 나중 재검토. 현재 둘다=상담요청/문의/등급승급/후기, 알림톡만=정산/선지급/쿠폰 등.',
  items,
};
writeFileSync(`${ROOT}/_HANDBOOK/alert/_matrix.json`, JSON.stringify(out, null, 2) + '\n', 'utf-8');
console.log('OK items=' + items.length + ' → _HANDBOOK/alert/_matrix.json');
