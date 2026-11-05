import ctypes,json,sys,time
from ctypes import wintypes as w
u=ctypes.windll.user32;imm=ctypes.windll.imm32
hwnd=int(sys.argv[1]);expected=int(sys.argv[2]);u.GetForegroundWindow.restype=w.HWND
pid=w.DWORD();u.GetWindowThreadProcessId(w.HWND(u.GetForegroundWindow()),ctypes.byref(pid))
r={'foregroundVerified':pid.value==expected,'nativeSendInput':True,'clipboardUsed':False,'keysSent':0}
if not r['foregroundVerified']:
 print(json.dumps(r));sys.exit(0)
class K(ctypes.Structure):_fields_=[('vk',w.WORD),('scan',w.WORD),('flags',w.DWORD),('time',w.DWORD),('extra',ctypes.c_size_t)]
class M(ctypes.Structure):_fields_=[('dx',w.LONG),('dy',w.LONG),('data',w.DWORD),('flags',w.DWORD),('time',w.DWORD),('extra',ctypes.c_size_t)]
class H(ctypes.Structure):_fields_=[('msg',w.DWORD),('lo',w.WORD),('hi',w.WORD)]
class U(ctypes.Union):_fields_=[('ki',K),('mi',M),('hi',H)]
class I(ctypes.Structure):_fields_=[('type',w.DWORD),('u',U)]
u.SendInput.argtypes=[w.UINT,ctypes.POINTER(I),ctypes.c_int];u.SendInput.restype=w.UINT
def key(vk):
 p=w.DWORD();u.GetWindowThreadProcessId(w.HWND(u.GetForegroundWindow()),ctypes.byref(p));assert p.value==expected,'Focus changed; stopped'
 a=(I*2)();a[0].type=a[1].type=1;a[0].u.ki=K(vk,0,0,0,0);a[1].u.ki=K(vk,0,2,0,0)
 assert u.SendInput(2,a,ctypes.sizeof(I))==2,'Native input unavailable';r['keysSent']+=1;time.sleep(.15)
for word in ['nihao','ceshi']:
 for c in word:key(ord(c.upper()))
 key(0x20);time.sleep(.4)
key(0x08);time.sleep(.2)
for c in 'shi':key(ord(c.upper()))
key(0x20);time.sleep(.6)
print(json.dumps(r))
