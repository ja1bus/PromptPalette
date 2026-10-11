"use strict";
// 設定の検証・初回移行・分割形式の単体テスト。複数PCの動作は sync.test.cjs。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Net, device, config, legacyItems } = require("./sync-net.cjs");

test("0.1.xの旧プロンプトを移行し自動送信と同期をOFF、旧キーを残す", async () => {
  const pc = new Net().pc("A", { prompt: "旧本文", autoSend: true });
  const v = await pc.S.load();
  assert.equal(v.config.presets[0].chatgpt, "旧本文"); assert.equal(v.device.chatgptAuto, false);
  assert.equal(v.enabled, false); assert.equal(v.mode, "off"); assert.equal(pc.local.prompt, "旧本文"); assert.equal(pc.writes, 0);
  assert.equal(pc.local.sync3.migrated, "", "新規導入は旧版からの移行扱いにしない");
});
test("新しい同期領域の各項目は8KB以内、日本語20,000文字×2を分割して1台分の上限内に収める", async () => {
  const net = new Net(), a = net.pc("A"), b = net.pc("B");
  const c = config("画".repeat(7000)); c.presets[0].gemini = "絵".repeat(7000);
  await a.S.save(c, device); await a.S.setEnabled(true); const v = await a.S.start();
  assert.equal(v.result, "sent");
  for (const [key, value] of Object.entries(a.replica)) assert.ok(Buffer.byteLength(key + JSON.stringify(value)) < 8192, key);
  await b.S.setEnabled(true); await net.deliverAll(); await b.S.check();
  assert.equal(b.local.config2.presets[0].gemini.length, 7000);
});
test("重複ID・件数・本文長・比率を検証する", () => {
  const S = new Net().pc("A").S, c = config("a");
  c.presets.push({ ...c.presets[0] }); assert.throws(() => S.validate(c), /不正/);
  assert.throws(() => S.validate({ schema: 2, defaultId: "p0", presets: [] }), /1〜20件/);
  const long = config("x".repeat(20001)); assert.throws(() => S.validate(long), /20,000/);
  const ratio = config("x"); ratio.presets[0].ratio = "2:1"; assert.throws(() => S.validate(ratio), /不正/);
  assert.throws(() => S.validate({ ...config("x"), schema: 3 }), /1〜20件/);
});
test("旧形式は読取専用で、混在・欠損チャンク・未対応schemaを受理しない", () => {
  const S = new Net().pc("A").S, items = legacyItems(config("旧"));
  assert.equal(S.unpackLegacy(items).config.presets[0].chatgpt, "旧");
  items.cgciPart0.revision = "other"; assert.throws(() => S.unpackLegacy(items), /incomplete/);
  delete items.cgciPart0; assert.throws(() => S.unpackLegacy(items), /incomplete/);
  assert.throws(() => S.unpackLegacy({ cgciHead: { schema: 3, revision: "r", count: 1 } }), e => e.unsupported === true);
});
test("PC設定は同期領域へ含めない", async () => {
  const a = new Net().pc("A");
  await a.S.save(config("共有本文"), { ...device, chatgptAuto: true, manualPaste: true }); await a.S.setEnabled(true); await a.S.start();
  const text = JSON.stringify(a.replica);
  assert.ok(!text.includes("chatgptAuto") && !text.includes("manualPaste") && !text.includes("uiLanguage"));
});
