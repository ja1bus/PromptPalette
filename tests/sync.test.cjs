"use strict";
// 複数PC・配送遅延・順序逆転・オフライン・中断を再現した同期テスト（sync-net.cjs）。実Google配送の代用ではない。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Net, device, config, legacyItems, clone } = require("./sync-net.cjs");

async function group(n = 3, bodies = ["水彩", "線画", "サムネイル", "ぬりえ"]) {
  const net = new Net(), pcs = [];
  for (let i = 0; i < n; i++) pcs.push(net.pc(`PC${i + 1}`));
  const [first] = pcs;
  await first.S.save(config(...bodies), device);
  await first.S.setEnabled(true);
  const started = await first.S.start();
  assert.equal(started.result, "sent");
  await net.deliverAll();
  for (const pc of pcs.slice(1)) { const v = await pc.S.setEnabled(true); assert.equal(v.mode, "active"); }
  return { net, pcs };
}
const writesOf = pcs => pcs.map(pc => pc.writes);

test("既存3台へ4台目が参加しても4台目から初期値を送らず、既存PCを壊さない", async () => {
  const { net, pcs } = await group();
  const before = writesOf(pcs), fourth = net.pc("PC4");
  let v = await fourth.S.setEnabled(true);
  assert.equal(v.mode, "waiting"); assert.equal(fourth.writes, 0);
  v = await fourth.S.check();
  assert.equal(v.result, "none"); assert.equal(v.mode, "waiting"); assert.equal(fourth.writes, 0);
  // 受信待ち中の通常保存はローカルだけ。
  v = await fourth.edit(c => { c.presets[0].chatgpt = "4台目で入力"; });
  assert.equal(v.result, "waiting"); assert.equal(fourth.writes, 0); assert.equal(fourth.outbox.length, 0);
  await net.deliverAll();
  for (const pc of pcs) { await pc.S.check(); assert.deepEqual(pc.bodies(), ["水彩", "線画", "サムネイル", "ぬりえ"]); }
  // 後着した共有データで4台目の編集を消さず、確認を求める。
  v = await fourth.S.check();
  assert.equal(v.mode, "review"); assert.equal(fourth.bodies()[0], "4台目で入力"); assert.equal(v.held[0].count, 4);
  v = await fourth.S.resolve(v.held[0].id, "accept");
  assert.equal(v.mode, "active"); assert.deepEqual(fourth.bodies(), ["水彩", "線画", "サムネイル", "ぬりえ"]);
  assert.ok((await fourth.S.backups()).some(b => b.kept && b.filled === 1));
  assert.equal(fourth.writes, 0); assert.deepEqual(writesOf(pcs), before);
});

test("未入力の新しいPCは届いた内容で自動参加し、送信しない", async () => {
  const { net } = await group(2);
  const pc = net.pc("PC3"); await pc.S.setEnabled(true); await net.deliverAll();
  const v = await pc.S.check();
  assert.equal(v.result, "joined"); assert.equal(v.mode, "active"); assert.equal(pc.writes, 0); assert.equal(pc.bodies()[0], "水彩");
});

test("両方を残すと参加時に受信内容とこのPCの編集を結合して共有する", async () => {
  const { net, pcs } = await group(2);
  const pc = net.pc("PC3"); await pc.S.setEnabled(true);
  await pc.S.save(config("このPCだけ"), device);
  await net.deliverAll();
  let v = await pc.S.check();
  v = await pc.S.resolve(v.held[0].id, "merge");
  assert.equal(v.result, "sent"); assert.equal(pc.presets().length, 5);
  await net.deliverAll(); v = await pcs[0].S.check();
  assert.equal(v.result, "applied"); assert.ok(pcs[0].bodies().includes("このPCだけ")); assert.equal(pcs[0].presets().length, 5);
});

test("空の初期設定では共有を開始できず、届いているデータがあれば開始を止める", async () => {
  const net = new Net(), a = net.pc("A");
  await a.S.setEnabled(true);
  await assert.rejects(a.S.start(), e => e.code === "PP-SYNC-EMPTY");
  const b = net.pc("B"); await b.S.save(config("B"), device); await b.S.setEnabled(true); await b.S.start(); await net.deliverAll();
  await a.S.save(config("A"), device);
  await assert.rejects(a.S.start(), e => e.code === "PP-SYNC-EXISTS");
  assert.equal(a.writes, 0);
});

