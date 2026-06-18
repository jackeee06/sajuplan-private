import os,re,paramiko,sys,io
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding='utf-8',errors='replace')
pw=None
for c in ('.env.local','.env'):
    if os.path.exists(c):
        for l in open(c,encoding='utf-8',errors='replace'):
            m=re.match(r'\s*SSHPASS\s*=\s*(.+)\s*$',l)
            if m: pw=m.group(1).strip().strip('"').strip("'");break
    if pw:break
SQL = r"""
-- 가상 모집 회원 10명 ([SEED] 표식, phone 0100002xxxx 대역)
INSERT INTO member(name, nickname, phone, created_at)
SELECT (ARRAY['김민준','이서연','박도윤','최지우','정하준','강서아','조은우','윤지호','임수아','한예준'])[i],
       '[SEED]모집테스트'||lpad(i::text,2,'0'),
       '0100002'||lpad(i::text,4,'0'),
       now() - ((i*6)||' days')::interval
FROM generate_series(1,10) i;

-- 귀속 10건 (jackee promoter id=5)
INSERT INTO promoter_referral(promoter_id, member_id, entry_method, signup_at, reward_until, rate_snapshot)
SELECT 5, m.id, CASE WHEN m.id%2=0 THEN 'qr' ELSE 'code' END,
       m.created_at, (m.created_at::date + interval '3 months')::date, 0.03
FROM member m WHERE m.nickname LIKE '[SEED]모집테스트%';

-- 적립 20건 (앞 8명에 분산, 회원 9·10은 적립 0 / 전화·채팅 혼합 / 3건 voided / 3개월 분산)
WITH seeded AS (SELECT id, row_number() OVER (ORDER BY id) rn FROM member WHERE nickname LIKE '[SEED]모집테스트%')
INSERT INTO promoter_reward(promoter_id, member_id, source_table, source_id, base_paid, rate, reward_amount, status, usage_label, created_at)
SELECT 5, s.id, 'consultation', 91000000+g, b.base, 0.03, floor(b.base*0.03)::int,
       CASE WHEN g%6=0 THEN 'voided' ELSE 'accrued' END,
       CASE WHEN g%2=0 THEN '전화 '||to_char(b.base,'FM999,999')||'원 사용'
            ELSE '채팅 '||to_char(b.base,'FM999,999')||'원 사용' END,
       now() - ((g*3)||' days')::interval
FROM generate_series(1,20) g
CROSS JOIN LATERAL (SELECT (ARRAY[10000,15000,20000,30000,50000,12000,25000,40000])[1+(g%8)] AS base) b
JOIN seeded s ON s.rn = 1+(g%8);
"""
s=paramiko.SSHClient();s.set_missing_host_key_policy(paramiko.AutoAddPolicy())
s.connect('104.64.128.103',22,'root',pw,allow_agent=False,look_for_keys=False,timeout=25)
sftp=s.open_sftp()
with sftp.open('/tmp/_seed_promoter.sql','w') as f: f.write(SQL)
sftp.close()
b=r'''export $(grep -E "^DATABASE_URL=" /data/wwwroot/api.sajumoon.co.kr/.env|xargs)>/dev/null 2>&1
psql "$DATABASE_URL" -f /tmp/_seed_promoter.sql
echo "=== 결과 요약 ==="
psql "$DATABASE_URL" -At -c "SELECT '회원='||(SELECT COUNT(*) FROM member WHERE nickname LIKE '[SEED]모집테스트%')||' 귀속='||(SELECT COUNT(*) FROM promoter_referral WHERE promoter_id=5)||' 적립='||(SELECT COUNT(*) FROM promoter_reward WHERE promoter_id=5)||' voided='||(SELECT COUNT(*) FROM promoter_reward WHERE promoter_id=5 AND status='voided')"
psql "$DATABASE_URL" -At -c "SELECT '미정산기대수익(accrued)='||COALESCE(SUM(reward_amount) FILTER (WHERE status='accrued' AND settlement_id IS NULL),0)||'원' FROM promoter_reward WHERE promoter_id=5"
rm -f /tmp/_seed_promoter.sql'''
i,o,e=s.exec_command(b);sys.stdout.write(o.read().decode('utf-8','replace'));s.close()
