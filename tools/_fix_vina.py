import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB = 'postgresql://sajumoon:2864a3fe5f86d4ef9f0ab958fce8f576dff56c1f3f698382@127.0.0.1:5432/sajumoon'
pw = 'saju26moon@!!'
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=pw)

def q(label, sql):
    _, o, e = client.exec_command(f'psql "{DB}" -t -c "{sql}"')
    print(f'=== {label} ===')
    print(o.read().decode('utf-8', 'replace').strip())
    err = e.read().decode('utf-8', 'replace').strip()
    if err: print('ERR:', err)
    print()

# Vina post_apply #27 → accepted 로 완료 처리
q('수정 전 상태',
  "SELECT id, status, member_id FROM post_apply WHERE id=27")

q('post_apply #27 accepted 완료',
  """UPDATE post_apply
     SET status = 'accepted',
         member_id = 153,
         updated_at = now(),
         extras = extras || jsonb_build_object(
           'approved_at', now()::text,
           'created_member_id', 153,
           'created_mb_id', 'Vina',
           'partial_approval_recovered', true
         )
   WHERE id = 27 AND status = 'pending'""")

q('수정 후 상태',
  "SELECT id, status, member_id, extras->>'approved_at' FROM post_apply WHERE id=27")

q('Vina 회원 현재 상태',
  "SELECT id, mb_id, role, phone FROM member WHERE id=153")

client.close()
print('완료')