test("1台目として開始した後に既存データが後着しても、どちらも黙って消さない", async () => {
  const net = new Net(), a = net.pc("A"), b = net.pc("B");
  await a.S.save(config("Aの設定"), device); await a.S.setEnabled(true); await a.S.start();
  await b.S.save(config("Bの設定"), device); await b.S.setEnabled(true); await b.S.start(); // 届く前に双方が開始
  await net.deliverAll();
  const va = await a.S.check(), vb = await b.S.check();
  assert.equal(va.held[0].kind, "conflict"); assert.equal(vb.held[0].kind, "conflict");
  assert.equal(a.bodies()[0], "Aの設定"); assert.equal(b.bodies()[0], "Bの設定");
  await a.S.resolve(va.held[0].id, "merge"); await net.deliverAll();
  const after = await b.S.check();
  assert.equal(after.held.length, 0); assert.deepEqual(b.bodies().sort(), ["Aの設定", "Bの設定"].sort());
});

test("全本文が空になる更新・多数削除は保留し、利用者が確定すれば反映できる", async () => {
  const { net, pcs } = await group();
  const [a, b, c] = pcs;
  await a.edit(cfg => { cfg.presets.forEach(p => { p.chatgpt = ""; }); }); await net.deliverAll();
  let v = await b.S.check();
  assert.equal(v.held[0].kind, "destructive"); assert.ok(v.held[0].reasons.includes("empty"));
  assert.deepEqual(b.bodies(), ["水彩", "線画", "サムネイル", "ぬりえ"]);
  assert.ok(v.warning, "保留中は自動送信を止める警告を返す");
  v = await b.S.resolve(v.held[0].id, "accept");
  assert.deepEqual(b.bodies(), ["", "", "", ""]); assert.equal(b.writes, 0);
  // 別のPCは「このPCの内容で共有し直す」を選べる。
  v = await c.S.check(); v = await c.S.resolve(v.held[0].id, "keep"); assert.equal(v.result, "sent");
  await net.deliverAll(); await a.S.check(); await b.S.check();
  assert.deepEqual(a.bodies(), ["水彩", "線画", "サムネイル", "ぬりえ"]); assert.deepEqual(b.bodies(), ["水彩", "線画", "サムネイル", "ぬりえ"]);
  // 多数削除。
  await a.edit(cfg => { cfg.presets = cfg.presets.slice(0, 1); }); await net.deliverAll();
  v = await b.S.check(); assert.ok(v.held[0].reasons.includes("removed")); assert.equal(b.presets().length, 4);
});

test("1件の削除や本文変更は自動で反映し、上書き前の内容を履歴に残す", async () => {
  const { net, pcs } = await group();
  await pcs[0].edit(cfg => { cfg.presets.pop(); cfg.presets[0].chatgpt = "水彩・改"; }); await net.deliverAll();
  const v = await pcs[1].S.check();
  assert.equal(v.result, "applied"); assert.equal(pcs[1].presets().length, 3);
  assert.ok((await pcs[1].S.backups()).some(b => b.count === 4));
});

test("古い更新の後着・中間更新未到着でも新しい内容を戻さない", async () => {
  const { net, pcs } = await group();
  const [a, b, c] = pcs;
  await a.edit(cfg => { cfg.presets[0].chatgpt = "U1"; }); net.upload(a);
  await b.receive(); await b.S.check(); assert.equal(b.bodies()[0], "U1");
  await b.edit(cfg => { cfg.presets[0].chatgpt = "U2"; }); net.upload(b);
  // CはU1（Aの領域）を受け取らないまま、U2だけ先に届く。
  await c.receive({ filter: op => op.key.includes(b.local.sync3.dev) });
  let v = await c.S.check(); assert.equal(v.result, "applied"); assert.equal(c.bodies()[0], "U2");
  await c.receive(); v = await c.S.check(); // 古いU1が後着
  assert.equal(c.bodies()[0], "U2"); assert.equal(v.held.length, 0);
});

