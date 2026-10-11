"use strict";
const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
const S = globalThis.CGCISettings;
const $ = id => document.getElementById(id);
// view：設定と同期状態の表示用データ。editToken：編集を始めた時点の内容ハッシュ（保存時に受信との行き違いを検出）。
let view, selected, baseline, savedConfig, editToken, draftImported = false, busy = false;
function dirty() { capture(); return draftImported || JSON.stringify({ config: view.config, device: device() }) !== baseline; }
function current() { return view.config.presets.find(p => p.id === selected); }
function capture() {
  if (!selected) return;
  Object.assign(current(), { name: $("name").value, shared: $("shared").checked, chatgpt: $("chatgpt-prompt").value,
    gemini: $("gemini-prompt").value, ratio: $("ratio").value });
  view.config.defaultId = $("default-preset").value;
}
function choices() {
  for (const id of ["preset", "default-preset"]) {
    $(id).replaceChildren();
    for (const p of view.config.presets) { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name || t("（名前未入力）"); $(id).append(o); }
  }
  $("preset").value = selected; $("default-preset").value = view.config.defaultId;
}
function edit() {
  const p = current(); choices();
  $("name").value = p.name; $("shared").checked = p.shared;
  $("chatgpt-prompt").value = p.chatgpt; $("gemini-prompt").value = p.gemini;
  $("gemini-prompt").disabled = p.shared; $("ratio").value = p.ratio;
}
function device() { return { source: $("source").value, chatgptAuto: $("chatgpt-auto").checked,
  geminiAuto: $("gemini-auto").checked, manualPaste: $("manual-paste").checked }; }
