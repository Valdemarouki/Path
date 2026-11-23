"""Compare every icon frame embedded in the setup executable with the artwork."""
import ctypes as c
import struct
import sys
from pathlib import Path

setup, icon = (Path(s).resolve() for s in sys.argv[1:])
data = icon.read_bytes()
reserved, kind, count = struct.unpack_from('<HHH',data)
assert (reserved,kind,count)==(0,1,10)
k = c.WinDLL('kernel32',use_last_error=True)
P = c.c_void_p
def function(name,args,result=P):
    api=getattr(k,name)
    api.argtypes=args
    api.restype=result
    return api
load=function('LoadLibraryExW',[c.c_wchar_p,P,c.c_uint32])
find=function('FindResourceW',[P,P,P])
size=function('SizeofResource',[P,P],c.c_uint32)
load_res=function('LoadResource',[P,P])
lock=function('LockResource',[P])
free=function('FreeLibrary',[P],c.c_int)
CB=c.WINFUNCTYPE(c.c_int,P,P,P,c.c_ssize_t)
enum=function('EnumResourceNamesW',[P,P,CB,c.c_ssize_t],c.c_int)
handle=load(str(setup),None,0x22)
if not handle: raise c.WinError(c.get_last_error())
def resource(name,kind):
    entry=find(handle,name,kind)
    if not entry: raise c.WinError(c.get_last_error())
    return c.string_at(lock(load_res(handle,entry)),size(handle,entry))
try:
    groups=[]
    @CB
    def collect(module,kind,name,param):
        groups.append(resource(name,14))
        return 1
    assert enum(handle,14,collect,0) and len(groups)==1
    group=groups[0]
    assert struct.unpack_from('<HHH',group)==(reserved,kind,count)
    sizes=[]
    for i in range(count):
        frame=struct.unpack_from('<BBBBHHII',data,6+i*16)
        embedded=struct.unpack_from('<BBBBHHIH',group,6+i*14)
        assert frame[:7]==embedded[:7],(frame,embedded)
        assert resource(embedded[-1],3)==data[frame[-1]:frame[-1]+frame[-2]]
        sizes.append(frame[0] or 256)
    assert sorted(sizes)==[16,20,24,32,40,48,64,96,128,256]
    print('All installer icon frames match the supplied artwork:',sizes)
finally:
    free(handle)