test("同時編集は双方で競合として保持し、一方の選択で全PCが揃う", async () => {
  const { net, pcs } = await group();
  const [a, b, c] = pcs;
  await a.edit(cfg => { cfg.presets[0].chatgpt = "Aの変更"; });
  await b.edit(cfg => { cfg.presets[1].chatgpt = "Bの変更"; });
  await net.deliverAll();
  const va = await a.S.check(), vb = await b.S.check(), vc = await c.S.check();
  assert.equal(va.held[0].kind, "conflict"); assert.equal(vb.held[0].kind, "conflict"); assert.equal(vc.held.length, 2);
  assert.equal(a.bodies()[0], "Aの変更"); assert.equal(b.bodies()[1], "Bの変更"); assert.equal(c.bodies()[0], "水彩");
  await a.S.resolve(va.held[0].id, "keep"); await net.deliverAll();
  const vb2 = await b.S.check(), vc2 = await c.S.check();
  assert.equal(vb2.held.length, 0); assert.equal(vc2.held.length, 0);
  assert.equal(b.bodies()[0], "Aの変更"); assert.equal(c.bodies()[0], "Aの変更");
  assert.ok((await b.S.backups()).length > 0);
});

test("オフラインで編集したPCが復帰しても、双方の変更を失わない", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs;
  b.online = false;
  const vOffline = await b.edit(cfg => { cfg.presets[0].chatgpt = "オフライン編集"; });
  assert.equal(vOffline.result, "sent", "Chromeはオフラインでも書込を受け付ける（到着とは別）");
  await a.edit(cfg => { cfg.presets[0].chatgpt = "オンライン編集"; });
  await net.deliverAll(); // bはオフラインなので未配送
  assert.equal((await a.S.check()).held.length, 0);
  b.online = true; await net.deliverAll();
  const va = await a.S.check(), vb = await b.S.check();
  assert.equal(va.held.length, 1); assert.equal(vb.held.length, 1);
  assert.equal(a.bodies()[0], "オンライン編集"); assert.equal(b.bodies()[0], "オフライン編集");
});

test("ヘッダーとチャンクの別到着、破損、不完全データでは反映しない", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs;
  await a.edit(cfg => { cfg.presets[0].chatgpt = "画".repeat(5000); }); net.upload(a);
  await b.receive({ filter: op => op.key.startsWith("pp3h.") });
  let v = await b.S.check(); assert.equal(v.result, "incomplete"); assert.equal(b.bodies()[0], "水彩");
  await b.receive(); v = await b.S.check(); assert.equal(v.result, "applied"); assert.equal(b.bodies()[0].length, 5000);
  // チャンクを先、ヘッダーを後に逆順で届ける。
  await a.edit(cfg => { cfg.presets[0].chatgpt = "逆順"; }); net.upload(a);
  await b.receive({ reverse: true }); v = await b.S.check(); assert.equal(b.bodies()[0], "逆順");
  // 破損（内容ハッシュ不一致）は無視する。
  await a.edit(cfg => { cfg.presets[0].chatgpt = "改ざん前"; }); net.upload(a);
  const part = b.inbox.find(op => op.key.startsWith("pp3c.")); part.value.s = part.value.s.replace("改ざん前", "改ざん後");
  await b.receive(); v = await b.S.check();
  assert.equal(b.bodies()[0], "逆順"); assert.equal(v.scan.corrupt, 1);
});

test("同期領域からデータが消えても、ローカルの全消去として扱わない", async () => {
  const { net, pcs } = await group();
  for (const key of Object.keys(net.server)) for (const pc of pcs) pc.inbox.push({ key, value: undefined });
  for (const pc of pcs) { await pc.receive(); const v = await pc.S.check(); assert.equal(v.mode, "active"); assert.equal(pc.presets().length, 4); }
});

test("容量超過・書込失敗はローカルを保持して未送信にし、再送で送れる", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs;
  let v = await a.edit(cfg => { cfg.presets.forEach(p => { p.chatgpt = "画".repeat(9000); }); });
  assert.equal(v.result, "failed"); assert.equal(v.code, "PP-SYNC-QUOTA"); assert.equal(v.unsent, true);
  assert.equal(a.bodies()[0].length, 9000);
  await a.edit(cfg => { cfg.presets.forEach(p => { p.chatgpt = "小"; }); });
  a.failWrites = true;
  v = await a.edit(cfg => { cfg.presets[0].chatgpt = "未送信"; });
  assert.equal(v.result, "failed"); assert.equal(v.unsent, true); assert.equal(a.bodies()[0], "未送信");
  a.boot(); // Chrome再起動後も未送信を保持
  v = await a.S.load(); assert.equal(v.unsent, true); assert.equal(v.config.presets[0].chatgpt, "未送信");
  a.failWrites = false; v = await a.S.resend(); assert.equal(v.result, "sent"); assert.equal(v.unsent, false);
  await net.deliverAll(); await b.S.check(); assert.equal(b.bodies()[0], "未送信");
  assert.equal((await a.S.resend()).result, "nothing");
});

