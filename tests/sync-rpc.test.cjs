"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto").webcrypto;
test("本番workerを通したoptions操作・サイトは読込のみ・エラーコードの伝達・停止後の再読込",async()=>{
 const local={uiLanguage:"ja"},sync={};let messageListener;
 const event=()=>({addListener(){}});
 const area=data=>({get:async keys=>typeof keys==="string"?(keys in data?{[keys]:structuredClone(data[keys])}:{}):structuredClone(data),set:async values=>Object.assign(data,structuredClone(values)),remove:async keys=>{for(const k of [].concat(keys))delete data[k];}});
 const chrome={i18n:{getUILanguage:()=>"ja"},runtime:{id:"ext",getManifest:()=>({version:"3.0.0"}),getURL:p=>`chrome-extension://ext/${p}`,onMessage:{addListener:f=>{messageListener=f;}},onStartup:event(),onInstalled:event()},storage:{local:area(local),sync:area(sync),onChanged:event()},action:{onClicked:event()},commands:{onCommand:event()}};
 const root=path.join(__dirname,"..");
 function boot(){const ctx=vm.createContext({chrome,crypto,TextEncoder,URL,Date});ctx.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx);};vm.runInContext(fs.readFileSync(path.join(root,"background.js"),"utf8"),ctx);}
 function client(url){const apiChrome={...chrome,runtime:{...chrome.runtime,sendMessage:message=>new Promise(resolve=>{const handled=messageListener(message,{id:"ext",url,frameId:0},resolve);if(!handled)resolve(undefined);})}};const ctx=vm.createContext({chrome:apiChrome,crypto,TextEncoder});vm.runInContext(fs.readFileSync(path.join(root,"settings.js"),"utf8"),ctx);return ctx.CGCISettings;}
 boot();const options=client("chrome-extension://ext/options.html"),site=client("https://chatgpt.com/");
 let state=await options.load();state=await options.setEnabled(true);assert.equal(state.mode,"waiting");
 await assert.rejects(options.start(),e=>e.code==="PP-SYNC-EMPTY");assert.equal(Object.keys(sync).length,0);
 state.config.presets[0].chatgpt="RPC保存";
 state=await options.save(state.config,state.device,state.token);assert.equal(state.result,"waiting");assert.equal(Object.keys(sync).length,0);
 state=await options.start();assert.equal(state.result,"sent");assert.ok(Object.keys(sync).some(k=>k.startsWith("pp3h.")));
 assert.equal((await site.load()).config.presets[0].chatgpt,"RPC保存");
 for(const method of ["restore","save","start","resend","replace","cleanup","setEnabled"])await assert.rejects(site[method]());
 boot();assert.equal((await client("chrome-extension://ext/options.html").load()).config.presets[0].chatgpt,"RPC保存");
 assert.equal(local.sync3.joined,true);
});
