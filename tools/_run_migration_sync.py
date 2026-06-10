#!/usr/bin/env python3
import paramiko
import os
import sys

password = os.environ.get('SSHPASS', '')
if not password:
    print('SSHPASS not set', file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('104.64.128.103', username='root', password=password)
cmd = 'psql -U sajumoon -d sajumoon -f /data/wwwroot/api.sajumoon.co.kr/db/migrations/20260607000000_realtime_grade_upgrade.sql 2>&1 && echo MIGRATION_OK'
stdin, stdout, stderr = client.exec_command(cmd)
exit_code = stdout.channel.recv_exit_status()
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print('=== STDOUT ===')
print(out)
if err:
    print('=== STDERR ===')
    print(err)
print(f'=== EXIT CODE: {exit_code} ===')
client.close()
sys.exit(exit_code)