// 編集画面全体を保存済みの内容で描き直す。未保存の編集がある間は呼ばない。
function render() {
  selected = view.config.defaultId; edit();
  $("source").value = view.device.source; $("chatgpt-auto").checked = view.device.chatgptAuto;
  $("gemini-auto").checked = view.device.geminiAuto; $("manual-paste").checked = view.device.manualPaste;
  draftImported = false;
  baseline = JSON.stringify({ config: view.config, device: view.device });
  savedConfig = structuredClone(view.config); editToken = view.token;
  renderSync();
}
// 同期の状態表示だけを更新する。編集中の内容には触れない。
function syncView(next) { const keep = view; view = { ...next, config: keep.config, device: keep.device }; renderSync(); }
const when = iso => { try { return iso ? new Date(iso).toLocaleString(globalThis.PPI18n?.language === "en" ? "en-US" : "ja-JP") : ""; } catch { return iso; } };
function counts(count, filled) { return t`${count}件（本文あり${filled}件）`; }
function renderSync() {
  const v = view, box = $("sync-box"), info = [];
  $("sync").checked = v.enabled;
  const status = {
    off: t("共有はOFFです。プリセットはこのPCだけに保存されます。"),
    waiting: t("ほかのPCのプリセットを待っています。このPCからはまだ送信しません。"),
    review: t("ほかのPCのプリセットが届きました。このPCにもプリセットがあるため、自動では置き換えていません。下で使い方を選んでください。"),
    active: v.held.length ? t("確認が必要な更新があります。下の内容を確認してください。") : v.unsent ? t("このPCの変更を、まだほかのPCへ送信していません。") : t("ほかのPCとプリセットを共有しています。")
  }[v.mode];
  $("sync-status").textContent = status;
  box.className = `state${v.mode === "off" ? " off" : v.mode === "review" || v.held.length || v.unsent ? " attention" : ""}`;
  if (v.mode === "waiting") info.push(t("最初の1台として共有を始める場合は「このPCのプリセットで共有を始める」を押してください。2台目以降のPCでは、届くまで待つか「更新を確認」を押してください。待っている間に保存した内容は、このPCに残ります。"));
  if (v.mode !== "off") {
    info.push(t`このPCのプリセット：${counts(v.local.count, v.local.filled)}`);
    if (v.lastReceived) info.push(t`最終取り込み：${when(v.lastReceived)}`);
    if (v.lastSent) info.push(t`このPCから最後に送信：${when(v.lastSent)}（Chromeの同期領域への書き込みです。ほかのPCへの到着は確認できません）`);
    if (v.lastChecked) info.push(t`最後に確認：${when(v.lastChecked)}`);
    if (v.scan?.incomplete) info.push(t("受信途中のデータがあります。届き終わると自動で確認します。"));
    if (v.scan?.corrupt) info.push(t("読み取れない同期データがあったため、無視しました。"));
    if (v.scan?.unsupported) info.push(t("新しい版のPromptPaletteで作られた同期データがあります。このPCのPromptPaletteを更新してください。"));
    if (v.lastError && v.unsent) info.push(t("前回の送信は完了していません。このPCには保存済みです。"));
  }
  $("sync-info").replaceChildren(...info.map(text => { const li = document.createElement("li"); li.textContent = text; return li; }));
  $("sync-start").hidden = v.mode !== "waiting";
  $("sync-resend").hidden = !(v.mode === "active" && v.unsent && !v.held.length);
  $("sync-check").disabled = !v.enabled;
  $("sync-replace").disabled = !v.enabled; $("sync-cleanup").disabled = !(v.enabled && v.joined);
  renderHeld();
}
function heldCard(h) {
  const card = document.createElement("div"); card.className = "held";
  const title = document.createElement("p"); const strong = document.createElement("strong"); title.append(strong);
  strong.textContent = {
    join: t("ほかのPCのプリセットが届きました"),
    conflict: t("ほかのPCの変更と、このPCの変更が重なりました。どちらも保持しています。"),
    destructive: h.reasons.includes("empty") ? t("すべての本文を空にする更新が届きました。自動では反映していません。") : t("多くのプリセットを削除する（または本文を空にする）更新が届きました。自動では反映していません。"),
    legacy: t("旧版のPromptPaletteを使っているPCから更新が届きました。自動では反映していません。")
  }[h.kind];
  const lines = [t`届いた内容：${counts(h.count, h.filled)}／このPC：${counts(view.local.count, view.local.filled)}`];
  if (h.removed) lines.push(t`反映すると、このPCのプリセットが${h.removed}件なくなります。`);
  lines.push(t`受信：${when(h.received)}${h.at ? t`（作成：${when(h.at)}、送信したPCの時計）` : ""}`);
  card.append(title, ...lines.map(text => { const p = document.createElement("p"); p.textContent = text; return p; }));
  const actions = document.createElement("div"); actions.className = "actions";
  const add = (label, action, ask, cls) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (cls) b.className = cls;
    b.addEventListener("click", () => void task(async () => {
      if (dirty() && !confirm(t("未保存の編集があります。この操作で編集画面を保存済みの内容に戻します。続けますか？"))) return;
      if (ask && !confirm(ask)) return;
      const next = await S.resolve(h.id, action); view = next; render(); report(next);
    }));
    actions.append(b);
  };
  const backupNote = t("今のこのPCの内容はバックアップに残ります。");
  if (h.kind === "join") {
    add(t("届いたプリセットを使う"), "accept", t`このPCのプリセットを、届いたプリセットに置き換えます。${backupNote}続けますか？`);
    add(t("両方を残す"), "merge", t("届いたプリセットに、このPCのプリセットを追加して共有します。続けますか？"), "secondary");
  } else if (h.kind === "conflict") {
    add(t("受信した内容を使う"), "accept", t`このPCの内容を、受信した内容に置き換えます。${backupNote}続けますか？`);
    add(t("このPCの内容を使う"), "keep", t("このPCの内容をほかのPCにも送信します。受信した内容はバックアップに残ります。続けますか？"), "secondary");
    add(t("両方を残す"), "merge", t("このPCのプリセットに、受信したプリセットを追加して共有します。続けますか？"), "secondary");
  } else if (h.kind === "destructive") {
    add(t("この更新を反映する"), "accept", t`この更新を反映します。${backupNote}続けますか？`, "danger");
    add(t("このPCの内容で共有し直す"), "keep", t("このPCの内容をほかのPCにも送信し、届いた更新を取り消します。続けますか？"), "secondary");
  } else {
    add(t("この更新を反映する"), "accept", t`旧版のPCの内容をこのPCに反映し、新しい方式でほかのPCにも送信します。${backupNote}続けますか？`);
    add(t("無視する"), "ignore", t("この旧版の更新を取り込みません。続けますか？"), "secondary");
  }
  card.append(actions);
  return card;
}
function renderHeld() { $("sync-held").replaceChildren(...(view.enabled ? view.held.map(heldCard) : [])); }
const results = () => ({
  sent: t("保存しました。ほかのPCへの送信として、Chromeの同期領域へ書き込みました（ほかのPCへの到着は確認できません）。"),
  local: t("このPCに保存しました。"),
  waiting: t("このPCに保存しました。共有への参加前のため、ほかのPCへは送信していません。"),
  held: t("このPCに保存しました。確認が必要な更新があるため、まだ送信していません。"),
  none: t("このPCに届いている新しい更新はありません。Googleから強制的に取得する操作ではないため、ほかのPCの最新の変更がまだ届いていない場合があります。"),
  same: t("届いた更新は、このPCと同じ内容でした。"),
  applied: t("届いた更新を取り込みました。"),
  joined: t("届いたプリセットを取り込み、共有に参加しました。"),
  incomplete: t("受信途中のデータがあります。届き終わると自動で確認します。"),
  "pending-held": t("確認が必要な更新があります。下の内容を確認してください。"),
  nothing: t("未送信の変更はありません。"),
  resolved: t("選んだ内容をこのPCに反映しました。"),
  restored: t("このPCだけに復元しました。共有に参加中の場合は、まだほかのPCへ送信していません。共有するには「未送信の変更を送信」を押してください。"),
  off: t("共有はOFFです。")
});
function report(v, target = "saved") {
  const text = v.result === "failed" ? v.error : v.result === "cleaned" ? t`古い同期データを${v.removed}項目削除しました。` : results()[v.result];
  if (text) $(target).textContent = text;
}
async function task(fn) {
  if (busy || !view) return;
  busy = true; $("settings").inert = true; $("sync-section").inert = true;
  try { await fn(); } catch (e) {
    $("saved").textContent = e.message;
    try { syncView(await S.status()); } catch { /* 編集内容を保持 */ }
  }
  finally { busy = false; $("settings").inert = false; $("sync-section").inert = false; }
}
$("preset").addEventListener("change", () => { capture(); selected = $("preset").value; edit(); });
$("shared").addEventListener("change", () => { $("gemini-prompt").disabled = $("shared").checked; });
$("name").addEventListener("change", () => { capture(); choices(); });
function add(copy) {
  capture(); if (view.config.presets.length >= 20) { $("saved").textContent = t("プリセットは20件までです。"); return; }
  const p = copy ? { ...current(), name: t`${current().name.slice(0,75)} 複製` } : { name: t("新しいプリセット"), shared: true, chatgpt: "", gemini: "", ratio: "" };
  p.id = crypto.randomUUID(); view.config.presets.push(p); selected = p.id; edit();
}
$("add").addEventListener("click", () => add(false)); $("duplicate").addEventListener("click", () => add(true));
$("delete").addEventListener("click", () => {
  if (view.config.presets.length === 1) return;
  if (!confirm(t("このプリセットを編集画面から削除しますか？保存するまでは再読み込みで戻せます。"))) return;
  view.config.presets = view.config.presets.filter(p => p.id !== selected);
  if (view.config.defaultId === selected) view.config.defaultId = view.config.presets[0].id;
  selected = view.config.defaultId; edit();
});
$("settings").addEventListener("submit", e => { e.preventDefault(); void task(async () => {
  capture();
  const sharing = view.enabled && view.joined;
  if (sharing && draftImported && !confirm(t("読み込んだ設定を保存すると、ほかのPCにも送信されます。続けますか？"))) return;
  const impact = S.assess(savedConfig, view.config);
  if (sharing && impact.reasons.length && !confirm(t`多くのプリセットの削除、または本文を空にする変更です（なくなるプリセット：${impact.removed}件）。ほかのPCでは確認後に反映されます。保存しますか？`)) return;
  let next;
  try { next = await S.save(view.config, device(), editToken); }
  catch (error) {
    if (error.code !== "PP-SYNC-CHANGED") throw error;
    if (!confirm(t("編集中に、このPCのプリセットが更新されました（ほかのPCからの受信など）。この画面の内容で保存しますか？更新された内容はバックアップに残ります。"))) {
      $("saved").textContent = t("保存を取りやめました。編集内容は画面に残っています。"); return;
    }
    next = await S.save(view.config, device(), editToken, true);
  }
  view = next; render(); report(next);
}); });
$("export").addEventListener("click", () => void task(async () => {
  capture(); const json = { format: "cgci-settings", version: 2, config: S.validate(view.config), device: device() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "promptpalette-settings.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}));
$("import").addEventListener("change", () => void task(async () => {
  const file = $("import").files[0]; if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error(t("設定ファイルが大きすぎます。"));
    let data; try { data = JSON.parse(await file.text()); } catch { throw new Error(t("対応する設定ファイルではありません。")); }
    if (data?.format !== "cgci-settings") throw new Error(t("対応する設定ファイルではありません。"));
    // 将来の形式を推測で変換しない。
    if (Number.isInteger(data.version) && data.version > 2) throw new Error(t("このPromptPaletteより新しい形式の設定ファイルです。PromptPaletteを更新してください。"));
    if (data.version !== 2) throw new Error(t("対応する設定ファイルではありません。"));
    const config = S.validate(data.config), token = editToken, saved = savedConfig;
    view.config = config; view.device = { source: data.device?.source === "file" ? "file" : "clipboard", chatgptAuto: false, geminiAuto: false, manualPaste: data.device?.manualPaste === true };
    // 保存時の比較・行き違い検出は、読み込み前の保存済み内容を基準にする。
    render(); editToken = token; savedConfig = saved; draftImported = true;
    $("saved").textContent = t("読み込みました。自動送信はOFFです。「すべて保存」で確定してください。");
  } finally { $("import").value = ""; }
}));
$("open-shortcuts").addEventListener("click", async () => {
  try { await chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); }
  catch { $("shortcut-notice").textContent = t("Chromeのアドレス欄に chrome://extensions/shortcuts を入力してください。"); }
});
async function diagnosticText() {
  const stored = await chrome.storage.local.get("diagnostic2");
  let sync; try { sync = await S.diagnostics(); } catch { sync = { error: "unavailable" }; }
  return JSON.stringify({ version: chrome.runtime.getManifest().version, run: stored.diagnostic2 || null, ...sync }, null, 2);
}
$("diagnostic-show").addEventListener("click", async () => { $("diagnostic-text").value = await diagnosticText(); });
$("diagnostic").addEventListener("click", async () => {
  if (!confirm(t("診断情報をクリップボードにコピーします。クリップボードにコピーしている画像は置き換わります。続けますか？"))) return;
  const text = await diagnosticText(); $("diagnostic-text").value = text;
  try { await navigator.clipboard.writeText(text); $("saved").textContent = t("診断情報をコピーしました。"); }
  catch { $("saved").textContent = t("診断欄を選択してCtrl+Cでコピーしてください。"); }
});
// 同期スイッチはこのPCへ即時保存する。ONでも送信せず、届いている内容の確認だけ行う。
$("sync").addEventListener("change", () => void task(async () => {
  const enabled = $("sync").checked;
  try {
    const next = await S.setEnabled(enabled);
    if (dirty()) syncView(next); else { view = next; render(); }
    $("sync-result").textContent = enabled ? t("このPCの共有をONにしました。ONにするだけでは送信しません。") : t("このPCの共有をOFFにしました。このPCのプリセットは残り、ほかのPCの共有内容も削除しません。");
    if (enabled && next.result && next.result !== "none") report(next, "sync-result");
  } catch (error) { $("sync").checked = view.enabled; throw error; }
}));
$("sync-check").addEventListener("click", () => void task(async () => {
  const next = await S.check();
  if (dirty()) syncView(next); else { view = next; render(); }
  report(next, "sync-result");
  if (dirty() && ["applied", "joined"].includes(next.result)) $("sync-result").textContent += t("編集中の内容は画面に残しています。保存すると確認が表示されます。");
}));
$("sync-start").addEventListener("click", () => void task(async () => {
  if (dirty()) { $("sync-result").textContent = t("先に「すべて保存」でこのPCのプリセットを保存してください。"); return; }
  if (!confirm(t`このPCのプリセット（${counts(view.local.count, view.local.filled)}）で共有を始めます。ほかのPCがすでに共有している場合は使わないでください。続けますか？`)) return;
  const next = await S.start(); view = next; render(); report(next, "sync-result");
  if (next.result === "sent") $("sync-result").textContent = t("共有を始めました。ほかのPCでは共有をONにすると、届いたプリセットを取り込みます（Chromeの同期の到着後）。");
}));
$("sync-resend").addEventListener("click", () => void task(async () => {
  const next = await S.resend();
  if (dirty()) syncView(next); else { view = next; render(); }
  report(next, "sync-result");
}));
$("sync-replace").addEventListener("click", () => void task(async () => {
  if (dirty()) { $("sync-result").textContent = t("先に「すべて保存」でこのPCのプリセットを保存してください。"); return; }
  const p = await S.replacePreview();
  const shared = p.shared ? counts(p.shared.count, p.shared.filled) : t("不明");
  if (!confirm(t`共有内容を、このPCのプリセット（${counts(p.local.count, p.local.filled)}）で置き換えます。現在の共有内容：${shared}。なくなるプリセット：${p.removed}件。確認待ちの更新${p.held}件は取り込まずにバックアップへ残します。ほかのPCでは、削除が多い場合は確認後に反映されます。続けますか？`)) return;
  const next = await S.replace(); view = next; render(); report(next, "sync-result");
}));
$("sync-cleanup").addEventListener("click", () => void task(async () => {
  if (!confirm(t("このPCが取り込み済みの古い更新と旧版用の同期データを削除します。現在の共有内容とこのPCのプリセットは削除しません。旧版のPromptPaletteを使っているPCは、以後この同期データを受け取れません。続けますか？"))) return;
  const next = await S.cleanup(); syncView(next); report(next, "sync-result");
}));
const reasonLabel = reason => ({
  "before-save": t("保存前"), "before-receive": t("受信前"), "before-join": t("共有への参加前"), "before-accept": t("受信内容を使う前"),
  "before-merge": t("結合前"), "before-replace": t("置き換え前"), "before-restore": t("復元前"), "before-overwrite": t("上書き保存前"),
  "before-start": t("共有開始前"), "held-dropped": t("取り込まなかった受信内容"), migration: t("3.0.0への更新時"), legacy: t("旧版の直前バックアップ")
}[reason] || reason);
async function renderBackups() {
  const list = await S.backups();
  $("backup-list").replaceChildren(...list.map(b => { const o = document.createElement("option"); o.value = b.id;
    o.textContent = t`${when(b.time)} ・ ${reasonLabel(b.reason)} ・ ${counts(b.count, b.filled)}${b.kept ? t("（保護）") : ""}`; return o; }));
  $("restore").disabled = !list.length;
}
$("sync-advanced").addEventListener("toggle", () => { if ($("sync-advanced").open) void renderBackups().catch(() => {}); });
$("restore").addEventListener("click", () => void task(async () => {
  const id = $("backup-list").value; if (!id) return;
  if (!confirm(t("選んだ時点のプリセットを、このPCだけに復元します。今の内容はバックアップに残ります。未保存の編集は破棄します。続けますか？"))) return;
  const next = await S.restore(id); view = next; render(); report(next, "sync-result"); await renderBackups();
}));
// 別の画面・workerで状態が変わったら表示を更新する。ここからは受信処理を起動しない（status）。
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !view || busy || !["config2", "sync3", "syncEnabled"].some(key => key in changes)) return;
  try {
    const next = await S.status();
    if (busy) return;
    if (dirty()) {
      syncView(next);
      if (next.token !== editToken) $("sync-result").textContent = t("このPCのプリセットが更新されました（ほかのPCからの受信など）。編集中の内容は画面に残しています。");
    } else { view = next; render(); }
  } catch { /* 保存済みの表示と編集内容を保持する。 */ }
});
$("version").textContent = chrome.runtime.getManifest().version;
globalThis.PPI18n.init().then(() => { globalThis.PPI18n.apply(); $("language").value = globalThis.PPI18n.preference; return S.load(); }).then(async value => { view = value; render(); $("last-notice").textContent = (await chrome.storage.local.get("lastNotice")).lastNotice || t("操作記録はありません。"); })
  .catch(() => { $("saved").textContent = t("設定を読み込めません。設定画面を開き直してください。解決しない場合はChromeを再起動してください。"); });

$("language").addEventListener("change", async () => {
  const previous = globalThis.PPI18n.preference;
  try {
    await chrome.storage.local.set({ uiLanguage: $("language").value });
    globalThis.PPI18n.set($("language").value); globalThis.PPI18n.apply();
    if (view) { capture(); edit(); renderSync(); }
    $("saved").textContent = "";
    $("language-notice").textContent = t("表示言語を保存しました。実行メッセージには次回起動から反映します。");
  } catch {
    $("language").value = previous;
    $("language-notice").textContent = t("表示言語を保存できませんでした。");
  }
});
