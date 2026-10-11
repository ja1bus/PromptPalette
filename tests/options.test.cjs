"use strict";
// 設定画面（options.html/js）を、検証用ネットワーク上のPCのworker（settings.js）につないで操作する。
const { test } = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const { Net, device, config } = require("./sync-net.cjs");
const tick = () => new Promise(resolve => setImmediate(resolve));
const html = fs.readFileSync(path.join(__dirname, "../options.html"), "utf8");
async function screen(pc) {
  const nodes = new Map(), created = [], asked = [], decisions = [], clipboard = [];
  class Node {
    constructor(id, tag = "div") { Object.assign(this, { id, tag, value: "", checked: false, textContent: "", disabled: false, hidden: false, className: "", open: false, listeners: {}, children: [], attrs: {} }); }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    setAttribute(k, v) { this.attrs[k] = v; }
    replaceChildren(...items) { this.children = items; if (this.tag === "select" || !items.length) this.value = items[0]?.value ?? ""; }
    append(...items) { this.children.push(...items); if (this.tag === "select" && !this.value) this.value = items[0]?.value ?? ""; }
    get text() { return [this.textContent, ...this.children.map(c => c.text)].join(" "); }
  }
  for (const [, tag, id] of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) nodes.set(id, new Node(id, tag));
  const i18n = { preference: "ja", language: "ja", init: async () => {}, apply: () => {}, set: () => {}, t: (s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), "") };
  const storage = pc.ctx.chrome.storage;
  const ctx = vm.createContext({ crypto: globalThis.crypto, structuredClone, console, PPI18n: i18n, CGCISettings: pc.S, URL, Blob, setTimeout,
    confirm: message => { asked.push(message); return decisions.shift() ?? false; },
    navigator: { clipboard: { writeText: async text => { clipboard.push(text); } } },
    document: { getElementById: id => nodes.get(id), createElement: tag => { const n = new Node(undefined, tag); created.push(n); return n; } },
    chrome: { storage: { local: storage.local, onChanged: { addListener: fn => pc.listeners.push(fn) } }, runtime: { getManifest: () => ({ version: "3.0.0" }) } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../options.js"), "utf8"), ctx);
  // WebCryptoのハッシュはスレッドプールで完了するため、マイクロタスクだけでなく実時間も待つ。
  const settle = async () => { for (let i = 0; i < 25; i++) { await tick(); await new Promise(resolve => setTimeout(resolve, 1)); } };
  await settle();
  const $ = id => nodes.get(id);
  return { $, asked, decisions, clipboard, settle,
    async fire(id, type = "click") { $(id).listeners[type]({ preventDefault() {} }); await settle(); },
    button(label) { return created.filter(n => n.tag === "button" && n.textContent === label).at(-1); },
    async press(label) { const b = this.button(label); assert.ok(b, label); b.listeners.click(); await settle(); },
    held() { return $("sync-held").children.map(c => c.text).join("\n"); } };
}
async function joined(net) {
  const a = net.pc("A"); await a.S.save(config("水彩", "線画", "サムネイル"), device); await a.S.setEnabled(true); await a.S.start();
  return a;
}

test("共有スイッチは即時保存しONだけでは送信せず、受信待ちと1台目の操作を表示する", async () => {
  const pc = new Net().pc("A"), ui = await screen(pc);
  assert.match(ui.$("sync-status").textContent, /OFF/);
  ui.$("sync").checked = true; await ui.fire("sync", "change");
  assert.equal(pc.local.syncEnabled, true); assert.equal(pc.writes, 0);
  assert.match(ui.$("sync-status").textContent, /ほかのPCのプリセットを待っています。このPCからはまだ送信しません。/);
  assert.equal(ui.$("sync-start").hidden, false); assert.equal(ui.$("sync-resend").hidden, true);
  await ui.fire("sync-check");
  assert.match(ui.$("sync-result").textContent, /このPCに届いている新しい更新はありません/); assert.equal(pc.writes, 0);
  ui.decisions.push(true); await ui.fire("sync-start");
  assert.match(ui.$("saved").textContent, /本文のあるプリセットがない/); assert.equal(pc.writes, 0);
  ui.$("chatgpt-prompt").value = "最初の1台"; await ui.fire("settings", "submit");
  assert.match(ui.$("saved").textContent, /共有への参加前のため/); assert.equal(pc.writes, 0);
  ui.decisions.push(true); await ui.fire("sync-start");
  assert.equal(pc.writes, 1); assert.match(ui.$("sync-status").textContent, /共有しています/); assert.equal(ui.$("sync-start").hidden, true);
});

test("受信待ち中の編集は残し、届いた内容は確認してから使う", async () => {
  const net = new Net(); await joined(net);
  const b = net.pc("B"), ui = await screen(b);
  ui.$("sync").checked = true; await ui.fire("sync", "change");
  ui.$("chatgpt-prompt").value = "Bで入力"; await ui.fire("settings", "submit");
  await net.deliverAll(); await ui.fire("sync-check");
  assert.match(ui.$("sync-status").textContent, /自動では置き換えていません/); assert.equal(ui.$("chatgpt-prompt").value, "Bで入力");
  assert.match(ui.held(), /届いた内容：3件（本文あり3件）／このPC：1件（本文あり1件）/);
  ui.decisions.push(true); await ui.press("届いたプリセットを使う");
  assert.equal(ui.$("chatgpt-prompt").value, "水彩"); assert.equal(b.writes, 0); assert.match(ui.$("sync-status").textContent, /共有しています/);
});

test("編集中の受信は画面を保護し、保存時に確認して上書き前を残す", async () => {
  const net = new Net(), a = await joined(net), b = net.pc("B"); await b.S.setEnabled(true); await net.deliverAll(); await b.S.check();
  const ui = await screen(b);
  ui.$("chatgpt-prompt").value = "編集中";
  await a.edit(c => { c.presets[1].chatgpt = "Aの更新"; }); await net.deliverAll(); await b.S.check(); await ui.settle();
  assert.equal(ui.$("chatgpt-prompt").value, "編集中"); assert.match(ui.$("sync-result").textContent, /編集中の内容は画面に残しています/);
  await ui.fire("settings", "submit");
  assert.match(ui.asked.at(-1), /この画面の内容で保存しますか/); assert.match(ui.$("saved").textContent, /保存を取りやめました/);
  assert.equal(b.local.config2.presets[1].chatgpt, "Aの更新");
  ui.decisions.push(true); await ui.fire("settings", "submit");
  assert.equal(b.local.config2.presets[0].chatgpt, "編集中");
  assert.ok((await b.S.backups()).some(x => x.reason === "before-overwrite"));
});

test("多数削除の保存は送信前に確認し、受信側では保留カードを表示する", async () => {
  const net = new Net(), a = await joined(net), b = net.pc("B"); await b.S.setEnabled(true); await net.deliverAll(); await b.S.check();
  const ua = await screen(a), ub = await screen(b);
  ua.$("chatgpt-prompt").value = ""; ua.$("preset").value = "p1"; await ua.fire("preset", "change");
  ua.$("chatgpt-prompt").value = ""; ua.$("preset").value = "p2"; await ua.fire("preset", "change"); ua.$("chatgpt-prompt").value = "";
  await ua.fire("settings", "submit");
  assert.match(ua.asked.at(-1), /本文を空にする変更/); assert.equal(a.writes, 1);
  ua.decisions.push(true); await ua.fire("settings", "submit"); assert.equal(a.writes, 2);
  await net.deliverAll(); await ub.fire("sync-check");
  assert.match(ub.held(), /すべての本文を空にする更新/); assert.equal(ub.$("chatgpt-prompt").value, "水彩");
  ub.decisions.push(true, true); await ub.press("このPCの内容で共有し直す"); assert.equal(b.writes, 1);
});

test("競合カードで両方を残すと結合して送信し、未送信の再送ボタンは状態に応じて出る", async () => {
  const net = new Net(), a = await joined(net), b = net.pc("B"); await b.S.setEnabled(true); await net.deliverAll(); await b.S.check();
  const ub = await screen(b);
  b.failWrites = true; ub.$("chatgpt-prompt").value = "Bの未送信"; await ub.fire("settings", "submit"); b.failWrites = false;
  assert.match(ub.$("saved").textContent, /書き込めませんでした/); assert.equal(ub.$("sync-resend").hidden, false);
  await a.edit(c => { c.presets[2].chatgpt = "Aの変更"; }); await net.deliverAll();
  await ub.fire("sync-check"); assert.match(ub.held(), /どちらも保持しています/); assert.equal(ub.$("sync-resend").hidden, true);
  ub.decisions.push(true); await ub.press("両方を残す");
  assert.equal(b.local.config2.presets.length, 5, "同じIDで内容が違うプリセットは複製して両方残す"); assert.equal(b.writes, 1);
});

test("復元はこのPCだけ、バックアップは時点と件数で選べる", async () => {
  const net = new Net(), a = await joined(net), ui = await screen(a), writes = a.writes;
  ui.$("chatgpt-prompt").value = "変更1"; await ui.fire("settings", "submit");
  ui.$("sync-advanced").open = true; await ui.fire("sync-advanced", "toggle");
  const options = ui.$("backup-list").children; assert.ok(options.length >= 1); assert.match(options[0].textContent, /件（本文あり/);
  ui.$("backup-list").value = options.find(o => /共有開始前/.test(o.textContent)).value; // 同じ内容の「保存前」は保護済みの1件にまとまる
  ui.decisions.push(true); await ui.fire("restore");
  assert.equal(ui.$("chatgpt-prompt").value, "水彩"); assert.equal(a.writes, writes + 1);
  assert.match(ui.$("sync-result").textContent, /このPCだけに復元しました/); assert.equal(ui.$("sync-resend").hidden, false);
});

test("JSONのエクスポート形式、インポートの検証と共有時の確認、将来形式の拒否", async () => {
  const net = new Net(), a = await joined(net), ui = await screen(a);
  ui.$("import").files = [{ size: 200, text: async () => JSON.stringify({ format: "cgci-settings", version: 3, config: config("x") }) }];
  await ui.fire("import", "change"); assert.match(ui.$("saved").textContent, /新しい形式/); assert.equal(ui.$("chatgpt-prompt").value, "水彩");
  ui.$("import").files = [{ size: 200, text: async () => JSON.stringify({ format: "cgci-settings", version: 2, config: config("ファイル"), device: { ...device, chatgptAuto: true } }) }];
  await ui.fire("import", "change"); assert.equal(ui.$("chatgpt-prompt").value, "ファイル"); assert.equal(ui.$("chatgpt-auto").checked, false);
  await ui.fire("settings", "submit"); assert.match(ui.asked.at(-1), /読み込んだ設定を保存すると/); assert.equal(a.local.config2.presets[0].chatgpt, "水彩");
  ui.decisions.push(true, true); await ui.fire("settings", "submit");
  assert.equal(a.local.config2.presets[0].chatgpt, "ファイル"); assert.match(ui.asked.at(-1), /多くのプリセットの削除/);
});

test("診断は本文を含めず、コピー前にクリップボード上書きを確認する", async () => {
  const net = new Net(), a = await joined(net), ui = await screen(a);
  await ui.fire("diagnostic-show");
  const text = ui.$("diagnostic-text").value; assert.match(text, /"mode": "active"/); assert.doesNotMatch(text, /水彩|線画|プリセット0/);
  await ui.fire("diagnostic"); assert.equal(ui.clipboard.length, 0); assert.match(ui.asked.at(-1), /画像は置き換わります/);
  ui.decisions.push(true); await ui.fire("diagnostic"); assert.equal(ui.clipboard.length, 1);
});
