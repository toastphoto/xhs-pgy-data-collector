import ctypes,sys
from ctypes import wintypes as w
from PIL import Image
hwnd=int(sys.argv[1]);out=sys.argv[2]
user=ctypes.windll.user32;gdi=ctypes.windll.gdi32
user.GetWindowDC.restype=w.HDC;gdi.CreateCompatibleDC.restype=w.HDC;gdi.CreateCompatibleBitmap.restype=w.HBITMAP;gdi.SelectObject.restype=w.HANDLE
user.GetWindowDC.argtypes=[w.HWND];gdi.CreateCompatibleDC.argtypes=[w.HDC];gdi.CreateCompatibleBitmap.argtypes=[w.HDC,ctypes.c_int,ctypes.c_int];gdi.SelectObject.argtypes=[w.HDC,w.HANDLE]
user.PrintWindow.argtypes=[w.HWND,w.HDC,w.UINT];gdi.GetDIBits.argtypes=[w.HDC,w.HBITMAP,w.UINT,w.UINT,ctypes.c_void_p,ctypes.c_void_p,w.UINT]
gdi.DeleteDC.argtypes=[w.HDC];gdi.DeleteObject.argtypes=[w.HANDLE];user.ReleaseDC.argtypes=[w.HWND,w.HDC]
rect=w.RECT();assert user.GetWindowRect(w.HWND(hwnd),ctypes.byref(rect))
width,height=rect.right-rect.left,rect.bottom-rect.top
dc=user.GetWindowDC(w.HWND(hwnd));mem=gdi.CreateCompatibleDC(dc);bitmap=gdi.CreateCompatibleBitmap(dc,width,height);previous=gdi.SelectObject(mem,bitmap)
class Header(ctypes.Structure):
 _fields_=[('size',w.DWORD),('width',w.LONG),('height',w.LONG),('planes',w.WORD),('bits',w.WORD),('compression',w.DWORD),('imageSize',w.DWORD),('x',w.LONG),('y',w.LONG),('used',w.DWORD),('important',w.DWORD)]
header=Header(ctypes.sizeof(Header),width,-height,1,32,0,0,0,0,0,0);buf=ctypes.create_string_buffer(width*height*4)
try:
 assert user.PrintWindow(w.HWND(hwnd),mem,2)
 assert gdi.GetDIBits(mem,bitmap,0,height,buf,ctypes.byref(header),0)
 Image.frombuffer('RGB',(width,height),buf.raw,'raw','BGRX',0,1).save(out)
 print('Exact QA window PrintWindow captured')
finally:
 gdi.SelectObject(mem,previous);gdi.DeleteObject(bitmap);gdi.DeleteDC(mem);user.ReleaseDC(w.HWND(hwnd),dc)
