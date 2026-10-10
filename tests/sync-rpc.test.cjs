"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto").webcrypto;
test("本番workerを通したoptions保存・サイト読込と書込拒否、停止後の再読込",async()=>{
 const local={uiLanguage:"ja"},sync={};let messageListener;
 const event=()=>({addListener(){}});
 const area=data=>({get:async keys=>typeof keys==="string"?{[keys]:structuredClone(data[keys])}:structuredClone(data),set:async values=>Object.assign(data,structuredClone(values))});
 const chrome={i18n:{getUILanguage:()=>"ja"},runtime:{id:"ext",getURL:p=>`chrome-extension://ext/${p}`,onMessage:{addListener:f=>{messageListener=f;}},onStartup:event(),onInstalled:event()},storage:{local:area(local),sync:area(sync),onChanged:event()},action:{onClicked:event()},commands:{onCommand:event()}};
 const root=path.join(__dirname,"..");
 function boot(){const ctx=vm.createContext({chrome,crypto,TextEncoder,URL,Date});ctx.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx);};vm.runInContext(fs.readFileSync(path.join(root,"background.js"),"utf8"),ctx);}
 function client(url){const apiChrome={...chrome,runtime:{...chrome.runtime,sendMessage:message=>new Promise(resolve=>{const handled=messageListener(message,{id:"ext",url,frameId:0},resolve);if(!handled)resolve(undefined);})}};const ctx=vm.createContext({chrome:apiChrome,crypto,TextEncoder});vm.runInContext(fs.readFileSync(path.join(root,"settings.js"),"utf8"),ctx);return ctx.CGCISettings;}
 boot();const options=client("chrome-extension://ext/options.html"),site=client("https://chatgpt.com/");
 let state=await options.load();state=await options.setEnabled(true);assert.match(state.warning,/まだ届いて/);
 state.config.presets[0].chatgpt="RPC保存";
 state=await options.save(state.config,state.device,true,state.revision);assert.equal(sync.cgciHead.revision,state.revision);
 assert.equal((await site.load()).config.presets[0].chatgpt,"RPC保存");
 await assert.rejects(site.restore());await assert.rejects(site.save(state.config,state.device,true,state.revision));
 boot();assert.equal((await client("chrome-extension://ext/options.html").load()).config.presets[0].chatgpt,"RPC保存");
});
