#!/usr/bin/env python3
import paramiko
import os

password = os.environ.get('SSHPASS', 'saju26moon@!!')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=password)
cmd = 'psql -U sajumoon -d sajumoon -f /data/wwwroot/api.sajumoon.co.kr/db/migrations/20260607000000_realtime_grade_upgrade.sql 2>&1'
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
print(stderr.read().decode('utf-8', errors='replace'))
client.close()
