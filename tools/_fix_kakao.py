import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, e = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    out = o.read().decode('utf-8','replace').strip()
    print(f'=== {label} ===\n{out}\n')
    return out

q('수정 전', "SELECT key, value FROM setting WHERE namespace='site' AND key='kakao_channel_url'")

q('URL 수정',
  "UPDATE setting SET value='https://pf.kakao.com/_gLTVX/chat' "
  "WHERE namespace='site' AND key='kakao_channel_url'")

q('수정 후', "SELECT key, value FROM setting WHERE namespace='site' AND key='kakao_channel_url'")

client.close()
print('완료')
