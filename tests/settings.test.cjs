"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto").webcrypto;
function fixture(old = {}, shared = {}) {
  const local = structuredClone(old), sync = shared;
  let writes = 0;
  let rejectSync = false;
  const area = (data, isSync=false) => ({
    async get(keys) { if (keys === null) return structuredClone(data); if (typeof keys === "string") return {[keys]: data[keys]}; return structuredClone(data); },
    async set(values) { if (isSync && rejectSync) throw new Error("quota"); if (isSync) writes++; Object.assign(data, structuredClone(values)); }
  });
  const ctx = vm.createContext({chrome:{storage:{local:area(local),sync:area(sync,true)}},crypto,TextEncoder});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../settings.js"),"utf8"),ctx);
  return {S:ctx.CGCISettings,local,sync,reject:()=>{rejectSync=true;}, resume:()=>{rejectSync=false;}, writes:()=>writes};
}
const device = {source:"clipboard",chatgptAuto:false,geminiAuto:false,manualPaste:false};
test("旧プロンプトを移行し自動送信と同期をOFF",async()=>{
  const {S,local}=fixture({prompt:"旧本文",autoSend:true}); const s=await S.load();
  assert.equal(s.config.presets[0].chatgpt,"旧本文"); assert.equal(s.device.chatgptAuto,false);
  assert.equal(s.enabled,false); assert.equal(local.prompt,"旧本文");
});
test("日本語20,000文字を分割し各アイテム8KB以内",()=>{
  const {S}=fixture(); const c=S.defaults(); c.presets[0].chatgpt="画".repeat(20000);
  const packed=S.pack(c); for(const [k,v] of Object.entries(packed)) assert.ok(Buffer.byteLength(k+JSON.stringify(v))<8192);
  assert.equal(S.unpack(packed).config.presets[0].chatgpt,c.presets[0].chatgpt);
});
test("混在・欠損チャンクを拒否",()=>{
  const {S}=fixture(); const p=S.pack(S.defaults()); p.cgciPart0.revision="other";
  assert.throws(()=>S.unpack(p),/受信中/); delete p.cgciPart0; assert.throws(()=>S.unpack(p),/受信中/);
});
test("同期容量超過と重複IDを拒否",()=>{
  const {S}=fixture(); const c=S.defaults(); c.presets[0].chatgpt="画".repeat(20000); c.presets[0].gemini="画".repeat(20000);
  assert.throws(()=>S.pack(c),/同期容量/); c.presets.push({...c.presets[0]}); assert.throws(()=>S.validate(c),/不正/);
});
test("同期にPC設定を含めずOFF時に保持",async()=>{
  const {S,sync,local}=fixture(); let state=await S.load(); state.config.presets[0].chatgpt="共有本文";
  state=await S.save(state.config,{...device,chatgptAuto:true},true,state.revision,true);
  assert.ok(!JSON.stringify(sync).includes("chatgptAuto"));
  state=await S.save(state.config,device,false,state.revision);
  assert.equal(state.enabled,false); assert.equal(local.config2.presets[0].chatgpt,"共有本文"); assert.ok(sync.cgciHead);
});
test("同期の取り込みと同時編集の競合検出",async()=>{
  const {S,sync}=fixture(); let state=await S.load(); const other=S.defaults(); other.presets[0].chatgpt="他PC";
  Object.assign(sync,S.pack(other)); state=await S.setEnabled(true);
  assert.equal(state.config.presets[0].chatgpt,"他PC");
  Object.assign(sync,S.pack(other)); state.config.presets[0].chatgpt="編集中"; await assert.rejects(S.save(state.config,device,true,state.revision),/更新されています/);
});
test("同期保存失敗でもローカル変更と同期ONを保持",async()=>{
  const {S,local,reject}=fixture(); const state=await S.load(); state.config.presets[0].chatgpt="保持"; reject();
  await assert.rejects(S.save(state.config,device,true,"",true),/このPCには保存/);
  assert.equal(local.config2.presets[0].chatgpt,"保持"); assert.equal(local.syncEnabled,true);
});
test("不完全な同期ではローカルにフォールバックし警告",async()=>{
  const {S,sync,local}=fixture(); const state=await S.load(); local.syncEnabled=true;
  Object.assign(sync,S.pack(state.config)); delete sync.cgciPart0;
  const result=await S.load(); assert.match(result.warning,/取り込めません/);
});

test("同期保存失敗後の再読込で編集したローカル設定を古い同期設定で上書きしない",async()=>{
 const {S,local,reject}=fixture(); let state=await S.load(); state.config.presets[0].chatgpt="古い";
 state=await S.save(state.config,device,true,"",true); state.config.presets[0].chatgpt="新しい"; reject();
 await assert.rejects(S.save(state.config,device,true,state.revision));
 const result=await S.load(); assert.equal(result.config.presets[0].chatgpt,"新しい"); assert.match(result.warning,/未完了/);
});

