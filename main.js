const {Notification,app,BrowserWindow,Tray,Menu,screen,ipcMain,protocol,net,nativeImage,systemPreferences}=require('electron');
const path=require('path'),fs=require('fs'),url=require('url');
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.commandLine.appendSwitch('disable-renderer-backgrounding');app.commandLine.appendSwitch('disable-background-timer-throttling');app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
let overlay,calib,tray,count=0;
const cfgPath=()=>path.join(app.getPath('userData'),'settings.json');
let cfg={v:2,sens:5,debug:false,sound:true,paused:false};
try{const o=JSON.parse(fs.readFileSync(cfgPath()));if(!o.v){o.v=2;o.sens=5}Object.assign(cfg,o)}catch{}
let uncal=false;
const save=()=>fs.writeFileSync(cfgPath(),JSON.stringify(cfg));
const send=(c,a)=>overlay&&overlay.webContents.send('cmd',c,a);
function createOverlay(){const d=screen.getPrimaryDisplay().bounds;
 overlay=new BrowserWindow({x:d.x,y:d.y,width:d.width,height:d.height,transparent:true,frame:false,hasShadow:false,resizable:false,movable:false,focusable:false,skipTaskbar:true,enableLargerThanScreen:true,type:'panel',backgroundColor:'#00000000',
  webPreferences:{preload:path.join(__dirname,'preload.js'),backgroundThrottling:false}});
 overlay.setAlwaysOnTop(true,'screen-saver');overlay.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 overlay.setIgnoreMouseEvents(true,{forward:true});overlay.loadURL('app://local/overlay.html'+(process.env.PH_SHOT?'?cpu':''));
 overlay.webContents.on('did-finish-load',()=>{send('sens',cfg.sens);send('sound',cfg.sound);send('pause',cfg.paused);send('debug',cfg.debug);sendIns()});
 screen.on('display-metrics-changed',()=>{const b=screen.getPrimaryDisplay().bounds;overlay.setBounds(b);sendIns()})}
function sendIns(){const d=screen.getPrimaryDisplay(),b=d.bounds,w=d.workArea;send('insets',{t:w.y-b.y,l:w.x-b.x,b:(b.y+b.height)-(w.y+w.height),r:(b.x+b.width)-(w.x+w.width)})}
function openCalib(){if(calib){calib.show();return}
 calib=new BrowserWindow({width:440,height:560,title:'校准坐姿',resizable:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.js')}});
 calib.loadURL('app://local/calib.html');calib.on('closed',()=>calib=null)}
function menu(){const sens=[1,3,5,7,9].map(v=>({label:{1:'很宽松（阈值×2）',3:'宽松（阈值×1.5）',5:'标准（阈值×1）',7:'敏感（阈值×0.7）',9:'很敏感（阈值×0.5）'}[v],type:'radio',checked:cfg.sens===v,click:()=>{cfg.sens=v;save();send('sens',v)}}));
 tray.setContextMenu(Menu.buildFromTemplate([
  ...(uncal?[{label:'⚠️ 未校准 · 点这里校准坐姿',click:openCalib},{type:'separator'}]:[]),{label:`今日被砸 ${count} 次`,enabled:false},{type:'separator'},
  {label:cfg.paused?'开始监测':'暂停监测',click:()=>{cfg.paused=!cfg.paused;save();send('pause',cfg.paused);menu()}},
  {label:'校准坐姿…',click:openCalib},{label:'清除校准并重新校准',click:()=>{send('recal')}},
  {label:'灵敏度',submenu:sens},
  {label:'显示检测数值',type:'checkbox',checked:cfg.debug,click:i=>{cfg.debug=i.checked;save();send('debug',cfg.debug)}},
  {label:'声音',type:'checkbox',checked:cfg.sound,click:i=>{cfg.sound=i.checked;save();send('sound',cfg.sound)}},
  {label:'演示',submenu:[1,2,3,4].map(l=>({label:['','1 吐瓜子壳','2 扔瓜子','3 砸零食','4 撞屏幕'][l],click:()=>send('attack',l)})).concat([{label:'探头',click:()=>send('peek')},{label:'坐好了',click:()=>send('calm')}])},
  {type:'separator'},
  {label:'开机启动',type:'checkbox',checked:app.getLoginItemSettings().openAtLogin,click:i=>app.setLoginItemSettings({openAtLogin:i.checked})},
  {label:'退出',click:()=>app.quit()}]));tray.setToolTip(uncal?'坐姿小仓鼠 · 未校准':'坐姿小仓鼠');tray.setTitle(uncal?'未校准':'')}
app.whenReady().then(async()=>{
 if(app.dock)app.dock.hide();
 protocol.handle('app',req=>{const p=decodeURIComponent(new URL(req.url).pathname);return net.fetch(url.pathToFileURL(path.join(__dirname,p)).toString())});
 if(process.platform==='darwin'){try{await systemPreferences.askForMediaAccess('camera')}catch{}}
 const ic=nativeImage.createFromPath(path.join(__dirname,'trayTemplate.png'));ic.setTemplateImage(true);
 tray=new Tray(ic);menu();createOverlay();
 if(process.env.PH_SHOT){overlay.webContents.on('console-message',(e,l,msg)=>console.log('C:',msg));setTimeout(()=>{send('debug',true)},3000);setTimeout(async()=>{const i=await overlay.webContents.capturePage();fs.writeFileSync(process.env.PH_SHOT,i.toPNG());app.quit()},9000)}
 ipcMain.on('status',(e,t)=>calib&&calib.webContents.send('status',t));ipcMain.on('needCalib',(e,v)=>{uncal=v;menu();if(v)openCalib();else if(calib)calib.webContents.send('status','已校准 ✓')});
 ipcMain.on('suggest',()=>{const n=new Notification({title:'坐姿小仓鼠',body:'你的位置好像和校准时差别很大，要重新校准吗？点我校准。'});n.on('click',openCalib);n.show()});
 ipcMain.on('count',(e,n)=>{count=n;menu()});
 ipcMain.on('calibrate',()=>{send('calibrate');if(cfg.paused){cfg.paused=false;save();send('pause',false);menu()}});
});
app.on('window-all-closed',e=>{});
app.on('second-instance',()=>{});
if(!app.requestSingleInstanceLock())app.quit();
