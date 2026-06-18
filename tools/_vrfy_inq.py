import paramiko, json
HOST = '104.64.128.103'
def run(c, cmd, t=40):
    ch = c.get_transport().open_session(); ch.settimeout(t); ch.exec_command(cmd); ch.shutdown_write()
    o = b''
    while not ch.exit_status_ready():
        if ch.recv_ready(): o += ch.recv(8192)
    while ch.recv_ready(): o += ch.recv(8192)
    ch.recv_exit_status(); ch.close(); return o.decode('utf-8', 'replace')
c = paramiko.SSHClient(); c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, 'root', 'saju26moon@!!', timeout=15)
B = 'http://localhost:3001/api'
LOGIN = "'{\"mb_id\":\"lee\",\"password\":\"kunwoo77\"}'"
run(c, f"curl -s -c /tmp/ck.txt -X POST {B}/admin/auth/login -H 'Content-Type: application/json' -d {LOGIN}")
item = run(c, f"curl -s -b /tmp/ck.txt '{B}/admin/handbook/item?slug=counselor/07-inquiry'")
try:
    j = json.loads(item)
    md = j.get('markdown', '')
    print("item title:", j.get('title'), "| md len:", len(md), "| 첫줄:", md.split(chr(10))[0][:50])
except Exception:
    print("item FAIL:", item[:200])
idx = json.loads(run(c, f"curl -s -b /tmp/ck.txt {B}/admin/handbook/index"))
slugs = [it['slug'] for cat in idx['categories'] for it in cat['items']]
print("index 등록:", 'counselor/07-inquiry' in slugs, "| 총", len(slugs), "항목")
c.close()