test("ONにするだけでは送信せず同期データを取り込み、PC設定を保持", async()=>{
 const shared={}, a=fixture({},shared), b=fixture({device2:{...device,chatgptAuto:true}},shared);
 let sa=await a.S.load(); b.local.config2=structuredClone(sa.config); sa.config.presets[0].chatgpt="PC A";
 await a.S.save(sa.config,device,true,"",true);
 const sb=await b.S.setEnabled(true);
 assert.equal(sb.config.presets[0].chatgpt,"PC A"); assert.equal(sb.device.chatgptAuto,true); assert.equal(b.writes(),0);
});
test("初回ON・空同期はローカルを保持し自動アップロードしない", async()=>{
 const f=fixture(); await f.S.load(); const state=await f.S.setEnabled(true);
 assert.equal(f.writes(),0); assert.match(state.warning,/まだ届いて/); assert.equal(state.config.presets.length,1);
});
test("どちらのPCでも保存でき、取り込みやPC設定だけの保存は再送しない", async()=>{
 const shared={}, a=fixture({},shared), b=fixture({},shared);
 let sa=await a.S.load(); sa.config.presets[0].chatgpt="A"; sa=await a.S.save(sa.config,device,true,"",true);
 let sb=await b.S.setEnabled(true); sb.config.presets[0].chatgpt="B";
 sb=await b.S.save(sb.config,device,true,sb.revision);
 const rev=shared.cgciHead.revision;
 sa=await a.S.load(); assert.equal(sa.config.presets[0].chatgpt,"B");
 await a.S.save(sa.config,{...device,chatgptAuto:true},true,sa.revision);
 await a.S.load(); assert.equal(a.writes(),1); assert.equal(b.writes(),1); assert.equal(shared.cgciHead.revision,rev);
});
test("削除を含む一式置換、同期OFFでは更新を取り込まない", async()=>{
 const f=fixture(); let s=await f.S.load(); s.config.presets.push({...s.config.presets[0],id:"extra",name:"追加"});
 s=await f.S.save(s.config,device,true,"",true); const remote=f.S.defaults(); remote.presets[0].chatgpt="新規";
 Object.assign(f.sync,f.S.pack(remote)); s=await f.S.load(); assert.equal(s.config.presets.length,1);
 await f.S.setEnabled(false); remote.presets[0].chatgpt="次"; Object.assign(f.sync,f.S.pack(remote));
 s=await f.S.load(); assert.equal(s.config.presets[0].chatgpt,"新規"); assert.equal(s.enabled,false);
});
test("未送信の変更は受信から保護し、補助操作で再送できる", async()=>{
 const f=fixture(); let s=await f.S.load(); s=await f.S.save(s.config,device,true,"",true);
 s.config.presets[0].chatgpt="未送信"; f.reject(); await assert.rejects(f.S.save(s.config,device,true,s.revision));
 const old=f.S.defaults(); old.presets[0].chatgpt="他PC"; Object.assign(f.sync,f.S.pack(old));
 assert.equal((await f.S.load()).config.presets[0].chatgpt,"未送信");
 f.resume(); s=await f.S.save(s.config,device,true,s.revision,true);
 assert.equal(f.S.unpack(f.sync).config.presets[0].chatgpt,"未送信"); assert.equal(s.pending,false);
});
test("明示取り込みは未送信変更を置換し、直前の変更へ復元できる", async()=>{
 const f=fixture(); let s=await f.S.load(); s=await f.S.save(s.config,device,true,"",true);
 s.config.presets[0].chatgpt="保持対象"; f.reject(); await assert.rejects(f.S.save(s.config,device,true,s.revision));
 const remote=f.S.defaults(); remote.presets[0].chatgpt="受信"; Object.assign(f.sync,f.S.pack(remote));
 s=await f.S.pull(true); assert.equal(s.config.presets[0].chatgpt,"受信");
 const writes=f.writes(); s=await f.S.restore(); assert.equal(s.config.presets[0].chatgpt,"保持対象");
 assert.equal(s.enabled,false); assert.equal(f.writes(),writes);
});
test("ヘッダーとチャンクの後着で完全になってから反映",async()=>{
 const f=fixture(); await f.S.load(); await f.S.setEnabled(true);
 const remote=f.S.defaults(); remote.presets[0].chatgpt="後着"; const packed=f.S.pack(remote);
 f.sync.cgciHead=packed.cgciHead; const first=await f.S.load(); assert.match(first.warning,/取り込めません/);
 Object.assign(f.sync,packed); const final=await f.S.load(); assert.equal(final.config.presets[0].chatgpt,"後着"); assert.equal(final.warning,undefined);
});
test("同一PCで並んだ保存は直列化し古い編集による上書きを止める",async()=>{
 const f=fixture(); let s=await f.S.load(); s=await f.S.save(s.config,device,true,"",true);
 const c1=structuredClone(s.config), c2=structuredClone(s.config); c1.presets[0].chatgpt="先"; c2.presets[0].chatgpt="後";
 const results=await Promise.allSettled([f.S.save(c1,device,true,s.revision),f.S.save(c2,device,true,s.revision)]);
 assert.equal(results[0].status,"fulfilled"); assert.equal(results[1].status,"rejected"); assert.equal(f.S.unpack(f.sync).config.presets[0].chatgpt,"先");
});
