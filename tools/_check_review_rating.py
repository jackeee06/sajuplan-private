"""post_review.rating 실제 분포 점검 (별점 사용여부 확인, 읽기전용)."""
import os, sys, paramiko
for _s in (sys.stdout, sys.stderr):
    try: _s.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
if 'SSHPASS' not in os.environ:
    for line in open('.env.local', encoding='utf-8'):
        if line.startswith('SSHPASS='):
            os.environ['SSHPASS'] = line.split('=', 1)[1].strip().strip("'\""); break
pw = os.environ['SSHPASS']
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', 22, 'root', pw, allow_agent=False, look_for_keys=False, timeout=20)
_, o, _ = c.exec_command('grep "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env | head -1')
dburl = o.read().decode().strip().split('=', 1)[1].strip("'\"")
def q(sql):
    _, o, e = c.exec_command(f'/usr/bin/psql "{dburl}" -c "{sql}"')
    return o.read().decode()
print("[rating 컬럼 정의]")
print(q("SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name='post_review' AND column_name='rating';"))
print("[rating 값 분포 (전체 후기)]")
print(q("SELECT rating, count(*) FROM post_review GROUP BY rating ORDER BY rating;"))
print("[최근 30일 후기 수 + rating 평균]")
print(q("SELECT count(*) total, AVG(rating) avg_rating, count(rating) non_null_rating FROM post_review WHERE created_at >= NOW() - INTERVAL '30 days';"))
c.close()
