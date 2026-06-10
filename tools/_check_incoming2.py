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

# chat_room 컬럼 확인
q('chat_room 컬럼',
  "SELECT column_name FROM information_schema.columns WHERE table_name='chat_room' ORDER BY ordinal_position")

# 홍휴 채팅방
q('홍휴 오늘 채팅방',
  """SELECT cr.id, cr.status, cr.started_at,
            m.mb_id AS counselor_mbid, m.nickname AS counselor_name, m.phone AS counselor_phone
     FROM chat_room cr
     LEFT JOIN member m ON m.id = cr.counselor_id
     WHERE cr.member_id = 132
       AND cr.started_at >= '2026-06-10'
     ORDER BY cr.started_at DESC LIMIT 10""")

# 알림톡 수신 번호가 어느 상담사인지
q('알림톡 수신자 01031149875 상담사',
  "SELECT id, mb_id, nickname, phone, role FROM member WHERE regexp_replace(phone,'[^0-9]','','g')='01031149875'")

# 오늘 전체 채팅 알림 발송 (모든 template)
q('오늘 전체 채팅 관련 알림톡',
  """SELECT template_code, phone, success, error_reason, sent_at
     FROM alimtalk_log
     WHERE sent_at >= '2026-06-10 15:00:00'
     ORDER BY sent_at DESC LIMIT 30""")

client.close()
