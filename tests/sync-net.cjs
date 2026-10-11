"use strict";
// 複数PCの同期を再現する検証用ネットワーク。PCごとに独立したlocal領域と同期領域の複製を持ち、
// 送信・受信を任意に遅延・分割・並べ替え・オフライン化できる。実際のGoogle配送の代用ではない。
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto").webcrypto;
const root = path.join(__dirname, "..");
const clone = value => value === undefined ? undefined : structuredClone(value);
const bytes = (key, value) => Buffer.byteLength(key + JSON.stringify(value));

class Net {
  constructor() { this.server = {}; this.pcs = []; }
  // 新しいPCには既存の共有データが「未到着」として受信箱に入る。
  pc(name, local = {}) {
    const pc = new PC(this, name, local); this.pcs.push(pc);
    pc.inbox.push(...Object.entries(this.server).map(([key, value]) => ({ key, value: clone(value) })));
    return pc;
  }
  // 未送信の書込をサーバーへ送り、ほかのPCの受信箱に入れる（まだ適用しない）。
  upload(pc) {
    if (!pc.online) return;
    for (const op of pc.outbox.splice(0)) {
      if (op.value === undefined) delete this.server[op.key]; else this.server[op.key] = clone(op.value);
      for (const other of this.pcs) if (other !== pc) other.inbox.push(clone(op));
    }
  }
  uploadAll() { for (const pc of this.pcs) this.upload(pc); }
  async deliverAll() { this.uploadAll(); for (const pc of this.pcs) await pc.receive(); }
}

class PC {
  constructor(net, name, local) {
    Object.assign(this, { net, name, local: clone(local), replica: {}, outbox: [], inbox: [], online: true, failWrites: false, writes: 0, listeners: [] });
    this.boot();
  }
  // service worker / Chromeの再起動。永続領域だけを引き継ぎ、メモリ上の状態は捨てる。
  boot() {
    const pc = this;
    const changed = (area, delta) => { if (Object.keys(delta).length) for (const fn of pc.listeners) fn(delta, area); };
    const make = (data, area) => ({
      async get(keys) {
        if (keys === null || keys === undefined) return clone(data);
        const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
        return Object.fromEntries(list.filter(k => k in data).map(k => [k, clone(data[k])]));
      },
      async set(values) {
        if (area === "sync") {
          if (pc.hang === "before") return new Promise(() => {});
          if (pc.failWrites) throw new Error("QUOTA_BYTES or write failure");
          const total = Object.entries({ ...data, ...values }).reduce((n, [k, v]) => n + bytes(k, v), 0);
          if (total > 102400 || Object.entries(values).some(([k, v]) => bytes(k, v) > 8192)) throw new Error("QUOTA_BYTES quota exceeded");
          pc.writes++;
        }
        const delta = {};
        for (const [key, value] of Object.entries(values)) {
          delta[key] = { oldValue: clone(data[key]), newValue: clone(value) }; data[key] = clone(value);
          if (area === "sync") pc.outbox.push({ key, value: clone(value) });
        }
        changed(area, delta);
        if (area === "sync" && pc.hang === "after") return new Promise(() => {});
      },
      async remove(keys) {
        if (area === "sync" && pc.failWrites) throw new Error("write failure");
        const delta = {};
        for (const key of typeof keys === "string" ? [keys] : keys) if (key in data) {
          delta[key] = { oldValue: clone(data[key]) }; delete data[key];
          if (area === "sync") pc.outbox.push({ key, value: undefined });
        }
        changed(area, delta);
      },
      async getBytesInUse() { return Object.entries(data).reduce((n, [k, v]) => n + bytes(k, v), 0); }
    });
    this.listeners = [];
    const ctx = vm.createContext({ crypto, TextEncoder, structuredClone, console, CGCISyncWorker: true,
      chrome: { runtime: { getManifest: () => ({ version: "3.0.0" }) },
        storage: { local: make(this.local, "local"), sync: make(this.replica, "sync"), onChanged: { addListener: fn => pc.listeners.push(fn) } } } });
    vm.runInContext(fs.readFileSync(path.join(root, "settings.js"), "utf8"), ctx);
    this.ctx = ctx; this.S = ctx.CGCISettings;
  }
  // 受信箱を適用する。filterで一部だけ、reverseで逆順に届ける。
  async receive({ filter = () => true, reverse = false } = {}) {
    if (!this.online) return;
    const ready = this.inbox.filter(filter), rest = this.inbox.filter(op => !filter(op));
    this.inbox = rest;
    for (const op of reverse ? ready.reverse() : ready) {
      if (op.value === undefined) delete this.replica[op.key]; else this.replica[op.key] = clone(op.value);
    }
  }
  presets() { return this.local.config2.presets; }
  bodies() { return this.local.config2.presets.map(p => p.chatgpt); }
  async edit(fn) {
    const state = await this.S.status();
    const config = clone(state.config); fn(config);
    return this.S.save(config, state.device, state.token);
  }
}

const device = { source: "clipboard", chatgptAuto: false, geminiAuto: false, manualPaste: false };
function config(...bodies) {
  return { schema: 2, defaultId: "p0", presets: bodies.map((body, i) => ({ id: `p${i}`, name: `プリセット${i}`, shared: true, chatgpt: body, gemini: "", ratio: "" })) };
}
// 2.1.0以前の共通キー形式（テストで旧版PCを再現する）。
function legacyItems(cfg, revision = crypto.randomUUID()) {
  const data = JSON.stringify(cfg), items = { cgciHead: { schema: 2, revision, count: Math.ceil(data.length / 1000) } };
  for (let i = 0; i < 100; i++) items[`cgciPart${i}`] = { revision, text: data.slice(i * 1000, (i + 1) * 1000) };
  return items;
}
module.exports = { Net, PC, device, config, legacyItems, clone };
