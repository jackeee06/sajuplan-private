#!/usr/bin/env python3
"""라온선생(m2net_membid=295152) m2net 잔액 즉시 +5000 동기화.
서버(104.64.128.103)에서 node.js로 실행.
"""
import os
import sys
import paramiko

for s in (sys.stdout, sys.stderr):
    try:
        s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

HOST = "104.64.128.103"
MB1 = "295152"
DELTA = 5000
API_URL = "http://passcall.co.kr:25205"
HEADER_KEY = "f58cdy2sXhkOdp2YSJUjuqEJB"

# Node.js 스크립트 (서버에서 직접 실행)
NODE_SCRIPT = f"""
const http = require('http');
const padded = '{MB1}'.padStart(6, '0');
const body = JSON.stringify({{ amt: {DELTA} }});
const url = new URL(`{API_URL}/memb-mgr/${{padded}}/fill`);
const opt = {{
  hostname: url.hostname, port: url.port || 80, path: url.pathname,
  method: 'PUT',
  headers: {{ 'Content-Type': 'application/json', 'Authorization': '{HEADER_KEY}', 'Content-Length': Buffer.byteLength(body) }}
}};
const req = http.request(opt, res => {{
  let d=''; res.on('data', c=>d+=c); res.on('end', ()=>{{
    try {{
      const r=JSON.parse(d);
      if(r.req_result==='00') {{ console.log('OK:' + JSON.stringify(r)); process.exit(0); }}
      else {{ console.error('FAIL:' + JSON.stringify(r)); process.exit(1); }}
    }} catch(e) {{ console.error('PARSE_ERR:'+d); process.exit(1); }}
  }});
}});
req.on('error', e=>{{ console.error('NET_ERR:'+e.message); process.exit(1); }});
req.write(body); req.end();
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, 22, "root", os.environ["SSHPASS"],
            allow_agent=False, look_for_keys=False, timeout=20)

print(f">> m2net fill: /memb-mgr/{MB1.zfill(6)}/fill  amt={DELTA}")

# 스크립트를 서버 /tmp 에 업로드 후 실행
sftp = ssh.open_sftp()
with sftp.file("/tmp/_m2net_fix.js", "w") as f:
    f.write(NODE_SCRIPT)
sftp.close()

_, o, e = ssh.exec_command("node /tmp/_m2net_fix.js", timeout=20)
out = o.read().decode("utf-8", errors="replace").strip()
err = e.read().decode("utf-8", errors="replace").strip()
rc = o.channel.recv_exit_status()

if out:
    print(f"  응답: {out}")
if err:
    print(f"  stderr: {err}", file=sys.stderr)

if rc == 0:
    print(f"[OK] m2net +{DELTA} 동기화 완료 (mb1={MB1})")
else:
    print(f"[FAIL] rc={rc}", file=sys.stderr)
    sys.exit(rc)

ssh.close()
