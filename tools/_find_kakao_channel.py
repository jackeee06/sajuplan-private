import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, _ = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    out = o.read().decode('utf-8','replace').strip()
    print(f'=== {label} ===\n{out}\n')

# 1. 전체 site 설정
q('전체 site/social 설정', "SELECT namespace, key, value FROM setting WHERE namespace IN ('site','social','bizm') ORDER BY namespace, key")

# 2. bizm 관련 설정 (채널 ID 포함될 수 있음)
q('bizm 설정', "SELECT namespace, key, value FROM setting WHERE namespace='bizm' OR key ILIKE '%bizm%' OR key ILIKE '%channel%'")

# 3. alimtalk_template에서 버튼 URL 확인 (채널 URL이 박혀있을 수 있음)
q('alimtalk 버튼 URL 샘플', "SELECT template_code, primary_btn_url FROM alimtalk_template WHERE primary_btn_url IS NOT NULL AND primary_btn_url <> '' LIMIT 10")

client.close()
