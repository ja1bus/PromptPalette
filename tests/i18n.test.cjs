"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
function fixture(preference, uiLanguage) {
  const ctx = vm.createContext({ chrome: {
    i18n: { getUILanguage: () => uiLanguage },
    storage: { local: { get: async () => ({ uiLanguage: preference }) } }
  } });
  for (const file of ["locale-data.js", "i18n.js"]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), ctx);
  return ctx;
}
test("自動はChromeの日本語だけja、他言語はen", async () => {
  for (const [ui, expected] of [["ja", "ja"], ["ja-JP", "ja"], ["en-US", "en"], ["de", "en"], ["zh-CN", "en"]]) {
    const ctx = fixture("auto", ui); await ctx.PPI18n.init(); assert.equal(ctx.PPI18n.language, expected);
  }
});
test("明示言語はChrome設定より優先し無効値は自動", async () => {
  const ctx = fixture("en", "ja"); await ctx.PPI18n.init(); assert.equal(ctx.PPI18n.t("設定"), "Settings");
  ctx.PPI18n.set("ja"); assert.equal(ctx.PPI18n.t("設定"), "設定");
  ctx.PPI18n.set("invalid"); assert.equal(ctx.PPI18n.preference, "auto");
});
test("動的パラメーターの日本語・HTML・置換記号を翻訳/再解釈しない", async () => {
  const ctx = fixture("en", "ja"); await ctx.PPI18n.init();
  const t = ctx.PPI18n.t, name = "設定 <img> {1}";
  const value = t`選択後に自動送信します。プリセット：${name}、比率：${"1:1"}`;
  assert.ok(value.includes(name)); assert.ok(value.endsWith("1:1"));
});
test("静的UIだけ翻訳しマークされていないユーザー入力を変更しない", async () => {
  const ctx = fixture("en", "ja"); await ctx.PPI18n.init();
  const key = Object.keys(ctx.PPMessageCatalog).find(k => ctx.PPMessageCatalog[k].ja === "設定");
  const node = { textContent: "設定", getAttribute: () => key }, user = { value: "設定" };
  let lang;
  ctx.PPI18n.apply({ documentElement: { setAttribute: (k, v) => { lang = v; } }, querySelectorAll: selector => selector === "[data-pp-text]" ? [node] : [] });
  assert.equal(node.textContent, "Settings"); assert.equal(user.value, "設定"); assert.equal(lang, "en");
  ctx.PPI18n.set("ja"); ctx.PPI18n.apply({ querySelectorAll: selector => selector === "[data-pp-text]" ? [node] : [] }); assert.equal(node.textContent, "設定");
});
test("全辞書・HTMLマーク・manifestメッセージの対応とアプリ名", () => {
  const ctx = fixture("auto", "ja");
  const catalogs = Object.fromEntries(["ja", "en"].map(lang => [lang, JSON.parse(fs.readFileSync(path.join(root, "_locales", lang, "messages.json"), "utf8"))]));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.default_locale, "en");
  for (const value of Object.values(catalogs)) assert.equal(value.extensionName.message, "PromptPalette");
  for (const [key, value] of Object.entries(ctx.PPMessageCatalog)) {
    for (const lang of ["ja", "en"]) assert.equal(catalogs[lang][key].message, value[lang]);
    assert.deepEqual([...value.ja.matchAll(/\{\d+\}/g)].map(m => m[0]).sort(), [...value.en.matchAll(/\{\d+\}/g)].map(m => m[0]).sort());
    assert.ok(!/[ぁ-んァ-ン一-龯]/.test(value.en));
  }
  const html = fs.readFileSync(path.join(root, "options.html"), "utf8");
  for (const match of html.matchAll(/data-pp-(?:text|aria-label)="([^"]+)"/g)) assert.ok(ctx.PPMessageCatalog[match[1]], match[1]);
  for (const match of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) assert.ok(catalogs.en[match[1]] && catalogs.ja[match[1]]);
});
