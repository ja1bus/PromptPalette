"use strict";
const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
const S = globalThis.CGCISettings;
const $ = id => document.getElementById(id);
let state, selected, baseline, draftImported = false, busy = false;
function dirty() { capture(); return draftImported || JSON.stringify({ config: state.config, device: device() }) !== baseline; }
function syncStatus() {
  $("sync-status").textContent = (state.pending ? t("同期への保存が未完了です。このPCの設定を保持しています。補助操作から再送できます。") : state.warning || (state.enabled ? t("同期ON：保存したプリセットを共有し、届いた更新を自動で取り込みます。") : t("同期OFF：このPCに保存します。")));
  $("sync-pull").disabled = !state.enabled;
}
function current() { return state.config.presets.find(p => p.id === selected); }
function capture() {
  if (!selected) return;
  Object.assign(current(), { name: $("name").value, shared: $("shared").checked, chatgpt: $("chatgpt-prompt").value,
    gemini: $("gemini-prompt").value, ratio: $("ratio").value });
  state.config.defaultId = $("default-preset").value;
}
function choices() {
  for (const id of ["preset", "default-preset"]) {
    $(id).replaceChildren();
    for (const p of state.config.presets) { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name || t("（名前未入力）"); $(id).append(o); }
  }
  $("preset").value = selected; $("default-preset").value = state.config.defaultId;
}
function edit() {
  const p = current(); choices();
  $("name").value = p.name; $("shared").checked = p.shared;
  $("chatgpt-prompt").value = p.chatgpt; $("gemini-prompt").value = p.gemini;
  $("gemini-prompt").disabled = p.shared; $("ratio").value = p.ratio;
}
function device() { return { source: $("source").value, chatgptAuto: $("chatgpt-auto").checked,
  geminiAuto: $("gemini-auto").checked, manualPaste: $("manual-paste").checked }; }
