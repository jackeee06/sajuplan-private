-- 상담사 연결번호(dtmfno) 중복 방지 — 최종 방어선 (2026-06-19)
-- 배경: 자동배정(nextAvailableDtmfno)은 빈 번호만 골라 안전하지만, 관리자 폼에서
--       dtmfno 를 직접 입력하면 중복 검사 없이 그대로 저장돼 중복이 생길 수 있었다
--       (실제 사례: 선샤인 dtmfno 108 = 청풍(더미) 108 수동 중복).
-- 조치: dtmfno 가 비어있지 않은 모든 회원에 대해 전역 UNIQUE 보장.
--       (dtmfno 는 상담사만 가지므로 사실상 상담사 연결번호 유일성 강제)
-- 주의: 적용 전 중복이 0 이어야 생성됨. 운영 중 잠금 최소화를 위해 CONCURRENTLY 사용.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_member_dtmfno_notnull
  ON member (dtmfno)
  WHERE dtmfno IS NOT NULL AND dtmfno <> '';