test("書込中のworker停止から状態を復元する（書込済み／未書込）", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs;
  a.hang = "after"; void a.edit(cfg => { cfg.presets[0].chatgpt = "書込後に停止"; });
  await new Promise(resolve => setTimeout(resolve, 20));
  a.hang = undefined; a.boot();
  let v = await a.S.load(); assert.equal(v.unsent, false); assert.equal(a.local.sync3.outbox, null);
  await net.deliverAll(); await b.S.check(); assert.equal(b.bodies()[0], "書込後に停止");
  a.hang = "before"; void a.edit(cfg => { cfg.presets[0].chatgpt = "書込前に停止"; });
  await new Promise(resolve => setTimeout(resolve, 20));
  a.hang = undefined; a.boot();
  v = await a.S.load(); assert.equal(v.unsent, true); assert.equal(a.bodies()[0], "書込前に停止");
  assert.equal((await a.S.resend()).result, "sent");
});

test("再送は競合確認を通し、全体置換は影響を示して上書きし復元可能", async () => {
  const { net, pcs } = await group();
  const [a, b, c] = pcs;
  a.failWrites = true; await a.edit(cfg => { cfg.presets[0].chatgpt = "Aの未送信"; }); a.failWrites = false;
  await b.edit(cfg => { cfg.presets[1].chatgpt = "Bの変更"; }); await net.deliverAll();
  let v = await a.S.resend();
  assert.equal(v.result, "held"); assert.equal(v.held[0].kind, "conflict"); assert.equal(a.bodies()[1], "線画");
  const preview = await a.S.replacePreview();
  assert.equal(preview.local.count, 4); assert.equal(preview.held, 1);
  v = await a.S.replace(); assert.equal(v.result, "sent"); assert.equal(v.held.length, 0);
  await net.deliverAll(); await b.S.check(); await c.S.check();
  assert.equal(b.bodies()[0], "Aの未送信"); assert.equal(b.bodies()[1], "線画");
  assert.ok((await a.S.backups()).some(x => x.reason === "held-dropped"));
  assert.ok((await b.S.backups()).length > 0, "置換前の内容は受信側の履歴にも残る");
});

test("複数世代のバックアップ：重複排除・保持上限・保護・このPCだけの復元", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs;
  for (let i = 0; i < 30; i++) await a.edit(cfg => { cfg.presets[0].chatgpt = `版${i % 25}`; });
  const list = await a.S.backups();
  assert.ok(list.length <= 20); assert.ok(list.some(x => x.kept && x.reason === "before-start"));
  assert.equal(new Set(list.map(x => x.id)).size, list.length);
  const writes = a.writes, target = list.find(x => !x.kept);
  let v = await a.S.restore(target.id);
  assert.equal(v.result, "restored"); assert.equal(v.unsent, true); assert.equal(a.writes, writes);
  await net.deliverAll(); v = await b.S.check(); assert.notEqual(b.bodies()[0], a.bodies()[0]);
  // 未送信（復元）中に届いた更新は競合として保留し、復元内容を消さない。
  await b.edit(cfg => { cfg.presets[2].chatgpt = "Bの更新"; }); await net.deliverAll();
  v = await a.S.check(); assert.equal(v.held[0].kind, "conflict");
});