function render() {
  selected = state.config.defaultId; edit();
  $("source").value = state.device.source; $("chatgpt-auto").checked = state.device.chatgptAuto;
  $("gemini-auto").checked = state.device.geminiAuto; $("manual-paste").checked = state.device.manualPaste;
  $("sync").checked = state.enabled;
  draftImported = false;
  baseline = JSON.stringify({ config: state.config, device: state.device });
  syncStatus();
}
async function task(fn) {
  if (busy || !state) return;
  busy = true; $("settings").inert = true;
  try { await fn(); } catch (e) {
    $("saved").textContent = e.message;
    try { state.pending = (await S.local()).pending; syncStatus(); } catch { /* 編集内容を保持 */ }
  }
  finally { busy = false; $("settings").inert = false; }
}
$("preset").addEventListener("change", () => { capture(); selected = $("preset").value; edit(); });
$("shared").addEventListener("change", () => { $("gemini-prompt").disabled = $("shared").checked; });
$("name").addEventListener("change", () => { capture(); choices(); });
function add(copy) {
  capture(); if (state.config.presets.length >= 20) { $("saved").textContent = t("プリセットは20件までです。"); return; }
  const p = copy ? { ...current(), name: t`${current().name.slice(0,75)} 複製` } : { name: t("新しいプリセット"), shared: true, chatgpt: "", gemini: "", ratio: "" };
  p.id = crypto.randomUUID(); state.config.presets.push(p); selected = p.id; edit();
}
$("add").addEventListener("click", () => add(false)); $("duplicate").addEventListener("click", () => add(true));
$("delete").addEventListener("click", () => {
  if (state.config.presets.length === 1) return;
  if (!confirm(t("このプリセットを編集画面から削除しますか？保存するまでは再読み込みで戻せます。"))) return;
  state.config.presets = state.config.presets.filter(p => p.id !== selected);
  if (state.config.defaultId === selected) state.config.defaultId = state.config.presets[0].id;
  selected = state.config.defaultId; edit();
});
$("settings").addEventListener("submit", e => { e.preventDefault(); void task(async () => {
  capture();
  state = await S.save(state.config, device(), $("sync").checked, state.revision);
  render(); $("saved").textContent = state.uploaded ? t("このPCに保存し、Chrome同期領域へ書き込みました。他PCへの到着はChromeが処理します。") : t("このPCに保存しました。");
}); });
$("export").addEventListener("click", () => void task(async () => {
  capture(); const json = { format: "cgci-settings", version: 2, config: S.validate(state.config), device: device() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "promptpalette-settings.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}));
$("import").addEventListener("change", () => void task(async () => {
  const file = $("import").files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) throw new Error(t("設定ファイルが大きすぎます。"));
  let data; try { data = JSON.parse(await file.text()); } catch { throw new Error(t("対応する設定ファイルではありません。")); }
  if (data.format !== "cgci-settings" || data.version !== 2) throw new Error(t("対応する設定ファイルではありません。"));
  const config = S.validate(data.config);
  state.config = config; state.device = { source: data.device?.source === "file" ? "file" : "clipboard", chatgptAuto: false, geminiAuto: false, manualPaste: data.device?.manualPaste === true };
  state.enabled = false; render(); draftImported = true; $("saved").textContent = t("取り込みました。自動送信・同期はOFFです。保存で確定してください。"); $("import").value = "";
}));
$("open-shortcuts").addEventListener("click", async () => {
  try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); }
  catch { $("shortcut-notice").textContent = t("Chromeのアドレス欄に chrome://extensions/shortcuts を入力してください。"); }
});
$("diagnostic").addEventListener("click", async () => {
  const stored = await chrome.storage.local.get("diagnostic2");
  const text = JSON.stringify({ version: chrome.runtime.getManifest().version, ...stored.diagnostic2 }, null, 2);
  $("diagnostic-text").value = text;
  try { await navigator.clipboard.writeText(text); $("saved").textContent = t("診断情報をコピーしました。"); }
  catch { $("saved").textContent = t("診断欄を選択してCtrl+Cでコピーしてください。"); }
});
$("sync").addEventListener("change", () => void task(async () => {
  const enabled = $("sync").checked;
  if (enabled && dirty() && !confirm(t("同期をONにして取り込むと、未保存のプリセットとPC設定の編集を破棄します。続けますか？"))) {
    $("sync").checked = state.enabled; return;
  }
  try {
    const latest = await S.setEnabled(enabled);
    if (enabled) { state = latest; render(); }
    else { state.enabled = false; syncStatus(); }
    $("saved").textContent = enabled ? t("このPCの同期をONにしました。ONにするだけではプリセットを送信しません。") : t("このPCの同期をOFFにしました。");
  } catch (error) { $("sync").checked = state.enabled; throw error; }
}));
$("sync-pull").addEventListener("click", () => void task(async () => {
  if ((dirty() || state.pending) && !confirm(t("未保存の編集または未送信の変更を破棄し、同期済みのプリセットに置き換えますか？"))) return;
  const latest = await S.pull(true);
  if (latest.warning) { $("sync-status").textContent = latest.warning; return; }
  const updated = latest.revision !== state.revision || dirty() || state.pending;
  state = latest; render(); $("saved").textContent = updated ? t("同期済みのプリセットを取り込みました。") : t("取り込める更新はありません。");
}));
$("sync-push").addEventListener("click", () => void task(async () => {
  capture();
  if (!confirm(t("同期をONにし、この画面のプリセットを保存して同期先を置き換えます。初回登録・再送に使用してください。続けますか？"))) return;
  state = await S.save(state.config, device(), true, state.revision, true);
  render(); $("saved").textContent = t("このPCに保存し、Chrome同期領域へ書き込みました。他PCへの到着はChromeが処理します。");
}));
$("sync-restore").addEventListener("click", () => void task(async () => {
  if (!confirm(t("直前の保存・取り込み前のプリセットに戻し、このPCの同期をOFFにします。未保存の編集は破棄します。続けますか？"))) return;
  state = await S.restore(); render(); $("saved").textContent = t("直前のプリセットを復元しました。同期はOFFです。");
}));
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !state || busy || !["config2", "syncRevision", "syncPending", "syncEnabled"].some(key => key in changes)) return;
  try {
    const latest = await S.load();
    if (busy) return;
    if (dirty()) {
      if (latest.revision !== state.revision) $("sync-status").textContent = t("同期データが更新されています。編集中の内容は保持しています。取り込みボタンで反映できます。");
    } else { state = latest; render(); }
  } catch { /* 保存済みの表示と編集内容を保持する。 */ }
});
$("version").textContent = chrome.runtime.getManifest().version;
globalThis.PPI18n.init().then(() => { globalThis.PPI18n.apply(); $("language").value = globalThis.PPI18n.preference; return S.load(); }).then(async value => { state = value; render(); $("last-notice").textContent = (await chrome.storage.local.get("lastNotice")).lastNotice || t("操作記録はありません。"); })
  .catch(() => { $("saved").textContent = t("設定を読み込めません。拡張機能のエラーを確認してください。"); });

$("language").addEventListener("change", async () => {
  const previous = globalThis.PPI18n.preference;
  try {
    await chrome.storage.local.set({ uiLanguage: $("language").value });
    globalThis.PPI18n.set($("language").value); globalThis.PPI18n.apply();
    if (state) { capture(); edit(); syncStatus(); }
    $("saved").textContent = "";
    $("language-notice").textContent = t("表示言語を保存しました。実行メッセージには次回起動から反映します。");
  } catch {
    $("language").value = previous;
    $("language-notice").textContent = t("表示言語を保存できませんでした。");
  }
});
