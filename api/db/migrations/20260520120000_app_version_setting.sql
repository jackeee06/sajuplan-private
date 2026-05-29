-- 앱 버전·스토어 설정 setting row (namespace='app').
-- GET /api/app/version 응답에 그대로 반환된다 (코드 수정 없이 key 추가/삭제 가능).
-- 운영/테스트 DB 에 이미 반영됨 — repo 추적용 + 새 환경 셋업 대비.
BEGIN;

INSERT INTO setting (namespace, key, value, value_type, description) VALUES
  ('app', 'aos_latest_version', '1.1.1', 'string', 'Android 최신 버전 (권장 업데이트 기준)'),
  ('app', 'ios_latest_version', '1.1',   'string', 'iOS 최신 버전 (권장 업데이트 기준)'),
  ('app', 'aos_store_url', 'https://play.google.com/store/apps/details?id=PLACEHOLDER', 'string', 'Google Play 스토어 주소 (임시 placeholder — 운영팀이 실제 주소로 교체 예정)'),
  ('app', 'ios_store_url', 'https://apps.apple.com/kr/app/id0000000000', 'string', 'App Store 주소 (임시 placeholder — 운영팀이 실제 주소로 교체 예정)')
ON CONFLICT (namespace, key) DO NOTHING;

COMMIT;
