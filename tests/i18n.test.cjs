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
// ソース中のt("…")・t`…`（入れ子のテンプレートを含む）のキーがすべて辞書にあることを確認する。
function keysIn(src, out = new Set()) {
  const cook = raw => raw.replace(/\\(n|\\|`|\$|"|'|t)/g, (m, c) => ({ n: "\n", t: "\t" }[c] ?? c));
  const str = (s, i) => { const q = s[i]; let j = i + 1; while (s[j] !== q) { if (s[j] === "\\") j++; j++; } return { end: j + 1, value: q === '"' ? JSON.parse(s.slice(i, j + 1)) : s.slice(i + 1, j) }; };
  const expr = (s, i) => { let d = 1; const start = i; while (i < s.length) { const c = s[i]; if (c === "`") { i = tpl(s, i).end; continue; } if (c === '"' || c === "'") { i = str(s, i).end; continue; } if (c === "{") d++; if (c === "}" && --d === 0) return { end: i + 1, text: s.slice(start, i) }; i++; } throw new Error("expr"); };
  function tpl(s, i) {
    let key = "", raw = "", n = 0; const exprs = []; i++;
    while (i < s.length) {
      if (s[i] === "\\") { raw += s.slice(i, i + 2); i += 2; continue; }
      if (s[i] === "`") return { key: key + cook(raw), end: i + 1, exprs };
      if (s[i] === "$" && s[i + 1] === "{") { key += cook(raw) + `{${n++}}`; raw = ""; const e = expr(s, i + 2); exprs.push(e.text); i = e.end; continue; }
      raw += s[i++];
    }
    throw new Error("template");
  }
  for (let i = 0; i < src.length; i++) if (src[i] === "t" && !/[\w$.]/.test(src[i - 1] || "")) {
    if (src[i + 1] === "`") { const r = tpl(src, i + 1); out.add(r.key); r.exprs.forEach(e => keysIn(e, out)); }
    else if (src[i + 1] === "(" && src[i + 2] === '"') out.add(str(src, i + 2).value);
  }
  return out;
}
test("ソースのすべての翻訳キーが日英辞書にあり、利用者向け文に開発用ファイル名を含めない", () => {
  const ctx = fixture("auto", "ja"), catalog = ctx.PPMessageCatalog;
  const known = new Set(Object.values(catalog).flatMap(v => [v.source || v.ja, v.en]));
  for (const file of ["settings.js", "options.js", "content.js", "adapter.js", "gemini-adapter.js", "background.js"]) {
    for (const key of keysIn(fs.readFileSync(path.join(root, file), "utf8"))) assert.ok(known.has(key), `${file}: ${key}`);
  }
  for (const value of Object.values(catalog)) for (const lang of ["ja", "en"]) assert.doesNotMatch(value[lang], /adapter|\.js\b|DevTools/, value[lang]);
});
test("英語表示で同期画面・エラーの主要文が英語になる", async () => {
  const ctx = fixture("en", "ja"); await ctx.PPI18n.init();
  for (const ja of ["ほかのPCのプリセットを待っています。このPCからはまだ送信しません。", "このPCに届いている新しい更新はありません。Googleから強制的に取得する操作ではないため、ほかのPCの最新の変更がまだ届いていない場合があります。", "画像を自動で添付できませんでした。添付先を特定できなかったため、画像は添付していません。"])
    assert.ok(!/[ぁ-んァ-ン一-龯]/.test(ctx.PPI18n.t(ja)), ja);
});
