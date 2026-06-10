import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', 22, 'root', 'saju26moon@!!', timeout=20)

def q(label, sql):
    _, out, err = client.exec_command(f"psql -U sajumoon -d sajumoon -c {sql!r}")
    result = out.read().decode('utf-8', errors='replace')
    error = err.read().decode('utf-8', errors='replace')
    print(f'\n=== {label} ===')
    print(result or '(no rows)')
    if error: print('ERR:', error)

# 테이블 존재 확인
q('테이블 목록', "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
q('setting 전체 (처음 30행)', "SELECT namespace, key, value FROM setting ORDER BY namespace, key LIMIT 30")
q('쿠폰존', "SELECT id, cz_name, cz_point, cz_type, is_active FROM coupon_zone LIMIT 20")

client.close()
