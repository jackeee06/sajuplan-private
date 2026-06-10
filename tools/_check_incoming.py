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

# 홍휴(member_id=132) 오늘 채팅방 목록 — 어느 상담사에게 신청했는지
q('홍휴 오늘 채팅방',
  """SELECT cr.id, cr.status, cr.created_at,
            m.mb_id AS counselor_mbid, m.nickname AS counselor_name,
            cr.settle_status
     FROM chat_room cr
     LEFT JOIN member m ON m.id = cr.counselor_id
     WHERE cr.member_id = 132
       AND cr.created_at >= '2026-06-10'
     ORDER BY cr.created_at DESC LIMIT 10""")

# 오늘 alimtalk_log에서 채팅 관련 알림 발송 내역 — 누구에게 갔는지
q('오늘 채팅 알림톡 발송 내역',
  """SELECT id, template_code, phone, success, error_reason, sent_at
     FROM alimtalk_log
     WHERE template_code IN ('chat_request_to_counselor','chat_auto_cancelled_to_member')
       AND sent_at >= '2026-06-10'
     ORDER BY sent_at DESC LIMIT 20""")

client.close()
