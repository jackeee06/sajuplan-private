import base64, os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("104.64.128.103", 22, "root", os.environ["SSHPASS"],
          allow_agent=False, look_for_keys=False, timeout=15)


def run(sql):
    b64 = base64.b64encode(sql.encode()).decode()
    cmd = (
        'export DATABASE_URL=$(grep -E "^DATABASE_URL=" '
        '/data/wwwroot/api.sajumoon.co.kr/.env | cut -d= -f2-) && '
        f'echo {b64} | base64 -d | psql "$DATABASE_URL"'
    )
    _, out, err = c.exec_command(f"bash -lc {repr(cmd)}", timeout=30)
    result = out.read().decode()
    e = err.read().decode()
    if e:
        print("ERR:", e, file=sys.stderr)
    return result


print("=== 상담 168·169 포인트 차감 기록 (text cast) ===")
print(run("""
SELECT ph.id, ph.earn_point, ph.use_point, ph.balance_after,
       ph.rel_action, ph.consultation_no, ph.content
FROM point_history ph
WHERE ph.mb_id = 'aWl_8ZEhCfB58ryhQItIL76kZHJy5TG81sdRAqki5sg_N'
  AND (ph.consultation_no IN ('168','169')
       OR ph.rel_id IN ('168','169'))
ORDER BY ph.id;
"""))

print("=== 해당 고객 전체 point_history (최근 5건) ===")
print(run("""
SELECT ph.id, ph.earn_point, ph.use_point, ph.balance_after,
       ph.rel_action, ph.consultation_no, ph.content
FROM point_history ph
WHERE ph.mb_id = 'aWl_8ZEhCfB58ryhQItIL76kZHJy5TG81sdRAqki5sg_N'
ORDER BY ph.id DESC LIMIT 5;
"""))

c.close()
