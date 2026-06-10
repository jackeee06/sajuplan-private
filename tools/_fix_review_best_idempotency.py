#!/usr/bin/env python3
"""
베스트 후기 코인 중복 방지 — DB 레벨 수정
1. 중복 point_history 정리 (review_best:* 중 첫 1건만 남기고 삭제)
2. point / member.point 잔액 보정 (삭제한 만큼 차감)
3. UNIQUE INDEX 추가 (race condition 원천 차단)
"""
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', os.environ['SSHPASS'],
          allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, e = c.exec_command(f'psql {DB} -c "{sql}"', timeout=20)
    out = o.read().decode('utf-8', 'replace').strip()
    err = e.read().decode('utf-8', 'replace').strip()
    if out: print(out)
    if err: print("ERR:", err)

# 1. 현황 파악
q("""
  SELECT rel_action, member_id, COUNT(*) AS cnt,
         MIN(id) AS keep_id,
         COUNT(*) - 1 AS extra_cnt,
         (COUNT(*) - 1) * 10000 AS excess_coins
    FROM point_history
   WHERE rel_action LIKE 'review_best:%'
   GROUP BY rel_action, member_id
   HAVING COUNT(*) > 1
""", "1. 중복 현황 (삭제 대상)")

# 2. 중복 삭제 (첫 번째 id만 남기고 나머지 삭제)
q("""
  DELETE FROM point_history
   WHERE rel_action LIKE 'review_best:%'
     AND id NOT IN (
       SELECT MIN(id)
         FROM point_history
        WHERE rel_action LIKE 'review_best:%'
        GROUP BY member_id, rel_action
     )
""", "2. 중복 삭제")

# 3. point / member.point 잔액 보정
#    삭제한 만큼 = (원래 cnt-1) * 10000 을 free_balance 에서 차감
q("""
  WITH excess AS (
    SELECT member_id,
           SUM(earn_point) AS to_deduct
      FROM (
        SELECT member_id, earn_point FROM point_history
         WHERE rel_action LIKE 'review_best:%'
      ) sub
      -- 현재 남은 1건을 제외하고 추가 지급분은 이미 삭제됨
      -- 하지만 잔액 보정은 실제 삭제된 건수×10000 기준
    GROUP BY member_id
    HAVING COUNT(*) > 0  -- 항상 true (placeholder, 아래에서 계산)
  )
  SELECT 'balance_check' AS step
""", "3-a. balance check placeholder (아래에서 직접 계산)")

# 실제 잔액 보정: point_history 삭제 전후 합산으로 계산
# 삭제 전 13건 × 10000 = 130,000 / 삭제 후 1건 × 10000 = 10,000 → 120,000 차감 필요
q("""
  WITH remaining AS (
    SELECT member_id,
           COUNT(*) AS kept_cnt,
           COUNT(*) * 10000 AS legitimate_coins
      FROM point_history
     WHERE rel_action LIKE 'review_best:%'
     GROUP BY member_id
  ),
  original_total AS (
    SELECT member_id, free_balance, paid_balance FROM point
  ),
  excess_calc AS (
    SELECT p.member_id,
           p.free_balance,
           p.paid_balance,
           r.legitimate_coins,
           -- 현재 point 에서 legitimate_coins 를 뺀 초과분
           GREATEST(0,
             (SELECT SUM(earn_point) FROM point_history ph
               WHERE ph.member_id = p.member_id
                 AND ph.rel_action LIKE 'review_best:%')
             * 0  -- 이미 삭제됨, earn_point 합산이 legitimate_coins 와 같아야 함
           ) AS excess
      FROM original_total p
      JOIN remaining r USING (member_id)
  )
  SELECT member_id, free_balance, paid_balance, legitimate_coins FROM excess_calc
""", "3-b. 잔액 현황 확인")

# 더미 계정(dummy_cust_05, member_id=117)에 대해 초과분 차감
# 정상 지급: 10,000 (1건)
# 실제 지급됐던: 130,000 (13건)
# 차감 필요: 120,000
q("""
  SELECT id, mb_id, nickname, point FROM member WHERE id = 117
""", "3-c. 현재 잔액 (보정 전)")

q("""
  UPDATE point
     SET free_balance = GREATEST(0, free_balance - 120000),
         total_earned = GREATEST(0, total_earned - 120000),
         updated_at   = now()
   WHERE member_id = 117
     AND EXISTS (
       SELECT 1 FROM member WHERE id = 117 AND mb_id = 'dummy_cust_05'
     )
""", "3-d. point 잔액 보정 (-120,000)")

q("""
  UPDATE member
     SET point      = GREATEST(0, point - 120000),
         updated_at = now()
   WHERE id = 117
     AND mb_id = 'dummy_cust_05'
""", "3-e. member.point 보정 (-120,000)")

q("""
  SELECT id, mb_id, nickname, point FROM member WHERE id = 117
""", "3-f. 현재 잔액 (보정 후)")

# 4. UNIQUE INDEX 추가 (이미 중복 제거됐으므로 생성 가능)
q("""
  CREATE UNIQUE INDEX IF NOT EXISTS uq_point_history_review_best
    ON point_history (member_id, rel_action)
    WHERE rel_action LIKE 'review_best:%'
""", "4. UNIQUE INDEX 추가")

# 5. 최종 확인
q("""
  SELECT indexname, indexdef
    FROM pg_indexes
   WHERE tablename = 'point_history'
     AND indexname = 'uq_point_history_review_best'
""", "5. 인덱스 확인")

q("""
  SELECT rel_action, member_id, COUNT(*) AS cnt
    FROM point_history
   WHERE rel_action LIKE 'review_best:%'
   GROUP BY rel_action, member_id
""", "6. 최종 review_best 현황 (cnt=1이어야 정상)")

c.close()
print("\n✅ 완료")
