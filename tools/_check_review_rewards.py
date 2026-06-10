#!/usr/bin/env python3
import os, sys, paramiko

for s in (sys.stdout, sys.stderr):
    try: s.reconfigure(encoding='utf-8', errors='replace')
    except: pass

DB   = "postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon"
HOST = "104.64.128.103"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', os.environ['SSHPASS'], allow_agent=False, look_for_keys=False, timeout=15)

def q(sql, label=""):
    if label: print(f"\n[{label}]")
    _, o, _ = c.exec_command(f'psql {DB} -c "{sql}"', timeout=15)
    print(o.read().decode('utf-8', 'replace').strip())

# 1. 후기 코인 지급 설정값
q("""
  SELECT key, value FROM setting
   WHERE namespace='review'
   ORDER BY key
""", "1. 후기 설정값 (DB)")

# 2. 실제 후기 코인 지급 이력
q("""
  SELECT ph.id, m.mb_id, m.nickname,
         ph.earn_point, ph.content, ph.rel_action,
         ph.created_at::date AS date
    FROM point_history ph
    JOIN member m ON m.id = ph.member_id
   WHERE ph.rel_action LIKE 'review:%'
      OR ph.rel_action LIKE 'review_best:%'
   ORDER BY ph.created_at DESC
   LIMIT 20
""", "2. 후기 코인 지급 이력 (point_history)")

# 3. 후기 현황
q("""
  SELECT COUNT(*) AS total_reviews,
         COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) AS with_photo,
         COUNT(CASE WHEN is_best = true THEN 1 END) AS best_count
    FROM post_review
   WHERE hidden_at IS NULL
""", "3. 후기 현황 (사진/베스트)")

# 4. 코인을 받았어야 하는 후기인데 point_history 없는 것
q("""
  SELECT r.id, r.member_id, r.created_at::date,
         r.photo_url IS NOT NULL AS has_photo
    FROM post_review r
   WHERE r.hidden_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM point_history ph
        WHERE ph.rel_action = 'review:' || r.id::text
     )
   ORDER BY r.created_at DESC
   LIMIT 10
""", "4. 코인 미지급 후기 (있으면 버그)")

c.close()
