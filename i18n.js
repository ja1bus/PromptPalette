"use strict";
(() => {
  if (globalThis.PPI18n) return;
  const catalog = globalThis.PPMessageCatalog;
  const keys = new Map(Object.entries(catalog).map(([key, value]) => [value.source || value.ja, key]));
  for (const [key, value] of Object.entries(catalog)) if (!keys.has(value.en)) keys.set(value.en, key);
  let language = "en", preference = "auto";
  function resolve(value, browserLanguage) {
    if (value === "ja" || value === "en") return value;
    return /^ja(?:[-_]|$)/i.test(browserLanguage || "") ? "ja" : "en";
  }
  function set(value) {
    preference = ["auto", "en", "ja"].includes(value) ? value : "auto";
    language = resolve(preference, chrome.i18n?.getUILanguage?.() || globalThis.navigator?.language || "en");
  }
  async function init() {
    try { set((await chrome.storage.local.get("uiLanguage")).uiLanguage || "auto"); }
    catch { set("auto"); }
  }
  function t(source, ...values) {
    // 動的な本文やプリセット名はパラメーターとしてそのまま扱い、翻訳しない。
    const key = typeof source === "string" ? source : source.reduce((text, part, index) => text + part + (index < values.length ? `{${index}}` : ""), "");
    const entry = catalog[keys.get(key)];
    const translated = entry?.[language] ?? key;
    return translated.replace(/\{(\d+)\}/g, (match, index) => Number(index) < values.length ? String(values[Number(index)]) : match);
  }
  function apply(root = document) {
    root.documentElement?.setAttribute("lang", language);
    for (const node of root.querySelectorAll("[data-pp-text]")) {
      const entry = catalog[node.getAttribute("data-pp-text")];
      if (entry) node.textContent = entry[language];
    }
    for (const node of root.querySelectorAll("[data-pp-aria-label]")) {
      const entry = catalog[node.getAttribute("data-pp-aria-label")];
      if (entry) node.setAttribute("aria-label", entry[language]);
    }
  }
  globalThis.PPI18n = { t, init, set, resolve, apply, get language() { return language; }, get preference() { return preference; } };
})();
