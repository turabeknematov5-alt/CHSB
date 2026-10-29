# Windows Job Objects close only this mission's process tree on crash or normal disposal.
function New-MissionJob {
 if(-not ('NightshiftJob' -as [type])){
 Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public sealed class NightshiftJob : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct IO {public ulong a,b,c,d,e,f;}
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long a,b;public uint flags;public UIntPtr min,max;public uint active;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct Extended {public Basic basic;public IO io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 IntPtr handle;
 public NightshiftJob(){handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception();var info=new Extended();info.basic.flags=0x2000;int size=Marshal.SizeOf(info);var data=Marshal.AllocHGlobal(size);try{Marshal.StructureToPtr(info,data,false);if(!SetInformationJobObject(handle,9,data,(uint)size))throw new Win32Exception();}finally{Marshal.FreeHGlobal(data);}}
 public void Add(System.Diagnostics.Process p){if(!AssignProcessToJobObject(handle,p.Handle))throw new Win32Exception();}
 public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
}
'@
 }
 return New-Object NightshiftJob
}
