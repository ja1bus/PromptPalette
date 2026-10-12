"use strict";
globalThis.CGCISyncWorker = true;
if (typeof importScripts === "function") importScripts("locale-data.js", "i18n.js", "settings.js");
const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
const starting = new Set();
const isChat = url => { try { return ["https://chatgpt.com", "https://gemini.google.com"].includes(new URL(url).origin); } catch { return false; } };
async function notice(tabId, message, badge = "!") {
  await chrome.storage.local.set({ lastNotice: message });
  if (Number.isInteger(tabId)) {
    await chrome.action.setBadgeText({ tabId, text: badge });
    await chrome.action.setTitle({ tabId, title: message });
  }
}
async function start(tab, source) {
  if (starting.has(tab.id)) return;
  starting.add(tab.id);
  (async () => {
    await globalThis.PPI18n?.init();
    if (!isChat(tab.url)) {
      await notice(tab.id, t("ChatGPTまたはGeminiのチャットタブを前面にして実行してください。"));
      await chrome.runtime.openOptionsPage();
      return;
    }
    const settings = await chrome.storage.local.get("device2");
    source ||= settings.device2?.source || "clipboard";
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["locale-data.js", "i18n.js", "settings.js", "adapter.js", "gemini-adapter.js", "content.js"] });
    await chrome.tabs.sendMessage(tab.id, { type: "CGCI_START", source });
  })().catch(async () => {
    await notice(tab.id, t("起動できません。対象サイトを再読み込みして実行してください。途中の下書きは先に確認してください。"));
    await chrome.runtime.openOptionsPage();
  }).finally(() => starting.delete(tab.id));
}
// 診断には本文・画像・URLを含めない。コード・段階・件数だけを検証して残す。
function diagnostic(message, sender) {
  const pick = (value, pattern) => typeof value === "string" && pattern.test(value) ? value : undefined;
  const inputs = {};
  if (message.inputs && typeof message.inputs === "object")
    for (const key of ["total", "camera", "image", "media", "generic", "other", "busy"])
      if (Number.isInteger(message.inputs[key]) && message.inputs[key] >= 0 && message.inputs[key] < 100) inputs[key] = message.inputs[key];
  // 送信後の確認結果は件数と一致の有無だけ。
  const count = value => Number.isInteger(value) && value >= 0 && value < 100 ? value : undefined;
  const check = message.check && typeof message.check === "object"
    ? { fresh: count(message.check.fresh), textMatches: message.check.textMatches === true, images: count(message.check.images) } : undefined;
  return { version: chrome.runtime.getManifest?.().version, site: new URL(sender.url).hostname, stage: message.stage.slice(0, 80),
    stageId: pick(message.stageId, /^[a-z-]{1,30}$/), code: pick(message.code, /^PP-[A-Z0-9-]{1,40}$/),
    attach: pick(message.attach, /^(none|unknown|attempted)$/), sent: message.sent === true, inputs, check,
    error: !!message.error, warning: !!message.warning, done: !!message.done, time: new Date().toISOString() };
}
chrome.action.onClicked.addListener(tab => void start(tab));
chrome.commands.onCommand.addListener(async command => {
  if (!["clipboard-image", "file-image"].includes(command)) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) void start(tab, command === "file-image" ? "file" : "clipboard");
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === "CGCI_SETTINGS") {
    // 設定操作は自拡張のoptionsページからだけ受け付ける。contentは読込だけ。
    const options = sender.url === chrome.runtime.getURL("options.html");
    if (sender.id !== chrome.runtime.id || (!options && !(isChat(sender.url) && sender.frameId === 0 && message.method === "load"))) return;
    if (!Array.isArray(message.args) || !globalThis.CGCISettings.methods.includes(message.method)) return;
    globalThis.PPI18n.init().then(() => globalThis.CGCISettings.execute(message.method, message.args))
      .then(state => reply({ ok: true, state })).catch(error => reply({ ok: false, error: error.message, code: typeof error.code === "string" ? error.code : undefined }));
    return true;
  }
  if (sender.id !== chrome.runtime.id || !isChat(sender.url) || sender.frameId !== 0) return;
  if (message?.type === "CGCI_OPTIONS") {
    chrome.runtime.openOptionsPage().then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
    return true;
  }
  if (message?.type === "CGCI_STATUS" && typeof message.text === "string") {
    if (typeof message.stage === "string") chrome.storage.local.set({ diagnostic2: diagnostic(message, sender) }).catch(() => {});
    notice(sender.tab.id, message.text.slice(0, 2000), message.error ? "!" : message.warning ? "?" : message.done ? "✓" : "…")
      .then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
    return true;
  }
});

// Chromeからの到着を監視する。取り込みの判断はsettings.jsで行い、ここからは送信しない。
const refreshSync = () => globalThis.PPI18n.init().then(() => globalThis.CGCISettings.load()).catch(() => {});
chrome.runtime.onStartup.addListener(() => void refreshSync());
chrome.runtime.onInstalled.addListener(() => void refreshSync());
// 分割データは項目ごとに届くため、短くまとめてから確認する。workerが止まっても次の到着・起動で再確認する。
let refreshTimer;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && Object.keys(changes).some(key => /^pp3[hc]\./.test(key) || key === "cgciHead" || /^cgciPart\d+$/.test(key))) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refreshSync(), 300);
  }
});
