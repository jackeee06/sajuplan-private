#!/usr/bin/env python3
"""jackee 계정 돈 관련 정밀진단"""
import os, sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"
MID  = 91  # jackee member_id

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=20)

PASS, WARN, FAIL = "✅", "⚠️", "❌"

def q(sql, label=""):
    if label: print(f"\n{'='*50}\n[{label}]")
    _, o, _ = c.exec_command(f"psql {DB} -c \"{sql}\"", timeout=20)
    out = o.read().decode('utf-8', errors='replace').strip()
    print(out)
    return out

def qv(sql):
    _, o, _ = c.exec_command(f"psql {DB} -t -c \"{sql}\"", timeout=20)
    return o.read().decode('utf-8', errors='replace').strip()

print(f"{'='*50}")
print(f"jackee(찬물선생) 계정 정밀진단")
print(f"{'='*50}")

# ══════════════════════════════════════════
# A. 기본 잔액 현황
# ══════════════════════════════════════════
q(f"""
  SELECT m.point AS 보유코인_표시,
         p.free_balance AS 무료코인,
         p.paid_balance AS 유료코인,
         p.earning_balance AS 수익금잔액,
         m.point - (p.free_balance + p.paid_balance) AS drift,
         m.grade AS 등급
    FROM member m JOIN point p ON p.member_id = m.id
   WHERE m.id = {MID}
""", "A. 현재 잔액 현황")

# ══════════════════════════════════════════
# B. 결제(충전) 이력
# ══════════════════════════════════════════
q(f"""
  SELECT id, amount AS 결제금액, coin_amount AS 코인,
         status, pay_type, created_at::date AS 날짜
    FROM payment
   WHERE member_id = {MID}
   ORDER BY created_at
""", "B. 결제(충전) 이력")

total_charged = qv(f"SELECT COALESCE(SUM(coin_amount),0) FROM payment WHERE member_id={MID} AND status='completed'")
print(f"\n  → 완료된 충전 합계: {int(total_charged.strip() or 0):,} 코인")

# ══════════════════════════════════════════
# C. 소비 코인 내역 (consumer)
# ══════════════════════════════════════════
q(f"""
  SELECT id, earn_point AS 적립, use_point AS 차감,
         balance_after AS 잔액후,
         LEFT(content, 30) AS 내용,
         balance_kind, created_at::date AS 날짜
    FROM point_history
   WHERE member_id = {MID}
     AND balance_kind = 'consumer'
   ORDER BY created_at ASC, id ASC
""", "C. 소비 코인 전체 내역 (consumer)")

total_earn = qv(f"SELECT COALESCE(SUM(earn_point),0) FROM point_history WHERE member_id={MID} AND balance_kind='consumer'")
total_use  = qv(f"SELECT COALESCE(SUM(use_point),0)  FROM point_history WHERE member_id={MID} AND balance_kind='consumer'")
last_bal   = qv(f"SELECT balance_after FROM point_history WHERE member_id={MID} AND balance_kind='consumer' ORDER BY created_at DESC, id DESC LIMIT 1")
print(f"\n  → 총 적립: {int(total_earn.strip() or 0):,} | 총 차감: {int(total_use.strip() or 0):,}")
print(f"  → 마지막 balance_after: {int(last_bal.strip() or 0):,}")

# ══════════════════════════════════════════
# D. 수익금 내역 (earning)
# ══════════════════════════════════════════
q(f"""
  SELECT id, earn_point AS 적립, use_point AS 차감,
         balance_after AS 잔액후,
         LEFT(content, 30) AS 내용,
         created_at::date AS 날짜
    FROM point_history
   WHERE member_id = {MID}
     AND balance_kind = 'earning'
   ORDER BY created_at ASC, id ASC
""", "D. 수익금 전체 내역 (earning)")

# ══════════════════════════════════════════
# E. 상담 이력 (jackee가 상담사로서)
# ══════════════════════════════════════════
q(f"""
  SELECT c.id, c.usetm AS 통화초,
         c.amt AS 총차감, c.amt_free AS 무료차감, c.amt_pro AS 유료차감,
         c.reason, c.refund_status,
         c.amt - c.amt_free - c.amt_pro AS amt불일치,
         c.created_at::date AS 날짜
    FROM consultation c
   WHERE c.counselor_id = {MID}
   ORDER BY c.created_at
""", "E. 상담사로서 상담 이력")

# ══════════════════════════════════════════
# F. 상담 이력 (jackee가 회원으로서)
# ══════════════════════════════════════════
q(f"""
  SELECT c.id, c.usetm AS 통화초,
         c.amt AS 총차감, c.amt_free AS 무료차감, c.amt_pro AS 유료차감,
         c.reason, c.refund_status,
         c.created_at::date AS 날짜
    FROM consultation c
   WHERE c.member_id = {MID}
   ORDER BY c.created_at
""", "F. 회원으로서 상담 이력 (코인 차감)")

