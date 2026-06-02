"""Find psql binary on test server."""
import os, sys, paramiko
pw = os.environ["SSHPASS"]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("172.235.211.75", 22, "root", pw, allow_agent=False, look_for_keys=False, timeout=20)
_, out, _ = c.exec_command("bash -lc 'which psql; ls /usr/local/pgsql/bin/psql /usr/bin/psql /opt/pgsql/bin/psql 2>/dev/null; find / -maxdepth 6 -name psql -type f 2>/dev/null | head -5'")
sys.stdout.write(out.read().decode("utf-8", errors="replace"))
c.close()
