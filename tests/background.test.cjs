"use strict";
const {test}=require("node:test"); const assert=require("node:assert/strict"); const vm=require("node:vm"); const fs=require("node:fs"); const path=require("node:path");
function fixture(url="https://chatgpt.com/",defaultSource="file") {
 const listeners={},starts=[],injected=[],operations=[]; let opened=0;
 const tab={id:1,url};
 const ctx=vm.createContext({URL,Set,Date,setTimeout,clearTimeout,CGCISettings:{methods:["load","status","check","save","setEnabled","start","resend","resolve","replacePreview","replace","backups","restore","cleanup","diagnostics"],load:async()=>operations.push("load"),execute:async(method,args)=>{operations.push({method,args}); return {enabled:true};}},PPI18n:{init:async()=>{}},chrome:{
  action:{onClicked:{addListener:f=>listeners.icon=f},setBadgeText:async()=>{},setTitle:async()=>{}},
  commands:{onCommand:{addListener:f=>listeners.command=f}},
  runtime:{id:"ext",getManifest:()=>({version:"3.0.0"}),getURL:path=>`chrome-extension://ext/${path}`,onStartup:{addListener:f=>listeners.startup=f},onInstalled:{addListener:f=>listeners.installed=f},onMessage:{addListener:f=>listeners.message=f},openOptionsPage:async()=>{opened++;}},
  storage:{onChanged:{addListener:f=>listeners.changed=f},local:{get:async()=>({device2:{source:defaultSource}}),set:async()=>{}}},
  tabs:{query:async()=>[tab],sendMessage:async(id,msg)=>starts.push(msg)},
  scripting:{executeScript:async spec=>injected.push(spec)}
 }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../background.js"),"utf8"),ctx);
 return {listeners,starts,injected,operations,tab,ctx,opened:()=>opened};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("アイコンはPC既定、両コマンドは入力元を固定",async()=>{
 const f=fixture(); f.listeners.icon(f.tab); await tick();
 await f.listeners.command("clipboard-image"); await tick();
 await f.listeners.command("file-image"); await tick();
 assert.deepEqual(f.starts.map(m=>m.source),["file","clipboard","file"]);
 assert.equal(f.injected.length,3); assert.ok(f.injected[0].files.includes("gemini-adapter.js"));
});
test("Geminiで起動、対象外サイトは注入せず案内",async()=>{
 const gem=fixture("https://gemini.google.com/app"); gem.listeners.icon(gem.tab); await tick(); assert.equal(gem.starts.length,1);
 const other=fixture("https://example.com/"); other.listeners.icon(other.tab); await tick(); assert.equal(other.injected.length,0); assert.equal(other.opened(),1);
});
test("未対応コマンドは起動しない",async()=>{
 const f=fixture(); await f.listeners.command("unknown"); await tick(); assert.equal(f.starts.length,0);
});

test("起動・更新・同期データ到着で確認し、分割到着はまとめ、ローカル変更には反応しない",async()=>{
 const f=fixture(); f.listeners.startup(); f.listeners.installed(); await tick();
 f.listeners.changed({"pp3c.abcd1234.0":{newValue:{}}},"sync"); f.listeners.changed({"pp3h.abcd1234":{newValue:{}}},"sync");
 f.listeners.changed({cgciHead:{newValue:{}}},"sync"); f.listeners.changed({config2:{}},"local"); f.listeners.changed({other:{}},"sync");
 await new Promise(resolve=>setTimeout(resolve,350));
 assert.deepEqual(f.operations,["load","load","load"]);
});
test("実行の診断はコード・段階・件数だけを検証して保存する",async()=>{
 const f=fixture(); let saved={}; f.ctx.chrome.storage.local.set=async v=>{saved={...saved,...v};};
 f.listeners.message({type:"CGCI_STATUS",text:"本文を含む表示",stage:"画像添付",stageId:"attach",code:"PP-ATTACH-INPUT-NOT-FOUND",attach:"none",sent:false,inputs:{total:4,camera:1,secret:"x"},error:true},{id:"ext",url:"https://chatgpt.com/c/abc",frameId:0,tab:{id:1}},()=>{});
 await tick(); const d=saved.diagnostic2;
 assert.equal(d.code,"PP-ATTACH-INPUT-NOT-FOUND"); assert.equal(d.site,"chatgpt.com"); assert.equal(d.inputs.camera,1);
 assert.equal(d.inputs.secret,undefined); assert.ok(!JSON.stringify(d).includes("/c/abc")); assert.ok(!JSON.stringify(d).includes("本文"));
 f.listeners.message({type:"CGCI_STATUS",text:"x",stage:"s",code:"rm -rf",stageId:"BAD ID"},{id:"ext",url:"https://chatgpt.com/",frameId:0,tab:{id:1}},()=>{});
 await tick(); assert.equal(saved.diagnostic2.code,undefined); assert.equal(saved.diagnostic2.stageId,undefined);
});
test("設定書き込みはoptionsだけ、サイトからは読込だけ許可",async()=>{
 const f=fixture(), replies=[]; const reply=x=>replies.push(x);
 const msg={type:"CGCI_SETTINGS",method:"save",args:[]};
 assert.equal(f.listeners.message(msg,{id:"ext",url:"https://chatgpt.com/",frameId:0},reply),undefined);
 assert.equal(f.listeners.message(msg,{id:"other",url:"chrome-extension://ext/options.html"},reply),undefined);
 assert.equal(f.listeners.message(msg,{id:"ext",url:"chrome-extension://ext/options.html"},reply),true);
 assert.equal(f.listeners.message({...msg,method:"load"},{id:"ext",url:"https://gemini.google.com/app",frameId:0},reply),true);
 assert.equal(f.listeners.message({...msg,method:"restore"},{id:"ext",url:"https://gemini.google.com/app",frameId:0},reply),undefined);
 await tick(); assert.equal(replies.length,2); assert.equal(replies[0].ok,true);
});