# ══════════════════════════════════════════
# G. 핵심 정합성 검증
# ══════════════════════════════════════════
print(f"\n{'='*50}\n[G. 핵심 정합성 검증]")

paid_bal = int(qv(f"SELECT paid_balance FROM point WHERE member_id={MID}").strip() or 0)
free_bal = int(qv(f"SELECT free_balance FROM point WHERE member_id={MID}").strip() or 0)
earn_bal = int(qv(f"SELECT earning_balance FROM point WHERE member_id={MID}").strip() or 0)
mp       = int(qv(f"SELECT point FROM member WHERE id={MID}").strip() or 0)

total_c  = int(qv(f"SELECT COALESCE(SUM(coin_amount),0) FROM payment WHERE member_id={MID} AND status='completed'").strip() or 0)
total_u  = int(qv(f"SELECT COALESCE(SUM(use_point),0) FROM point_history WHERE member_id={MID} AND balance_kind='consumer' AND rel_action NOT LIKE 'chat_room%prepaid%'").strip() or 0)
total_e2 = int(qv(f"SELECT COALESCE(SUM(earn_point),0) FROM point_history WHERE member_id={MID} AND balance_kind='consumer'").strip() or 0)
computed_paid = total_c + total_e2 - total_u

# G-1. drift
drift = mp - (free_bal + paid_bal)
sym = PASS if drift == 0 else FAIL
print(f"{sym} G-1. member.point drift: {drift} (point={mp:,}, free+paid={free_bal+paid_bal:,})")

# G-2. 충전 - 차감 = paid_balance
sym = PASS if computed_paid == paid_bal else WARN
print(f"{sym} G-2. 충전({total_c:,}) + 적립({total_e2:,}) - 차감({total_u:,}) = {computed_paid:,} | paid_balance={paid_bal:,} | 차이={computed_paid-paid_bal:,}")

# G-3. earning balance 정합
earn_total_in  = int(qv(f"SELECT COALESCE(SUM(earn_point),0) FROM point_history WHERE member_id={MID} AND balance_kind='earning' AND earn_point>0").strip() or 0)
earn_total_out = int(qv(f"SELECT COALESCE(SUM(use_point),0) FROM point_history WHERE member_id={MID} AND balance_kind='earning' AND use_point>0").strip() or 0)
computed_earn = earn_total_in - earn_total_out
sym = PASS if computed_earn == earn_bal else WARN
print(f"{sym} G-3. 수익금 적립({earn_total_in:,}) - 차감({earn_total_out:,}) = {computed_earn:,} | earning_balance={earn_bal:,} | 차이={computed_earn-earn_bal:,}")

# G-4. 상담 amt 정합 (amt = amt_free + amt_pro)
bad_amt = qv(f"SELECT COUNT(*) FROM consultation WHERE counselor_id={MID} AND amt != amt_free + amt_pro")
sym = PASS if bad_amt.strip() == '0' else FAIL
print(f"{sym} G-4. 상담사 상담 amt 불일치: {bad_amt.strip()}건")

bad_amt2 = qv(f"SELECT COUNT(*) FROM consultation WHERE member_id={MID} AND amt != amt_free + amt_pro")
sym = PASS if bad_amt2.strip() == '0' else FAIL
print(f"{sym} G-5. 회원 상담 amt 불일치: {bad_amt2.strip()}건")

# G-5. 정산 이력
settle_cnt = qv(f"SELECT COUNT(*) FROM settlement_monthly WHERE member_id={MID}")
print(f"\n{'='*50}")
print(f"  정산 이력: {settle_cnt.strip()}건")

q(f"""
  SELECT month, price_tot, price, status, final_payout_amount
    FROM settlement_monthly
   WHERE member_id = {MID}
   ORDER BY month
""", "H. 정산 이력")

# G-6. 선지급 이력
q(f"""
  SELECT id, requested_amount, actual_payout, status, created_at::date
    FROM payout_request
   WHERE member_id = {MID}
   ORDER BY created_at
""", "I. 선지급 이력")

# G-7. 출석 이력 요약
q(f"""
  SELECT COUNT(*) AS 출석일수,
         SUM(base_coin + bonus_coin) AS 총출석코인,
         MAX(consecutive_days) AS 최대연속일
    FROM member_attendance
   WHERE member_id = {MID}
""", "J. 출석 요약")

print(f"\n{'='*50}")
print("정밀진단 완료")
c.close()