test("PC固有設定だけの保存・確認・取り込みでは送信しない、OFFは保持し削除しない", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs, before = a.writes;
  const state = await a.S.status();
  await a.S.save(state.config, { ...device, chatgptAuto: true }, state.token);
  await a.S.check(); await a.S.load(); await a.S.check();
  assert.equal(a.writes, before);
  const keys = Object.keys(net.server).length;
  await b.S.setEnabled(false); await a.edit(cfg => { cfg.presets[0].chatgpt = "OFF中の他PC更新"; }); await net.deliverAll();
  const vb = await b.S.load(); assert.equal(vb.mode, "off"); assert.equal(b.bodies()[0], "水彩");
  assert.equal(b.writes, 0); assert.ok(Object.keys(net.server).length >= keys);
  // OFF中の編集は再ONで未送信になり、届いた更新と競合として保持する。
  await b.edit(cfg => { cfg.presets[3].chatgpt = "OFF中の編集"; });
  const on = await b.S.setEnabled(true); assert.equal(on.unsent, true); assert.equal(on.held[0].kind, "conflict"); assert.equal(b.writes, 0);
});

test("手動操作の連打でも二重送信しない", async () => {
  const { pcs } = await group(2);
  const a = pcs[0]; a.failWrites = true; await a.edit(cfg => { cfg.presets[0].chatgpt = "連打"; }); a.failWrites = false;
  const before = a.writes;
  const results = await Promise.all([a.S.resend(), a.S.resend(), a.S.check(), a.S.resend()]);
  assert.equal(a.writes - before, 1); assert.deepEqual(results.map(r => r.result), ["sent", "nothing", "none", "nothing"]);
});

test("編集画面を開いた後に受信した更新を、古い編集の保存で黙って上書きしない", async () => {
  const { net, pcs } = await group(2);
  const [a, b] = pcs, opened = await b.S.status();
  await a.edit(cfg => { cfg.presets[0].chatgpt = "受信"; }); await net.deliverAll(); await b.S.check();
  const edited = clone(opened.config); edited.presets[1].chatgpt = "画面の編集";
  await assert.rejects(b.S.save(edited, device, opened.token), e => e.code === "PP-SYNC-CHANGED");
  await b.S.save(edited, device, opened.token, true);
  assert.ok((await b.S.backups()).some(x => x.kept && x.reason === "before-overwrite"));
});

test("旧版（2.1.0）からの移行：送信せず参加済み、旧バックアップを保護して取り込む", async () => {
  const net = new Net(), old = config("旧3台の設定", "二件目"), rev = "11111111-1111-4111-8111-111111111111";
  const backup = { config: config("消える前"), revision: "x", time: "2026-10-01T00:00:00.000Z" };
  const pcs = [0, 1, 2].map(i => net.pc(`PC${i + 1}`, { config2: old, device2: device, syncEnabled: true, syncRevision: rev, syncPending: false, ...(i === 0 ? { syncBackup: backup } : {}) }));
  Object.assign(net.server, legacyItems(old, rev));
  for (const pc of pcs) { Object.assign(pc.replica, clone(net.server)); const v = await pc.S.load(); assert.equal(v.mode, "active"); assert.equal(v.unsent, false); }
  assert.deepEqual(pcs.map(pc => pc.writes), [0, 0, 0]);
  assert.ok((await pcs[0].S.backups()).some(b => b.reason === "legacy" && b.kept && b.time === backup.time));
  assert.equal(pcs[0].local.cgciHead, undefined); assert.equal(pcs[0].local.syncRevision, rev, "旧キーは残す");
  // 新しい4台目は旧形式データから参加できる（未入力なら自動）。
  const fourth = net.pc("PC4"); Object.assign(fourth.replica, clone(net.server));
  let v = await fourth.S.setEnabled(true); assert.equal(v.mode, "active"); assert.equal(fourth.bodies()[0], "旧3台の設定"); assert.equal(fourth.writes, 0);
  // 移行後の編集は新方式で届き、旧形式キーは書き換えない。
  await pcs[0].edit(cfg => { cfg.presets[0].chatgpt = "新方式"; }); await net.deliverAll();
  for (const pc of [pcs[1], fourth]) { await pc.S.check(); assert.equal(pc.bodies()[0], "新方式"); }
  assert.equal(net.server.cgciHead.revision, rev);
});

