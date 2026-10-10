"use strict";
// 共有設定はバージョン付きスナップショット。画像・自動送信は同期しない。
(() => {
  const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
  if (globalThis.CGCISettings) return;
  const ratios = ["", "1:1", "9:16", "3:4", "4:3", "16:9"];
  const defaults = () => ({ schema: 2, defaultId: "default", presets: [
    { id: "default", name: t("標準"), shared: true, chatgpt: "", gemini: "", ratio: "" }
  ] });
  function validate(value) {
    if (!value || value.schema !== 2 || !Array.isArray(value.presets) || !value.presets.length || value.presets.length > 20)
      throw new Error(t("プリセットは1〜20件で指定してください。"));
    const ids = new Set();
    const presets = value.presets.map(p => {
      if (!p || typeof p.id !== "string" || !/^[\w-]{1,80}$/.test(p.id) || ids.has(p.id) ||
          typeof p.name !== "string" || !p.name.trim() || p.name.length > 80 || typeof p.shared !== "boolean" ||
          typeof p.chatgpt !== "string" || typeof p.gemini !== "string" || p.chatgpt.length > 20000 || p.gemini.length > 20000 || !ratios.includes(p.ratio))
        throw new Error(t("プリセットの形式が不正です。本文は各20,000文字以内です。"));
      ids.add(p.id);
      return { id: p.id, name: p.name.trim(), shared: p.shared, chatgpt: p.chatgpt, gemini: p.gemini, ratio: p.ratio };
    });
    if (!ids.has(value.defaultId)) throw new Error(t("既定のプリセットがありません。"));
    return { schema: 2, defaultId: value.defaultId, presets };
  }
  async function local() {
    const old = await chrome.storage.local.get(null);
    if (!old.config2) {
      const config = defaults();
      config.presets[0].chatgpt = typeof old.prompt === "string" ? old.prompt : "";
      // 移行時は自動送信をOFFに戻し、旧設定そのものは残す。
      await chrome.storage.local.set({ config2: config, device2: { source: "clipboard", chatgptAuto: false,
        geminiAuto: false, manualPaste: !!old.manualPaste }, syncEnabled: false });
      return local();
    }
    return { config: validate(old.config2), device: { source: "clipboard", chatgptAuto: false,
      geminiAuto: false, manualPaste: false, ...old.device2 }, enabled: old.syncEnabled === true, revision: old.syncRevision || "", pending: old.syncPending === true };
  }
  function pack(config) {
    const data = JSON.stringify(validate(config));
    const revision = crypto.randomUUID();
    const result = { cgciHead: { schema: 2, revision, count: Math.ceil(data.length / 1000) } };
    // 全スロットを一括更新し、以前の長い設定の余剰チャンクが容量を占有しないようにする。
    if (result.cgciHead.count > 100) throw new Error(t("同期容量を超えます。同期をOFFにしてください。"));
    for (let i = 0; i < 100; i++) result[`cgciPart${i}`] = { revision, text: data.slice(i * 1000, (i + 1) * 1000) };
    const bytes = Object.entries(result).reduce((n, [k, v]) => n + new TextEncoder().encode(k + JSON.stringify(v)).length, 0);
    if (bytes > 90000 || result.cgciHead.count > 200) throw new Error(t("同期容量を超えます。プリセットを減らすか、同期をOFFにしてください。"));
    return result;
  }
  function unpack(items) {
    const head = items.cgciHead;
    if (!head) return null;
    if (head.schema !== 2 || typeof head.revision !== "string" || !Number.isInteger(head.count) || head.count < 1 || head.count > 200)
      throw new Error(t("同期データの形式が不正です。"));
    let data = "";
    for (let i = 0; i < head.count; i++) {
      const part = items[`cgciPart${i}`];
      if (part?.revision !== head.revision || typeof part.text !== "string") throw new Error(t("同期データを受信中です。しばらくして再読み込みしてください。"));
      data += part.text;
    }
    return { config: validate(JSON.parse(data)), revision: head.revision };
  }
  async function remote() { return unpack(await chrome.storage.sync.get(null)); }
  const same = (a, b) => JSON.stringify(validate(a)) === JSON.stringify(validate(b));
  async function remember(state, config) {
    if (!same(state.config, config)) await chrome.storage.local.set({ syncBackup: {
      config: state.config, revision: state.revision, time: new Date().toISOString()
    } });
  }
  async function pull(force = false) {
    const state = await local();
    if (!state.enabled) return state;
    if (state.pending && !force) {
      state.warning = t("同期への保存が未完了です。このPCの設定を保持しています。補助操作から再送できます。");
      return state;
    }
    try {
      const synced = await remote();
      if (!synced) {
        state.warning = t("同期データがまだ届いていません。初回登録は補助操作から行えます。");
        return state;
      }
      if (synced.revision !== state.revision || force) {
        await remember(state, synced.config);
        await chrome.storage.local.set({ config2: synced.config, syncRevision: synced.revision, syncPending: false });
        state.config = synced.config; state.revision = synced.revision; state.pending = false;
      }
    } catch {
      state.warning = t("同期データを取り込めません。受信途中の場合は到着後に再確認します。このPCの設定を保持しています。");
    }
    return state;
  }
  async function load() { return pull(); }
  async function setEnabled(enabled) {
    if (typeof enabled !== "boolean") throw new Error(t("PC設定が不正です。"));
    await local(); // 初回移行で同期スイッチがOFFへ戻る前に初期化する。
    await chrome.storage.local.set({ syncEnabled: enabled });
    return enabled ? pull() : local();
  }
  async function save(config, device, enabled, expectedRevision, publish = false) {
    config = validate(config);
    if (typeof enabled !== "boolean" || typeof publish !== "boolean" || !device || !["clipboard", "file"].includes(device.source) ||
        ["chatgptAuto", "geminiAuto", "manualPaste"].some(k => typeof device[k] !== "boolean")) throw new Error(t("PC設定が不正です。"));
    const prior = await local();
    const changed = !same(config, prior.config);
    // 同期ONへの切替だけでは送信しない。UIではスイッチを即時保存する。
    if (enabled && !prior.enabled && !publish) {
      await chrome.storage.local.set({ device2: device, syncEnabled: true });
      return pull();
    }
    if (enabled && (changed || prior.pending || publish)) {
      const existing = await remote();
      if (!publish && (prior.revision !== expectedRevision || (existing?.revision || "") !== expectedRevision))
        throw new Error(t("同期データが更新されています。編集中の内容をエクスポートし、同期済みのプリセットを取り込んでから保存してください。"));
      const snapshot = pack(config);
      await remember(prior, config);
      // workerが途中で停止しても、次回の取り込みで未送信内容を失わない。
      await chrome.storage.local.set({ config2: config, device2: device, syncEnabled: true, syncPending: true });
      try {
        await chrome.storage.sync.set(snapshot);
      } catch {
        throw new Error(t("このPCには保存しましたが、Chrome同期領域への書き込みに失敗しました。補助操作から再送してください。"));
      }
      await chrome.storage.local.set({ syncRevision: snapshot.cgciHead.revision, syncPending: false });
      return { config, device, enabled: true, revision: snapshot.cgciHead.revision, pending: false, uploaded: true };
    }
    // PC固有の設定だけを保存しても、別PCから取り込んだ新しいプリセットを戻さない。
    if (enabled && prior.revision !== expectedRevision) {
      await chrome.storage.local.set({ device2: device });
      return pull();
    }
    await remember(prior, config);
    await chrome.storage.local.set({ config2: config, device2: device, syncEnabled: enabled,
      syncRevision: prior.revision, syncPending: prior.pending && !changed });
    return { config, device, enabled, revision: prior.revision, pending: prior.pending && !changed };
  }
  async function restore() {
    const state = await local();
    const backup = (await chrome.storage.local.get("syncBackup")).syncBackup;
    if (!backup) throw new Error(t("復元できるプリセットはありません。"));
    const config = validate(backup.config);
    await remember(state, config);
    // 復元はローカルだけ。別PCを戻さないよう同期をOFFにする。
    await chrome.storage.local.set({ config2: config, syncRevision: backup.revision || "", syncEnabled: false, syncPending: false });
    return local();
  }
  const operations = { load, pull, save, setEnabled, restore };
  let queue = Promise.resolve();
  function execute(method, args) {
    if (!Object.hasOwn(operations, method) || !Array.isArray(args)) return Promise.reject(new Error("Invalid settings operation"));
    const next = queue.then(() => operations[method](...args));
    queue = next.catch(() => {});
    return next;
  }
  const api = { ratios, defaults, validate, pack, unpack, local, remote, execute };
  for (const method of Object.keys(operations)) api[method] = (...args) => {
    if (chrome.runtime?.sendMessage && !globalThis.CGCISyncWorker)
      return chrome.runtime.sendMessage({ type: "CGCI_SETTINGS", method, args }).then(result => {
        if (!result?.ok) throw new Error(result?.error || t("設定を読み込めません。拡張機能のエラーを確認してください。"));
        return result.state;
      });
    return execute(method, args);
  };
  globalThis.CGCISettings = api;
})();
