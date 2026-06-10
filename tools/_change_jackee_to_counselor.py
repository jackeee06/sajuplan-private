import paramiko

pw = 'saju26moon@!!'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('104.64.128.103', username='root', password=pw)

# 현재 jackee 상태 확인
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -t -c \"SELECT id,mb_id,role,grade,nickname FROM member WHERE mb_id='jackee' LIMIT 1;\"")
print("=== 변경 전 jackee ===")
print(o.read().decode())

# counselor로 전환 + 등급 세팅 + csrid 확인
s,o,e = c.exec_command("""psql -U sajumoon -d sajumoon -c "
UPDATE member
   SET role = 'counselor',
       grade = COALESCE(NULLIF(grade,''), 'preliminary'),
       use_phone = true,
       use_chat = true
 WHERE mb_id = 'jackee'
   AND role = 'admin'
 RETURNING id, mb_id, role, grade;
" """)
print("=== 변경 결과 ===")
print(o.read().decode())

# 변경 후 확인
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -t -c \"SELECT id,mb_id,role,grade FROM member WHERE mb_id='jackee' LIMIT 1;\"")
print("=== 변경 후 jackee ===")
print(o.read().decode())

# point 테이블 존재 여부
s,o,e = c.exec_command("psql -U sajumoon -d sajumoon -t -c \"SELECT member_id,paid_balance,free_balance,earning_balance FROM point WHERE member_id=(SELECT id FROM member WHERE mb_id='jackee') LIMIT 1;\"")
print("=== jackee point ===")
print(o.read().decode())

c.close()