test("旧版PCが旧形式キーを書き換えても自動反映せず、無視は再取り込みしない", async () => {
  const net = new Net(), old = config("旧"), rev = "22222222-2222-4222-8222-222222222222";
  const pc = net.pc("PC", { config2: old, device2: device, syncEnabled: true, syncRevision: rev });
  Object.assign(pc.replica, legacyItems(old, rev)); await pc.S.load();
  Object.assign(pc.replica, legacyItems(config(""), "33333333-3333-4333-8333-333333333333"));
  let v = await pc.S.check(); assert.equal(v.held[0].kind, "legacy"); assert.equal(pc.bodies()[0], "旧");
  v = await pc.S.resolve(v.held[0].id, "ignore"); v = await pc.S.check();
  assert.equal(v.held.length, 0); assert.equal(pc.bodies()[0], "旧"); assert.equal(pc.writes, 0);
  Object.assign(pc.replica, legacyItems(config("旧版で編集"), "44444444-4444-4444-8444-444444444444"));
  v = await pc.S.check(); v = await pc.S.resolve(v.held[0].id, "accept");
  assert.equal(v.result, "sent"); assert.equal(pc.bodies()[0], "旧版で編集");
  assert.equal(pc.replica.cgciHead.revision, "44444444-4444-4444-8444-444444444444");
});

test("旧版で未送信だったPC・同期OFFだったPCの移行", async () => {
  const pending = new Net().pc("P", { config2: config("未送信"), device2: device, syncEnabled: true, syncRevision: "r", syncPending: true });
  let v = await pending.S.load(); assert.equal(v.unsent, true); assert.equal(pending.writes, 0);
  const off = new Net().pc("O", { config2: config("OFF"), device2: device, syncEnabled: false, syncRevision: "r" });
  v = await off.S.load(); assert.equal(v.mode, "off"); assert.equal(v.joined, false);
});

test("未対応の将来形式を初期値へ変換せず、送信も止める", async () => {
  const { net, pcs } = await group(2);
  const a = pcs[0];
  a.replica["pp3h.future01"] = { v: 4, dev: "future01", rev: "zzzzzzzzzzzz" };
  let v = await a.S.check(); assert.equal(v.scan.unsupported, 1); assert.equal(a.presets().length, 4);
  v = await a.edit(cfg => { cfg.presets[0].chatgpt = "将来形式あり"; });
  assert.equal(v.code, "PP-SYNC-UNSUPPORTED"); assert.equal(v.unsent, true); assert.equal(a.bodies()[0], "将来形式あり");
  a.local.sync3.v = 2; await assert.rejects(a.S.load(), e => e.code === "PP-SYNC-STATE-NEWER");
  void net;
});

test("整理は取り込み済みの古い領域・旧形式だけを削除し現在の共有内容を残す", async () => {
  const net = new Net(), old = config("旧"), rev = "55555555-5555-4555-8555-555555555555";
  const a = net.pc("A", { config2: old, device2: device, syncEnabled: true, syncRevision: rev });
  const b = net.pc("B", { config2: old, device2: device, syncEnabled: true, syncRevision: rev });
  Object.assign(net.server, legacyItems(old, rev)); for (const pc of [a, b]) Object.assign(pc.replica, clone(net.server));
  await a.edit(cfg => { cfg.presets[0].chatgpt = "A1"; }); await net.deliverAll(); await b.S.check();
  await b.edit(cfg => { cfg.presets[0].chatgpt = "B1"; }); await net.deliverAll(); await a.S.check();
  const v = await a.S.cleanup(); assert.ok(v.removed > 0); await net.deliverAll();
  assert.equal(net.server.cgciHead, undefined);
  const late = net.pc("C"); Object.assign(late.replica, clone(net.server));
  await late.S.setEnabled(true); assert.equal(late.bodies()[0], "B1");
});

test("assessの基準：空欄化・多数削除・多数の本文消去を判定し、通常の変更は通す", () => {
  const S = new Net().pc("x").S, reasons = (a, b) => JSON.stringify([...S.assess(a, b).reasons].sort());
  const four = config("a", "b", "c", "d");
  assert.equal(reasons(config("a"), config("")), JSON.stringify(["empty"]));
  assert.equal(reasons(four, config("a")), JSON.stringify(["cleared", "removed"]));
  assert.equal(reasons(four, config("a", "b", "c")), JSON.stringify([]));
  assert.equal(reasons(four, config("a", "", "", "")), JSON.stringify(["cleared"]));
  assert.equal(reasons(config("a", "b"), config("a")), JSON.stringify([]));
  assert.equal(reasons(config(""), config("")), JSON.stringify([]));
});
