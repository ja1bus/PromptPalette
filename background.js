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
    if (!Array.isArray(message.args) || !["load", "pull", "save", "setEnabled", "restore"].includes(message.method)) return;
    globalThis.PPI18n.init().then(() => globalThis.CGCISettings.execute(message.method, message.args))
      .then(state => reply({ ok: true, state })).catch(error => reply({ ok: false, error: error.message }));
    return true;
  }
  if (sender.id !== chrome.runtime.id || !isChat(sender.url) || sender.frameId !== 0) return;
  if (message?.type === "CGCI_OPTIONS") {
    chrome.runtime.openOptionsPage().then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
    return true;
  }
  if (message?.type === "CGCI_STATUS" && typeof message.text === "string") {
    if (typeof message.stage === "string") chrome.storage.local.set({ diagnostic2: {
      site: new URL(sender.url).hostname, stage: message.stage.slice(0, 80), error: !!message.error,
      done: !!message.done, time: new Date().toISOString()
    } }).catch(() => {});
    notice(sender.tab.id, message.text.slice(0, 2000), message.error ? "!" : message.done ? "✓" : "…")
      .then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
    return true;
  }
});

// Chromeからの到着を監視する。ヘッダーだけでなく、分割データの後着も再確認する。
const refreshSync = () => globalThis.PPI18n.init().then(() => globalThis.CGCISettings.load()).catch(() => {});
chrome.runtime.onStartup.addListener(() => void refreshSync());
chrome.runtime.onInstalled.addListener(() => void refreshSync());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && Object.keys(changes).some(key => key === "cgciHead" || /^cgciPart\d+$/.test(key)))
    void refreshSync();
});
