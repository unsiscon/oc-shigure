import os, pty, select, time, signal, struct, fcntl, termios
out = open("/tmp/shigure2.ansi","wb")
pid, fd = pty.fork()
if pid == 0:
    os.environ["COLORTERM"]="truecolor"; os.environ["TERM"]="xterm-256color"
    os.chdir("/Users/unsis/code/opcode/opcopet")
    os.execvp("opencode", ["opencode"])
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 200, 0, 0))
t0=time.time(); buf=b""; sent=False
while time.time()-t0 < 30:
    r,_,_=select.select([fd],[],[],0.5)
    if r:
        try: d=os.read(fd,65536)
        except OSError: break
        if not d: break
        buf+=d; out.write(d); out.flush()
    if not sent and time.time()-t0 > 8:
        os.write(fd, b"hi\r"); sent=True
    if 18 < time.time()-t0 and b"ready" not in buf.lower():
        break
time.sleep(2)
try: os.kill(pid, signal.SIGTERM)
except ProcessLookupError: pass
out.close()
print("captured", len(buf))
