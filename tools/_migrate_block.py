import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

sftp = client.open_sftp()
sftp.put('api/db/migrations/20260610000000_counselor_block.sql', '/tmp/20260610000000_counselor_block.sql')
sftp.close()

_, o, e = client.exec_command(f'psql "{DB}" -f /tmp/20260610000000_counselor_block.sql')
print(o.read().decode('utf-8', 'replace'))
err = e.read().decode('utf-8', 'replace')
if err: print('ERR:', err)
client.close()
print('done')
