"use strict";
// DOM実機テストとは分離した、実行制御の回帰テスト。外部依存なし。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
function fixture(overrides = {}) {
  const state = { text: "", attached: false, mode: false, generating: false, attachCalls: 0, sendCalls: 0, readCalls: 0, statuses: [], ...overrides };
  const elements = [];
  function element(tag) {
    const e = { tag, style: {}, children: [], listeners: {}, textContent: "", type: "", disabled: false,
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      setAttribute() {}, attachShadow() { return element("shadow"); }, remove() {},
      addEventListener(name, fn) { this.listeners[name] = fn; } };
    elements.push(e); return e;
  }
  const editor = { focus() {}, contains: e => e === editor, dispatchEvent() { state.pasteCalls = (state.pasteCalls || 0) + 1; state.attachCalls++; state.attached = true; } };
  const input = { dispatchEvent() { state.attachCalls++; state.attached = true; } };
  const send = { click() {
    state.sendCalls++;
    if (state.sendUrl) context.location.href = state.sendUrl;
    state.text = ""; state.attached = false; state.generating = true;
  } };
  const add = { getAttribute() { return "false"; }, click() {} };
  const item = { click() { state.mode = true; if (state.interfere) state.text = "ユーザーの下書き"; } };
  const adapter = {
    editor: () => editor, root: () => ({}), text: () => state.text,
    disabled: e => !e || !!e.disabled, generating: () => state.generating,
    hasAttachment: () => state.attached, otherMode: () => false,
    fileInput: () => state.noInput || (state.inputDelay && state.inputDelay-- > 0) ? null : input,
    fileInputSummary: () => ({ total: 4, camera: 1, image: 2, media: 1, generic: 0, other: 0, busy: 0 }),
    attachmentReady: () => state.attached && !state.neverReady,
    uploadError: () => false, modeSelected: () => state.mode, add: () => add, modeItem: () => item,
    insert: text => { state.text = state.inputMismatch ? text + "余分な文" : text; }, send: () => send,
    messageIds: () => new Set(),
    sentMessageVisible: () => state.sendCalls === 1 && !state.noReceipt && !state.wrongConversation,
    ratioSelected: r => !r || state.selectedRatio === r,
    ratioButton: () => ({ click() {} }), ratioItem: r => ({ click() { state.selectedRatio = r; } }),
    promptDiagnostic: () => "本文一致=NG、送信可能=OK、画像作成モード=OK、添付完了=OK"
  };
  let listener;
  const timers = new Set();
  const context = vm.createContext({
    CGCIAdapter: adapter, CGCIGeminiAdapter: adapter,
    CGCISettings: { ratios: ["", "1:1", "16:9"], load: async () => ({
      config: { defaultId: "default", presets: [{ id: "default", name: "標準", shared: true,
        chatgpt: state.noPrompt ? "" : "一行目\n二行目", gemini: "Gemini本文", ratio: state.ratio || "" }] },
      device: { chatgptAuto: !!state.autoSend, geminiAuto: !!state.autoSend, manualPaste: false }, warning: state.syncWarning
    }) }, console: { warn() {} }, AbortController, Event, URL: class extends URL { static createObjectURL() { return "blob:fixture"; } static revokeObjectURL() {} },
    location: { href: state.startUrl || "https://chatgpt.com/", origin: state.gemini ? "https://gemini.google.com" : "https://chatgpt.com" },
    document: { documentElement: element("root"), createElement: element, hasFocus: () => true, addEventListener() {}, removeEventListener() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    File: class { constructor(parts, name, options) { this.name = name; this.type = options.type; } },
    ClipboardEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    DataTransfer: class { constructor() { this.files = []; this.items = { add: f => this.files.push(f) }; } },
    navigator: { clipboard: { read: async () => {
      state.readCalls++;
      if (state.readPending) await state.readPending;
      return state.noImage ? [] : [{ types: ["image/png"], getType: async () => ({ size: 100 }) }];
    } } },
    chrome: { i18n: { getUILanguage: () => state.locale || "ja" }, runtime: { id: "fixture", onMessage: { addListener(fn) { listener = fn; } },
      sendMessage: async message => { if (message.type === "CGCI_STATUS") state.statuses.push(message); }, getManifest: () => ({ version: "3.0.0" }) },
      storage: { local: { get: async () => ({ prompt: state.noPrompt ? "" : "一行目\n二行目", autoSend: !!state.autoSend, manualPaste: false }) } } },
    setTimeout: (fn, ms) => { const id = setTimeout(fn, (state.neverReady && ms === 45000) || (state.noInput && ms === 3000) || (state.inputMismatch && ms === 10000) || ((state.noReceipt || state.wrongConversation) && ms === 15000) ? 30 : ms); timers.add(id); return id; },
    clearTimeout: id => { timers.delete(id); clearTimeout(id); },
    setInterval: (fn, ms) => { const id = setInterval(fn, ms); timers.add(id); return id; },
    clearInterval: id => { timers.delete(id); clearInterval(id); },
    requestAnimationFrame: fn => setImmediate(fn)
  });
  if (state.locale) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../locale-data.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../i18n.js"), "utf8"), context);
  }
  vm.runInContext(source, context);
  const start = () => listener({ type: "CGCI_START", source: state.source || "clipboard" }, { id: "fixture" }, () => {});
  const finish = async () => {
    for (let i = 0; i < 200; i++) {
      if (state.statuses.some(s => s.done || s.error)) return;
      const prepare = elements.findLast(e => e.textContent === (context.PPI18n?.t("準備する") || "準備する"));
      if (prepare && !prepare.clicked && !state.waitSelection) { prepare.clicked = true; prepare.listeners.click(); }
      const picker = elements.find(e => e.tag === "input" && e.type === "file");
      if (picker && !picker.handled) { picker.handled = true;
        if (state.cancelFile) picker.listeners.cancel();
        else { picker.files = [{ type: "image/png", size: 100 }]; picker.listeners.change(); }
      }
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    throw new Error("テストの実行が終了しませんでした。");
  };
  const close = () => { for (const timer of timers) { clearTimeout(timer); clearInterval(timer); } };
  return { state, start, finish, close, context, elements };
}
async function scenario(options, verify) {
  const f = fixture(options);
  try { f.start(); await f.finish(); await verify(f); } finally { f.close(); }
}
test("通常実行は画像・モード・複数行プロンプトを準備し送信しない", () => scenario({}, ({ state }) => {
  assert.equal(state.attachCalls, 1); assert.equal(state.mode, true);
  assert.equal(state.text, "一行目\n二行目"); assert.equal(state.sendCalls, 0);
}));
test("自動送信ONは1回だけ送信する", () => scenario({ autoSend: true }, ({ state }) => {
  assert.equal(state.attachCalls, 1); assert.equal(state.sendCalls, 1);
}));
test("新規チャットの送信による会話URLへの変更は正常終了する", () => scenario({ autoSend: true,
  sendUrl: "https://chatgpt.com/c/new-chat-123" }, ({ state }) => {
  assert.equal(state.sendCalls, 1);
  assert.equal(state.statuses.at(-1).done, true);
}));
test("別会話で今回の送信メッセージを検出できなければ停止し再送しない", () => scenario({ autoSend: true, wrongConversation: true,
  startUrl: "https://chatgpt.com/c/original", sendUrl: "https://chatgpt.com/c/another" }, ({ state }) => {
  assert.equal(state.sendCalls, 1);
  assert.equal(state.statuses.at(-1).error, true);
  assert.match(state.statuses.at(-1).text, /反映されたことを確認できません/);
}));
test("既存URLが送信後に変わっても今回の画像と本文の反映で正常終了する", () => scenario({ autoSend: true,
  startUrl: "https://chatgpt.com/c/temporary", sendUrl: "https://chatgpt.com/c/canonical" }, ({ state }) => {
  assert.equal(state.sendCalls, 1); assert.equal(state.statuses.at(-1).done, true);
}));
test("入力欄が空になっても送信メッセージを確認できなければ成功としない", () => scenario({ autoSend: true, noReceipt: true }, ({ state }) => {
  assert.equal(state.sendCalls, 1); assert.equal(state.statuses.at(-1).error, true);
}));
for (const [name, options] of [["設定なし", { noPrompt: true }], ["画像なし", { noImage: true }],
  ["既存入力文", { text: "既存文" }], ["既存添付", { attached: true }], ["生成中", { generating: true }]]) {
  test(`${name}では添付・送信しない`, () => scenario(options, ({ state }) => {
    assert.equal(state.attachCalls, 0); assert.equal(state.sendCalls, 0);
    assert.equal(state.statuses.at(-1).error, true);
    if (options.text) assert.equal(state.text, options.text);
  }));
}
test("連打とスクリプト再注入でも二重実行しない", async () => {
  let release;
  const f = fixture({ readPending: new Promise(resolve => { release = resolve; }) });
  try {
    f.start(); f.start(); vm.runInContext(source, f.context); f.start();
    await new Promise(resolve => setTimeout(resolve, 5)); release();
    await f.finish(); assert.equal(f.state.readCalls, 1); assert.equal(f.state.attachCalls, 1);
  } finally { f.close(); }
});
test("モード切替中にユーザーが入力した文を上書きしない", () => scenario({ interfere: true, autoSend: true }, ({ state }) => {
  assert.equal(state.text, "ユーザーの下書き"); assert.equal(state.sendCalls, 0);
}));
test("添付完了を確認できなければ停止し再添付しない", () => scenario({ neverReady: true, autoSend: true }, async f => {
  assert.equal(f.state.sendCalls, 0); assert.equal(f.state.attachCalls, 1);
  f.start(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.state.attachCalls, 1);
}));
test("自動送信OFFの再実行で下書きを重複させない", () => scenario({}, async f => {
  f.start(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.state.attachCalls, 1); assert.equal(f.state.sendCalls, 0);
}));
test("入力確認のタイムアウトでは診断を示し本文を保持して送信しない", () => scenario({ inputMismatch: true, autoSend: true }, ({ state }) => {
  assert.equal(state.sendCalls, 0);
  assert.equal(state.text, "一行目\n二行目余分な文");
  assert.match(state.statuses.at(-1).text, /本文一致=NG/);
  assert.match(state.statuses.at(-1).text, /プロンプト入力で停止/);
}));

test("ファイル選択から準備しクリップボードを読まない", () => scenario({source:"file"}, ({state}) => {
  assert.equal(state.readCalls,0); assert.equal(state.attachCalls,1); assert.equal(state.sendCalls,0);
}));
test("ファイル選択キャンセルは操作しない", () => scenario({source:"file",cancelFile:true,autoSend:true}, ({state}) => {
  assert.equal(state.attachCalls,0); assert.equal(state.sendCalls,0); assert.equal(state.statuses.at(-1).done,true);
}));
test("Geminiの指定比率を確認してから一度送信", () => scenario({gemini:true,ratio:"16:9",autoSend:true}, ({state}) => {
  assert.equal(state.selectedRatio,"16:9"); assert.equal(state.sendCalls,1);
}));
test("同期取得失敗時の自動送信は停止", () => scenario({autoSend:true,syncWarning:"同期取得失敗"}, ({state}) => {
  assert.equal(state.attachCalls,0); assert.equal(state.sendCalls,0);
}));

test("英語UIでも日本語本文を翻訳せず準備する", () => scenario({locale:"en-US"}, ({state}) => {
 assert.equal(state.text,"一行目\n二行目"); assert.equal(state.sendCalls,0);
 assert.match(state.statuses.at(-1).text,/Ready/); assert.ok(!/[ぁ-んァ-ン一-龯]/.test(state.statuses.at(-1).text));
}));
test("英語UIの画像なしエラー", () => scenario({locale:"en-US",noImage:true}, ({state}) => {
 assert.match(state.statuses.at(-1).text,/No supported image/); assert.equal(state.attachCalls,0);
}));

test("添付先のinputを特定できなければ添付せず、添付済みと表示せず、再試行できる", () => scenario({ noInput: true }, async f => {
  const last = f.state.statuses.at(-1);
  assert.equal(f.state.attachCalls, 0); assert.equal(last.error, true);
  assert.equal(last.code, "PP-ATTACH-INPUT-NOT-FOUND"); assert.equal(last.attach, "none"); assert.equal(last.inputs.camera, 1);
  assert.match(last.text, /添付・入力・送信は行っていません/); assert.match(last.text, /Ctrl\+V/);
  assert.doesNotMatch(last.text, /adapter|\.js|添付操作済み/);
  f.state.noInput = false; f.state.statuses.length = 0; f.start(); await f.finish();
  assert.equal(f.state.attachCalls, 1); assert.equal(f.state.statuses.at(-1).done, true);
}));
test("inputの描画遅延は短く待ってから1回だけ添付する", () => scenario({ inputDelay: 3 }, ({ state }) => {
  assert.equal(state.attachCalls, 1); assert.equal(state.statuses.at(-1).done, true);
}));
test("Geminiはinputがなければ従来どおり貼り付けで1回だけ添付する", () => scenario({ gemini: true, noInput: true }, ({ state }) => {
  assert.equal(state.pasteCalls, 1); assert.equal(state.attachCalls, 1); assert.equal(state.statuses.at(-1).done, true);
}));
test("添付操作後の失敗は再添付・再送信せず、ロックを維持して状況を伝える", () => scenario({ neverReady: true }, async f => {
  const last = f.state.statuses.at(-1);
  assert.equal(last.attach, "attempted"); assert.match(last.text, /添付操作を1回行いました/); assert.equal(last.code, "PP-TIMEOUT");
  f.start(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.state.attachCalls, 1); assert.equal(f.state.sendCalls, 0);
}));
test("英語UIの添付先未検出メッセージも開発者向けの案内を含まない", () => scenario({ locale: "en-US", noInput: true }, ({ state }) => {
  const last = state.statuses.at(-1).text;
  assert.ok(!/[ぁ-んァ-ン一-龯]/.test(last)); assert.doesNotMatch(last, /adapter|\.js/); assert.match(last, /Ctrl\+V/);
}));
