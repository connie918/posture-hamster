const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('api',{count:n=>ipcRenderer.send('count',n),status:t=>ipcRenderer.send('status',t),onStatus:f=>ipcRenderer.on('status',(e,t)=>f(t)),needCalib:v=>ipcRenderer.send('needCalib',v),suggest:()=>ipcRenderer.send('suggest'),calibrate:()=>ipcRenderer.send('calibrate'),onCmd:f=>ipcRenderer.on('cmd',(e,c,a)=>f(c,a))});
