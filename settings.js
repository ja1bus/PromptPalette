"use strict";
// 共有設定はschema 2のスナップショット。同期（v3）はPCごとの領域へ書き、受信側で由来・完全性・安全性を確認する。
// 画像・自動送信などPC固有の設定は同期しない。設計はSPECIFICATION.mdの「同期」を参照。
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

  // storage.syncの公式上限：総計102,400バイト、1項目8,192バイト、512項目、書込120回/分・1,800回/時。
  // 2台分の更新が同時に置けるよう1台の領域を48,000バイトまでとし、全体にも余裕を残す。
  const V = 3, HEAD = "pp3h.", PART = "pp3c.";
  const LIMIT = { part: 6000, parts: 40, slot: 48000, total: 100000, anc: 32, known: 128, held: 3, log: 40, backups: 20, kept: 6, backupBytes: 3000000 };
  const encoder = new TextEncoder();
  const size = (key, value) => encoder.encode(key + JSON.stringify(value)).length;
  const now = () => new Date().toISOString();
  const uniq = list => [...new Set(list.filter(Boolean))];
  const fail = (message, code) => Object.assign(new Error(message), { code });
  const version = () => { try { return chrome.runtime?.getManifest?.().version || ""; } catch { return ""; } };
  function randomId(length) {
    // 利用者・PCの情報を含まないランダムな識別子。
    return [...crypto.getRandomValues(new Uint8Array(length))].map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  }
  async function hashOf(config) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(validate(config))));
    return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function summary(config) {
    return { count: config.presets.length, filled: config.presets.filter(p => p.chatgpt.trim() || p.gemini.trim()).length };
  }
  const pristine = config => { const s = summary(config); return s.count === 1 && !s.filled; };
  // 自動反映してよいかの判定。該当すれば受信側で保留し、利用者の確認後に反映する。
  function assess(from, to) {
    const a = summary(from), b = summary(to), ids = new Set(to.presets.map(p => p.id));
    const removed = from.presets.filter(p => !ids.has(p.id)).length, lost = a.filled - b.filled, reasons = [];
    if (a.filled && !b.filled) reasons.push("empty");
    if (removed >= 3 || (a.count >= 3 && removed * 2 >= a.count)) reasons.push("removed");
    if (lost >= 3 || (a.filled >= 3 && lost * 2 >= a.filled)) reasons.push("cleared");
    return { reasons, removed, from: a, to: b };
  }
  function merge(base, extra, suffix) {
    const presets = base.presets.map(p => ({ ...p })), ids = new Set(presets.map(p => p.id));
    const content = p => JSON.stringify([p.name, p.shared, p.chatgpt, p.gemini, p.ratio]);
    for (const p of extra.presets) {
      if (presets.some(q => content(q) === content(p))) continue;
      const clash = ids.has(p.id);
      const copy = { ...p, id: clash ? randomId(12) : p.id, name: clash ? t`${p.name.slice(0, 70)}（${suffix}）` : p.name };
      presets.push(copy); ids.add(copy.id);
    }
    if (presets.length > 20) throw fail(t("両方を残すと20件を超えます。不要なプリセットを削除してから操作するか、どちらか一方を選んでください。"), "PP-SYNC-MERGE-LIMIT");
    return validate({ schema: 2, defaultId: base.defaultId, presets });
  }

  // 2.1.0以前の共通キー形式。読み取り専用で、このPCからは書き込まない。
  function unpackLegacy(items) {
    const head = items.cgciHead;
    if (!head) return null;
    if (head.schema !== 2) throw Object.assign(new Error("unsupported"), { unsupported: true });
    if (typeof head.revision !== "string" || !Number.isInteger(head.count) || head.count < 1 || head.count > 200) throw new Error("invalid");
    let data = "";
    for (let i = 0; i < head.count; i++) {
      const part = items[`cgciPart${i}`];
      if (part?.revision !== head.revision || typeof part.text !== "string") throw new Error("incomplete");
      data += part.text;
    }
    return { config: validate(JSON.parse(data)), revision: head.revision };
  }
  function split(text) {
    const chars = Array.from(text), parts = [];
    for (let i = 0; i < chars.length;) {
      let n = Math.min(2000, chars.length - i);
      while (n > 1 && encoder.encode(JSON.stringify(chars.slice(i, i + n).join(""))).length > LIMIT.part) n = Math.floor(n * 0.75);
      parts.push(chars.slice(i, i + n).join("")); i += n;
    }
    return parts;
  }
  function encode(dev, config, meta) {
    const parts = split(JSON.stringify(validate(config)));
    if (parts.length > LIMIT.parts) throw fail(t("同期できる容量を超えます。プリセットや本文を減らしてください。このPCには保存済みです。"), "PP-SYNC-QUOTA");
    const head = { v: V, dev, rev: meta.rev, anc: meta.anc, hash: meta.hash, n: parts.length, kind: meta.kind, at: now(), app: version() };
    const items = { [HEAD + dev]: head };
    parts.forEach((s, i) => { items[`${PART}${dev}.${i}`] = { r: meta.rev, s }; });
    return { items, head, bytes: Object.entries(items).reduce((n, [k, v]) => n + size(k, v), 0) };
  }
  const validHead = (head, owner) => head.dev === owner && /^[a-z0-9]{4,16}$/.test(owner) && typeof head.rev === "string" && /^[a-z0-9]{8,24}$/.test(head.rev) &&
    Array.isArray(head.anc) && head.anc.length <= 64 && head.anc.every(a => typeof a === "string" && a.length <= 48) &&
    typeof head.hash === "string" && /^[0-9a-f]{16}$/.test(head.hash) && Number.isInteger(head.n) && head.n >= 1 && head.n <= LIMIT.parts;
  // 同期領域を読み、完全で内容ハッシュが一致する更新だけを候補にする。
  async function scan(items, dev) {
    const found = { slots: [], own: null, legacy: null, incomplete: 0, corrupt: 0, unsupported: 0 };
    for (const [key, head] of Object.entries(items)) {
      if (!key.startsWith(HEAD)) continue;
      const owner = key.slice(HEAD.length);
      if (head && Number.isInteger(head.v) && head.v > V) { found.unsupported++; continue; }
      if (!head || head.v !== V || !validHead(head, owner)) { found.corrupt++; continue; }
      let text = "";
      for (let i = 0; i < head.n && text !== null; i++) {
        const part = items[`${PART}${owner}.${i}`];
        text = part?.r === head.rev && typeof part.s === "string" ? text + part.s : null;
      }
      if (text === null) { found.incomplete++; continue; }
      let config;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.schema !== 2) { found.unsupported++; continue; }
        config = validate(parsed);
      } catch { found.corrupt++; continue; }
      if (await hashOf(config) !== head.hash) { found.corrupt++; continue; }
      const slot = { source: "v3", dev: owner, rev: head.rev, anc: head.anc, hash: head.hash, kind: String(head.kind || "").slice(0, 12), at: String(head.at || "").slice(0, 40), config };
      if (owner === dev) found.own = slot; else found.slots.push(slot);
    }
    if (items.cgciHead) {
      try {
        const legacy = unpackLegacy(items);
        found.legacy = { source: "legacy", dev: "", rev: `L:${legacy.revision}`, anc: [], hash: await hashOf(legacy.config), kind: "legacy", at: "", config: legacy.config };
      } catch (error) { if (error.unsupported) found.unsupported++; else found.incomplete++; }
    }
    return found;
  }

  function fresh() {
    return { v: 1, dev: randomId(8), joined: false, base: "", baseHash: "", baseConfig: null, anc: [], known: [], supersede: [], held: [],
      published: null, outbox: null, legacySeen: "", migrated: "", lastReceived: "", lastSent: "", lastChecked: "", lastError: "", lastScan: null, log: [] };
  }
  function log(s, event, rev = "") {
    s.log = [{ t: now(), e: event, r: rev.slice(0, 8) }, ...s.log].slice(0, LIMIT.log);
  }
  const persist = s => chrome.storage.local.set({ sync3: s });
  async function addBackup(config, reason, kept = false, time = now()) {
    if (pristine(config)) return;
    const hash = await hashOf(config);
    let list = (await chrome.storage.local.get("backups3")).backups3 || [];
    const same = list.find(b => b.hash === hash);
    // 同じ内容は1件にまとめ、正常な履歴が重複で押し出されないようにする。
    if (same) { list = [{ ...same, time, kept: same.kept || kept, reason: kept && !same.kept ? reason : same.reason }, ...list.filter(b => b !== same)]; }
    else list = [{ id: randomId(10), time, reason, kept, hash, ...summary(config), config }, ...list];
    const keptList = list.filter(b => b.kept).slice(0, LIMIT.kept), normal = list.filter(b => !b.kept).slice(0, LIMIT.backups - keptList.length);
    list = list.filter(b => keptList.includes(b) || normal.includes(b));
    while (list.length > 1 && size("backups3", list) > LIMIT.backupBytes) {
      const victim = [...list].reverse().find(b => !b.kept) || list.at(-1);
      list = list.filter(b => b !== victim);
    }
    await chrome.storage.local.set({ backups3: list });
  }
  async function migrate(old, config, upgraded) {
    const s = fresh(), hash = await hashOf(config), rev = typeof old.syncRevision === "string" ? old.syncRevision : "";
    if (upgraded) s.migrated = "2";
    // 2.1.0以前に同期中だったPCは、取り込んだ旧形式の更新を起点として参加済みにする。送信はしない。
    if (old.syncEnabled === true && rev) {
      s.joined = true; s.base = `L:${rev}`; s.anc = [s.base]; s.known = [s.base]; s.legacySeen = rev;
      if (old.syncPending !== true) { s.baseHash = hash; s.baseConfig = config; }
    }
    log(s, "migrate", s.base);
    await persist(s);
    if (old.syncBackup?.config) { try { await addBackup(validate(old.syncBackup.config), "legacy", true, old.syncBackup.time || now()); } catch { /* 壊れた旧バックアップは移さない */ } }
    if (s.migrated) await addBackup(config, "migration", true);
    return s;
  }
  async function local() {
    let old = await chrome.storage.local.get(null);
    const upgraded = !!old.config2;
    if (!old.config2) {
      const config = defaults();
      config.presets[0].chatgpt = typeof old.prompt === "string" ? old.prompt : "";
      // 移行時は自動送信をOFFに戻し、旧設定そのものは残す。
      await chrome.storage.local.set({ config2: config, device2: { source: "clipboard", chatgptAuto: false,
        geminiAuto: false, manualPaste: !!old.manualPaste }, syncEnabled: false });
      old = await chrome.storage.local.get(null);
    }
    const config = validate(old.config2);
    let s = old.sync3;
    if (!s) s = await migrate(old, config, upgraded);
    else if (s.v !== 1) throw fail(t("このPCの同期状態は新しい版のPromptPaletteで作成されています。PromptPaletteを更新してください。"), "PP-SYNC-STATE-NEWER");
    const state = { config, device: { source: "clipboard", chatgptAuto: false, geminiAuto: false, manualPaste: false, ...old.device2 },
      enabled: old.syncEnabled === true, s, hash: await hashOf(config) };
    if (s.outbox) await recover(state);
    return state;
  }
  function finalize(s, outbox, config) {
    s.base = outbox.rev; s.baseHash = outbox.hash; s.baseConfig = config; s.anc = uniq([outbox.rev, ...outbox.anc]).slice(0, LIMIT.anc);
    s.known = uniq([outbox.rev, ...s.supersede, ...s.known]).slice(0, LIMIT.known); s.supersede = []; s.joined = true;
    s.published = { rev: outbox.rev, n: outbox.n }; s.outbox = null; s.lastSent = now(); s.lastError = "";
  }
  // 書込中にworkerが止まった場合、同期領域に完全に書けていれば送信済み、そうでなければ未送信のままにする。
  async function recover(state) {
    const s = state.s, outbox = s.outbox;
    const found = await scan(await chrome.storage.sync.get(null), s.dev);
    if (found.own?.rev === outbox.rev && outbox.hash === state.hash) { finalize(s, outbox, state.config); log(s, "outbox-recovered", outbox.rev); }
    else { s.outbox = null; log(s, "outbox-dropped", outbox.rev); }
    await persist(s);
  }
  const unsent = state => state.s.joined && (state.hash !== state.s.baseHash || state.s.supersede.length > 0);
  function view(state, extra = {}) {
    const s = state.s, mine = summary(state.config);
    const mode = !state.enabled ? "off" : !s.joined ? (s.held.some(h => h.kind === "join") ? "review" : "waiting") : "active";
    return { config: state.config, device: state.device, enabled: state.enabled, mode, joined: s.joined, unsent: unsent(state), token: state.hash,
      local: mine, scan: s.lastScan, lastReceived: s.lastReceived, lastSent: s.lastSent, lastChecked: s.lastChecked, lastError: s.lastError,
      held: s.held.map(h => ({ id: h.rev, kind: h.kind, source: h.source, at: h.at, received: h.received, reasons: h.reasons || [],
        ...summary(h.config), removed: assess(state.config, h.config).removed })),
      warning: state.enabled && s.held.length ? t("同期の確認待ちの更新があります。設定画面の「ほかのPCとの共有」を確認してください。") : undefined, ...extra };
  }

  async function dropOwnSlot(s, anc) {
    if (!s.published || !anc.includes(s.published.rev)) return;
    // 自分の領域だけを削除する。ほかのPCには「何もない」と見えるだけで、消去命令にはならない。
    const keys = [HEAD + s.dev, ...Array.from({ length: s.published.n }, (_, i) => `${PART}${s.dev}.${i}`)];
    try { await chrome.storage.sync.remove(keys); s.published = null; } catch { /* 次回に再試行 */ }
  }
  async function adopt(state, c, reason, keep = false) {
    const s = state.s;
    if (state.hash !== c.hash) await addBackup(state.config, reason, keep);
    await chrome.storage.local.set({ config2: c.config });
    state.config = c.config; state.hash = c.hash;
    s.base = c.rev; s.baseHash = c.hash; s.baseConfig = c.config; s.anc = uniq([c.rev, ...c.anc, ...s.anc]).slice(0, LIMIT.anc);
    s.known = uniq([c.rev, ...s.known]).slice(0, LIMIT.known); s.joined = true; s.lastReceived = now();
    if (c.source === "legacy") s.legacySeen = c.rev.slice(2);
    s.held = s.held.filter(h => h.rev !== c.rev);
    await dropOwnSlot(s, c.anc);
  }
  async function hold(s, c, kind, reasons = []) {
    const existing = s.held.find(h => h.rev === c.rev);
    if (existing) { Object.assign(existing, { kind, reasons }); return; }
    s.held.push({ ...c, kind, reasons, received: now() });
    log(s, `hold-${kind}`, c.rev);
    while (s.held.length > LIMIT.held) await addBackup(s.held.shift().config, "held-dropped", true);
  }
  // 受信処理。届いた更新の由来を確かめ、安全なものだけ自動で反映する。
  async function check(state) {
    const s = state.s;
    if (!state.enabled) return { result: "off" };
    const found = await scan(await chrome.storage.sync.get(null), s.dev);
    s.lastChecked = now();
    s.lastScan = { slots: found.slots.length + (found.own ? 1 : 0), incomplete: found.incomplete, corrupt: found.corrupt, unsupported: found.unsupported, legacy: !!found.legacy };
    const known = new Set([s.base, ...s.anc, ...s.known, ...s.supersede]);
    const pool = [...found.slots];
    if (found.legacy && found.legacy.rev !== `L:${s.legacySeen}`) pool.push(found.legacy);
    let candidates = pool.filter(c => !known.has(c.rev));
    // 別の候補の祖先になっている古い更新は、後着しても採用しない。
    candidates = candidates.filter(c => !candidates.some(o => o !== c && o.anc.includes(c.rev)));
    if (!s.joined && candidates.some(c => c.source === "v3")) candidates = candidates.filter(c => c.source === "v3");
    const ancestors = new Set(candidates.flatMap(c => c.anc));
    s.held = s.held.filter(h => !known.has(h.rev) && !ancestors.has(h.rev));
    let result = "none";
    for (const c of candidates.filter(c => c.hash === state.hash)) {
      // 内容が同じ更新は、データを変えずに由来だけ記録する。
      s.base = c.rev; s.baseHash = c.hash; s.baseConfig = state.config; s.anc = uniq([c.rev, ...c.anc, ...s.anc]).slice(0, LIMIT.anc);
      s.known = uniq([c.rev, ...s.known]).slice(0, LIMIT.known); s.joined = true; s.held = s.held.filter(h => h.rev !== c.rev);
      if (c.source === "legacy") s.legacySeen = c.rev.slice(2);
      await dropOwnSlot(s, c.anc); log(s, "same", c.rev); result = "same";
    }
    const rest = candidates.filter(c => c.hash !== state.hash);
    if (!s.joined) {
      if (rest.length === 1 && pristine(state.config)) { await adopt(state, rest[0], "before-join", true); log(s, "join", rest[0].rev); result = "joined"; }
      else for (const c of rest) { await hold(s, c, "join"); result = "held"; }
    } else {
      const v3 = rest.filter(c => c.source === "v3");
      for (const c of rest.filter(c => c.source === "legacy")) { await hold(s, c, "legacy"); result = "held"; }
      if (v3.length === 1 && s.base && v3[0].anc.includes(s.base) && !unsent(state)) {
        const a = assess(state.config, v3[0].config);
        if (a.reasons.length) { await hold(s, v3[0], "destructive", a.reasons); result = "held"; }
        else { await adopt(state, v3[0], "before-receive"); log(s, "receive", v3[0].rev); result = "applied"; }
      } else for (const c of v3) { await hold(s, c, "conflict"); result = "held"; }
    }
    if (result === "none" && (found.incomplete || s.held.length)) result = found.incomplete ? "incomplete" : "pending-held";
    await persist(s);
    return { result };
  }
  async function publish(state, kind) {
    const s = state.s;
    if (!state.enabled) throw fail(t("共有がOFFです。スイッチをONにしてから操作してください。"), "PP-SYNC-OFF");
    if (s.lastScan?.unsupported) throw fail(t("新しい版のPromptPaletteで作られた同期データがあります。このPCのPromptPaletteを更新してから送信してください。このPCには保存済みです。"), "PP-SYNC-UNSUPPORTED");
    const rev = randomId(12), anc = uniq([s.base, ...s.supersede, ...s.anc]).slice(0, LIMIT.anc);
    const { items, head, bytes } = encode(s.dev, state.config, { rev, anc, hash: state.hash, kind });
    const current = await chrome.storage.sync.get(null);
    const others = Object.entries(current).filter(([k]) => k !== HEAD + s.dev && !k.startsWith(`${PART}${s.dev}.`)).reduce((n, [k, v]) => n + size(k, v), 0);
    if (bytes > LIMIT.slot || others + bytes > LIMIT.total)
      throw fail(t("同期できる容量を超えます。プリセットや本文を減らすか、詳細の「古い同期データを整理」を試してください。このPCには保存済みです。"), "PP-SYNC-QUOTA");
    s.outbox = { rev, hash: state.hash, anc, n: head.n, kind };
    await persist(s);
    try { await chrome.storage.sync.set(items); }
    catch {
      s.outbox = null; s.lastError = "PP-SYNC-WRITE"; log(s, "send-failed", rev); await persist(s);
      throw fail(t("このPCには保存しましたが、Chromeの同期領域へ書き込めませんでした。時間をおいて「未送信の変更を送信」を押してください。"), "PP-SYNC-WRITE");
    }
    const stale = [];
    for (let i = head.n; i < (s.published?.n || 0); i++) stale.push(`${PART}${s.dev}.${i}`);
    if (stale.length) { try { await chrome.storage.sync.remove(stale); } catch { /* 余剰チャンクは受信側で無視される */ } }
    finalize(s, s.outbox, state.config); log(s, `send-${kind}`, rev);
    await persist(s);
  }
  // 送信失敗は例外にせず結果で返し、画面がこのPCの保存状態を表示できるようにする。
  async function send(state, kind) {
    try { await publish(state, kind); return { result: "sent" }; }
    catch (error) { state.s.lastError = error.code || "PP-SYNC-WRITE"; await persist(state.s); return { result: "failed", error: error.message, code: error.code }; }
  }

  async function load() {
    const state = await local();
    let extra = {};
    try { extra = await check(state); } catch { extra = { result: "error" }; }
    return view(state, extra);
  }
  async function status() { return view(await local()); }
  async function setEnabled(enabled) {
    if (typeof enabled !== "boolean") throw new Error(t("PC設定が不正です。"));
    const state = await local();
    await chrome.storage.local.set({ syncEnabled: enabled });
    state.enabled = enabled; log(state.s, enabled ? "enable" : "disable");
    // ONでも送信しない。届いている内容の確認だけ行う。OFFは同期領域を削除しない。
    const extra = enabled ? await check(state) : {};
    await persist(state.s);
    return view(state, extra);
  }
  function validDevice(device) {
    if (!device || !["clipboard", "file"].includes(device.source) || ["chatgptAuto", "geminiAuto", "manualPaste"].some(k => typeof device[k] !== "boolean"))
      throw new Error(t("PC設定が不正です。"));
    return { source: device.source, chatgptAuto: device.chatgptAuto, geminiAuto: device.geminiAuto, manualPaste: device.manualPaste };
  }
  async function save(config, device, token, force = false) {
    config = validate(config); device = validDevice(device);
    const state = await local(), s = state.s;
    if (typeof token === "string" && token !== state.hash && force !== true)
      throw fail(t("編集中に、このPCのプリセットが更新されました（ほかのPCからの受信など）。"), "PP-SYNC-CHANGED");
    const hash = await hashOf(config), changed = hash !== state.hash;
    if (changed) await addBackup(state.config, force === true ? "before-overwrite" : "before-save", force === true);
    await chrome.storage.local.set({ config2: config, device2: device });
    state.config = config; state.device = device; state.hash = hash;
    let extra = { result: "local" };
    if (state.enabled && s.joined && changed) {
      try { await check(state); } catch { /* 送信時に再確認する */ }
      extra = s.held.length ? { result: "held" } : await send(state, "edit");
    } else if (state.enabled && !s.joined) extra = { result: "waiting" };
    await persist(s);
    return view(state, extra);
  }
  async function checkNow() {
    const state = await local();
    if (!state.enabled) return view(state, { result: "off" });
    return view(state, await check(state));
  }
  async function resend() {
    const state = await local(), s = state.s;
    if (!state.enabled || !s.joined) throw fail(t("共有に参加していないため送信できません。"), "PP-SYNC-NOT-JOINED");
    if (!unsent(state)) return view(state, { result: "nothing" });
    await check(state);
    // 再送も通常の保存と同じ確認を通す。届いた更新があれば競合として保留する。
    return view(state, s.held.length ? { result: "held" } : await send(state, "resend"));
  }
  async function start() {
    const state = await local(), s = state.s;
    if (!state.enabled) throw fail(t("共有がOFFです。スイッチをONにしてから操作してください。"), "PP-SYNC-OFF");
    if (s.joined) throw fail(t("このPCはすでに共有に参加しています。"), "PP-SYNC-JOINED");
    await check(state);
    if (s.joined || s.held.length || s.lastScan.slots || s.lastScan.legacy || s.lastScan.incomplete)
      throw fail(t("ほかのPCの共有データが届いています。共有を始める前に、届いた内容を確認してください。"), "PP-SYNC-EXISTS");
    if (!summary(state.config).filled)
      throw fail(t("本文のあるプリセットがないため、共有を始められません。プリセットを入力して「すべて保存」してから操作してください。"), "PP-SYNC-EMPTY");
    await addBackup(state.config, "before-start", true);
    const extra = await send(state, "start");
    if (extra.result === "sent") log(s, "start", s.base);
    await persist(s);
    return view(state, extra);
  }
  async function resolve(id, action) {
    const state = await local(), s = state.s, h = s.held.find(x => x.rev === id);
    if (!h) throw fail(t("この更新はすでに処理されています。画面を更新しました。"), "PP-SYNC-GONE");
    if (!state.enabled) throw fail(t("共有がOFFです。スイッチをONにしてから操作してください。"), "PP-SYNC-OFF");
    log(s, `resolve-${action}`, h.rev);
    let extra = { result: "resolved" };
    const others = () => s.held.filter(x => x.rev !== h.rev);
    if (action === "accept" && h.source === "legacy" && s.joined) {
      // 旧版PCの変更は新方式の共有にも反映するため、このPCから送信する。
      await addBackup(state.config, "before-receive", true);
      await chrome.storage.local.set({ config2: h.config });
      state.config = h.config; state.hash = h.hash; s.legacySeen = h.rev.slice(2); s.held = others();
      s.supersede = uniq([h.rev, ...s.supersede]);
      extra = await send(state, "legacy");
    } else if (action === "accept") {
      const divergent = s.published && !h.anc.includes(s.published.rev) ? s.published.rev : "";
      await adopt(state, h, "before-accept", true);
      if (divergent) { s.supersede = uniq([divergent, ...s.supersede]); extra = await send(state, "resolve"); }
    } else if (action === "ignore" && h.source === "legacy") {
      s.legacySeen = h.rev.slice(2); s.held = others(); await addBackup(h.config, "held-dropped", true);
    } else if (action === "keep" && h.kind !== "join") {
      await addBackup(h.config, "held-dropped", true);
      s.held = others(); s.supersede = uniq([h.rev, ...h.anc.slice(0, 8), ...s.supersede]);
      extra = await send(state, "resolve");
    } else if (action === "merge") {
      const joining = h.kind === "join";
      const merged = joining ? merge(h.config, state.config, t("このPC")) : merge(state.config, h.config, t("別のPC"));
      await addBackup(state.config, "before-merge", true);
      if (joining) { await adopt(state, h, "before-join", true); }
      else { s.held = others(); s.supersede = uniq([h.rev, ...h.anc.slice(0, 8), ...s.supersede]); }
      await chrome.storage.local.set({ config2: merged });
      state.config = merged; state.hash = await hashOf(merged);
      if (h.source === "legacy") s.legacySeen = h.rev.slice(2);
      extra = await send(state, "merge");
    } else throw new Error("Invalid resolve action");
    await persist(s);
    return view(state, extra);
  }
  async function replacePreview() {
    const state = await local(), s = state.s;
    if (state.enabled) await check(state);
    const shared = s.held.find(h => h.kind === "join")?.config || s.baseConfig || null;
    return { local: summary(state.config), shared: shared && summary(shared), removed: shared ? assess(shared, state.config).removed : 0, held: s.held.length, enabled: state.enabled };
  }
  async function replace() {
    const state = await local(), s = state.s;
    if (!state.enabled) throw fail(t("共有がOFFです。スイッチをONにしてから操作してください。"), "PP-SYNC-OFF");
    if (!summary(state.config).filled)
      throw fail(t("本文のあるプリセットがないため、共有内容を置き換えられません。"), "PP-SYNC-EMPTY");
    await check(state);
    if (!s.joined && !s.held.length) throw fail(t("置き換える共有内容がまだ届いていません。最初の1台の場合は「このPCのプリセットで共有を始める」を使ってください。"), "PP-SYNC-NOTHING");
    await addBackup(state.config, "before-replace", true);
    for (const h of s.held) { await addBackup(h.config, "held-dropped", true); s.supersede = uniq([...s.supersede, h.rev, ...h.anc.slice(0, 8)]); }
    s.held = []; log(s, "replace");
    const extra = await send(state, "replace");
    await persist(s);
    return view(state, extra);
  }
  async function backups() {
    const list = (await chrome.storage.local.get("backups3")).backups3 || [];
    return list.map(({ id, time, reason, kept, count, filled }) => ({ id, time, reason, kept, count, filled }));
  }
  async function restore(id) {
    const state = await local();
    const backup = ((await chrome.storage.local.get("backups3")).backups3 || []).find(b => b.id === id);
    if (!backup) throw fail(t("選んだバックアップが見つかりません。"), "PP-BACKUP-GONE");
    const config = validate(backup.config);
    await addBackup(state.config, "before-restore", true);
    // 復元はこのPCだけ。共有中なら未送信の変更として残し、自動では配信しない。
    await chrome.storage.local.set({ config2: config });
    state.config = config; state.hash = await hashOf(config); log(state.s, "restore");
    await persist(state.s);
    return view(state, { result: "restored" });
  }
  async function cleanup() {
    const state = await local(), s = state.s;
    if (!state.enabled || !s.joined) throw fail(t("共有に参加していないため整理できません。"), "PP-SYNC-NOT-JOINED");
    const items = await chrome.storage.sync.get(null), found = await scan(items, s.dev);
    const head = [...found.slots, found.own].find(c => c?.rev === s.base);
    if (!head) throw fail(t("現在の共有内容がこのPCの同期領域で確認できないため、整理しません。"), "PP-SYNC-NO-HEAD");
    const ancestors = new Set(s.anc.slice(1)), keys = [];
    for (const c of found.slots) if (ancestors.has(c.rev) && c.rev !== s.base)
      keys.push(HEAD + c.dev, ...Object.keys(items).filter(k => k.startsWith(`${PART}${c.dev}.`)));
    if (found.legacy && ancestors.has(found.legacy.rev)) keys.push(...Object.keys(items).filter(k => k === "cgciHead" || /^cgciPart\d+$/.test(k)));
    if (keys.length) await chrome.storage.sync.remove(keys);
    log(s, "cleanup"); await persist(s);
    return view(state, { result: "cleaned", removed: keys.length });
  }
  async function diagnostics() {
    const state = await local(), s = state.s;
    // 本文・プリセット名を含めない。
    return { app: version(), sync: { enabled: state.enabled, mode: view(state).mode, joined: s.joined, unsent: unsent(state), held: s.held.map(h => h.kind),
      supersede: s.supersede.length, base: s.base.slice(0, 10), migrated: s.migrated, scan: s.lastScan, lastChecked: s.lastChecked, lastReceived: s.lastReceived,
      lastSent: s.lastSent, lastError: s.lastError, log: s.log, backups: (await backups()).length }, local: summary(state.config) };
  }

  const operations = { load, status, check: checkNow, save, setEnabled, start, resend, resolve, replacePreview, replace, backups, restore, cleanup, diagnostics };
  let queue = Promise.resolve();
  function execute(method, args) {
    if (!Object.hasOwn(operations, method) || !Array.isArray(args)) return Promise.reject(new Error("Invalid settings operation"));
    const next = queue.then(() => operations[method](...args));
    queue = next.catch(() => {});
    return next;
  }
  const api = { ratios, defaults, validate, summary, assess, merge, unpackLegacy, local, execute, methods: Object.keys(operations), LIMIT };
  for (const method of Object.keys(operations)) api[method] = (...args) => {
    if (chrome.runtime?.sendMessage && !globalThis.CGCISyncWorker)
      return chrome.runtime.sendMessage({ type: "CGCI_SETTINGS", method, args }).then(result => {
        if (!result?.ok) throw fail(result?.error || t("設定を読み込めません。設定画面を開き直してください。"), result?.code);
        return result.state;
      });
    return execute(method, args);
  };
  globalThis.CGCISettings = api;
})();
