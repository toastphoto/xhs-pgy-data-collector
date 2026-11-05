import ctypes,sys,time
from ctypes import wintypes as w
u=ctypes.windll.user32;root=w.HWND(int(sys.argv[1]));expected=int(sys.argv[2]);pid=w.DWORD();u.GetWindowThreadProcessId(root,ctypes.byref(pid));assert pid.value==expected
p=w.POINT(int(sys.argv[3]),int(sys.argv[4]));assert u.ClientToScreen(root,ctypes.byref(p))
targets=[]
@ctypes.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
def enum(h,l):
 c=ctypes.create_unicode_buffer(256);u.GetClassNameW(h,c,256);r=w.RECT();u.GetWindowRect(h,ctypes.byref(r))
 if c.value=='Chrome_RenderWidgetHostHWND' and u.IsWindowVisible(h) and r.left<=p.x<r.right and r.top<=p.y<r.bottom:targets.append(h)
 return True
u.EnumChildWindows(root,enum,0);assert len(targets)==1,targets
h=targets[0];q=w.POINT(p.x,p.y);u.ScreenToClient(h,ctypes.byref(q));pos=(q.y<<16)|(q.x&65535)
u.PostMessageW(h,0x0201,1,pos)
if len(sys.argv)>5:
 z=w.POINT(int(sys.argv[5]),int(sys.argv[4]));u.ClientToScreen(root,ctypes.byref(z));u.ScreenToClient(h,ctypes.byref(z));time.sleep(.1)
 pos=(z.y<<16)|(z.x&65535);u.PostMessageW(h,0x0200,1,pos);time.sleep(.1)
u.PostMessageW(h,0x0202,0,pos);time.sleep(2)
print('Targeted QA renderer click dispatched')
