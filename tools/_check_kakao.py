import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

_, o, _ = client.exec_command(f'psql "{DB}" -t -c "SELECT namespace, key, value FROM setting WHERE key LIKE \'%kakao%\' OR namespace=\'site\' ORDER BY namespace, key"')
print('=== kakao 관련 설정 ===')
print(o.read().decode('utf-8','replace').strip())
client.close()
