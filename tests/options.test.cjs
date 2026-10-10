"use strict";
const {test}=require("node:test"), assert=require("node:assert/strict"), vm=require("node:vm"), fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto").webcrypto;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture() {
 const nodes=new Map(), changes=[], decisions=[]; let writes=0, fail=false;
 const local={}, sync={}, callbacks=[];
 class Node {
  constructor(id){this.id=id;this.value="";this.checked=false;this.textContent="";this.disabled=false;this.listeners={};this.children=[];}
  addEventListener(type,fn){this.listeners[type]=fn;}
  replaceChildren(){this.children=[];this.value="";}
  append(node){this.children.push(node);if(!this.value)this.value=node.value;}
 }
 const html=fs.readFileSync(path.join(__dirname,"../options.html"),"utf8");
 for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Node(id));
 const area=(data,name)=>({async get(keys){return typeof keys==="string"?{[keys]:structuredClone(data[keys])}:structuredClone(data);},async set(values){if(name==="sync"&&fail)throw new Error("failure");if(name==="sync")writes++;const delta={};for(const [key,value]of Object.entries(values)){if(JSON.stringify(data[key])!==JSON.stringify(value))delta[key]={oldValue:structuredClone(data[key]),newValue:structuredClone(value)};data[key]=structuredClone(value);}if(Object.keys(delta).length)queueMicrotask(()=>callbacks.forEach(fn=>fn(delta,name)));}});
 const i18n={preference:"ja",init:async()=>{},apply:()=>{},set:()=>{},t:s=>s};
 const context=vm.createContext({crypto,TextEncoder,structuredClone,console,PPI18n:i18n,confirm:message=>{changes.push(message);return decisions.shift()??false;},document:{getElementById:id=>nodes.get(id),createElement:()=>new Node()},chrome:{storage:{local:area(local,"local"),sync:area(sync,"sync"),onChanged:{addListener:fn=>callbacks.push(fn)}},runtime:{getManifest:()=>({version:"2.1.0"})}},setTimeout,URL,Blob,navigator:{}});
 for(const file of ["settings.js","options.js"])vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),context);
 async function settle(){for(let i=0;i<5;i++)await tick();}
 await settle();
 // background側の更新受信を代替する。設定UI自体は本番ソースをそのまま実行する。
 callbacks.push((delta,name)=>{if(name==="sync")void context.CGCISettings.load();});
 return {S:context.CGCISettings,local,sync,nodes,changes,decisions,settle,writes:()=>writes,fail:value=>{fail=value;},async event(id,type){nodes.get(id).listeners[type]({preventDefault(){}});await settle();},async enable(){nodes.get("sync").checked=true;await this.event("sync","change");},async receive(text="別PC"){const config=context.CGCISettings.defaults();config.presets[0].chatgpt=text;await context.chrome.storage.sync.set(context.CGCISettings.pack(config));await settle();}};
}
test("設定スイッチは即時保存、ONだけでは送信せず更新受信で表示を更新",async()=>{
 const f=await fixture();await f.enable();assert.equal(f.local.syncEnabled,true);assert.equal(f.writes(),0);
 await f.receive();assert.equal(f.nodes.get("chatgpt-prompt").value,"別PC");assert.match(f.nodes.get("sync-status").textContent,/同期ON/);
});
test("編集中の受信は表示を保護、保存競合で上書きを止め、手動取込は確認後に適用",async()=>{
 const f=await fixture();await f.enable();await f.receive("以前");f.nodes.get("chatgpt-prompt").value="編集";await f.receive("新規");
 assert.equal(f.nodes.get("chatgpt-prompt").value,"編集");assert.match(f.nodes.get("sync-status").textContent,/編集中/);
 await f.event("settings","submit");assert.match(f.nodes.get("saved").textContent,/更新されています/);
 await f.event("sync-pull","click");assert.equal(f.nodes.get("chatgpt-prompt").value,"編集");
 f.decisions.push(true);await f.event("sync-pull","click");assert.equal(f.nodes.get("chatgpt-prompt").value,"新規");
});
test("プリセット保存は共有、PC設定だけの保存と取り込みは再送しない",async()=>{
 const f=await fixture();await f.enable();f.nodes.get("chatgpt-prompt").value="保存";await f.event("settings","submit");assert.equal(f.writes(),1);
 f.nodes.get("chatgpt-auto").checked=true;await f.event("settings","submit");await f.event("sync-pull","click");assert.equal(f.writes(),1);assert.equal(f.local.device2.chatgptAuto,true);
});
test("送信失敗後も編集を保持、補助再送は確認後に送信、復元は同期OFF",async()=>{
 const f=await fixture();await f.enable();f.fail(true);f.nodes.get("chatgpt-prompt").value="未送信";await f.event("settings","submit");
 assert.equal(f.local.config2.presets[0].chatgpt,"未送信");assert.equal(f.local.syncPending,true);await f.S.load();assert.equal(f.nodes.get("chatgpt-prompt").value,"未送信");
 f.fail(false);f.decisions.push(true);await f.event("sync-push","click");assert.equal(f.local.syncPending,false);assert.equal(f.writes(),1);
 f.decisions.push(true);await f.event("sync-restore","click");assert.equal(f.local.syncEnabled,false);assert.equal(f.nodes.get("chatgpt-prompt").value,"");assert.equal(f.writes(),1);
});
test("ファイル取込後の同期ONは未保存編集として扱い確認キャンセルで保持",async()=>{
 const f=await fixture();const config=f.S.defaults();config.presets[0].chatgpt="ファイル";
 f.nodes.get("import").files=[{size:200,text:async()=>JSON.stringify({format:"cgci-settings",version:2,config})}];
 await f.event("import","change");await f.enable();assert.equal(f.changes.length,1);assert.equal(f.nodes.get("sync").checked,false);assert.equal(f.nodes.get("chatgpt-prompt").value,"ファイル");
});

test("同期OFFでインポートした内容を補助保存の確認後に共有できる",async()=>{
 const f=await fixture();const config=f.S.defaults();config.presets[0].chatgpt="ファイルから共有";
 f.nodes.get("import").files=[{size:200,text:async()=>JSON.stringify({format:"cgci-settings",version:2,config})}];
 await f.event("import","change");f.decisions.push(true);await f.event("sync-push","click");
 assert.equal(f.local.syncEnabled,true);assert.equal(f.S.unpack(f.sync).config.presets[0].chatgpt,"ファイルから共有");assert.equal(f.writes(),1);
});
