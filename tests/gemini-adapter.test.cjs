"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
function fixture() {
 const doc={querySelectorAll:()=>[],createElement:()=>element("DIV")};
 const context=vm.createContext({document:doc,location:{origin:"https://gemini.google.com"}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../adapter.js"),"utf8"),context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../gemini-adapter.js"),"utf8"),context);
 return {A:context.CGCIGeminiAdapter,doc};
}
const text=s=>({nodeType:3,nodeValue:s});
function element(tag,...children) {return {nodeType:1,tagName:tag,childNodes:children,getAttribute:()=>null,matches:s=>tag==="MAT-ICON"||tag==="GEM-ICON"};}
test("Geminiのモードラベルはアイコン文字を除外",()=>{
 const {A}=fixture(); const button=element("BUTTON",element("MAT-ICON",text("image_create")),element("SPAN",text("画像を作成")),element("MAT-ICON",text("check")));
 assert.equal(A.label(button),"画像を作成");
 A.buttons=()=>[button]; A.visible=()=>true; assert.equal(A.modeItem(),button);
});
test("Geminiの画像解除ボタンでモードを確認し本文で代用しない",()=>{
 const {A}=fixture(); const mode=element("BUTTON"); mode.getAttribute=k=>k==="aria-label"?"画像の選択を解除":null;
 A.root=()=>({}); A.buttons=()=>[mode]; assert.equal(A.modeSelected(),true);
 A.buttons=()=>[element("BUTTON",text("画像を作成"))]; assert.equal(A.modeSelected(),false);
});
test("比率の未指定は操作不要、指定は表示/チェックで確認",()=>{
 const {A}=fixture(); A.ratioButton=()=>element("BUTTON",element("MAT-ICON",text("crop")),text("16:9")); A.ratioItem=()=>null;
 assert.equal(A.ratioSelected(""),true); assert.equal(A.ratioSelected("16:9"),true); assert.equal(A.ratioSelected("1:1"),false);
});
test("比率ボタンのaria-labelが現在値を含んでも検出・判定する",()=>{
 const {A}=fixture(); const button=label=>{const e=element("BUTTON",text(" 4:3 ")); e.getAttribute=k=>k==="aria-label"?label:null; return e;};
 for (const label of ["アスペクト比、4:3","Aspect ratio, 4:3"]) {
  const b=button(label); A.root=()=>({}); A.buttons=()=>[b]; A.ratioItem=()=>null;
  assert.equal(A.ratioButton(),b); assert.equal(A.ratioValue(b),"4:3"); assert.equal(A.ratioSelected("4:3"),true); assert.equal(A.ratioSelected("16:9"),false);
 }
 const plain=button("アスペクト比"); A.buttons=()=>[plain]; assert.equal(A.ratioButton(),plain); assert.equal(A.ratioSelected("4:3"),false);
});
test("Gemini送信確認は新規メッセージ・全文・画像が必要",()=>{
 const {A}=fixture(); const p=element("P",text("送信本文")); let image=true,id="user-query-content-1";
 const message={querySelector:()=>({id}),querySelectorAll:selector=>selector.includes("uploaded-img")?(image?[{}]:[]):[p]};
 A.userMessages=()=>[message]; A.visible=()=>true;
 assert.equal(A.sentMessageVisible("送信本文",new Set(["user-query-content-0"])),true);
 assert.equal(A.sentMessageVisible("違う本文",new Set()),false);
 id="user-query-content-0"; assert.equal(A.sentMessageVisible("送信本文",new Set([id])),false);
 id="user-query-content-1"; image=false; assert.equal(A.sentMessageVisible("送信本文",new Set()),false);
});

test("実画面のプロンプトを送信ボタンで添付完了を判定する",()=>{
 const {A}=fixture(); const send=element("BUTTON"); send.getAttribute=k=>k==="aria-label"?"プロンプトを送信":null;
 A.root=()=>({}); A.buttons=()=>[send]; A.previewImages=()=>[{complete:true,naturalWidth:536}];
 A.uploadBusy=()=>false; A.uploadError=()=>false;
 assert.equal(A.send(),send); assert.equal(A.attachmentReady(),true);
 send.disabled=true; assert.equal(A.attachmentReady(),false);
 send.disabled=false; A.buttons=()=>[]; assert.equal(A.attachmentReady(),false);
 assert.match(A.attachmentDiagnostic(),/送信ボタン検出=NG/);
});
