"use strict";
(() => {
  const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
  if (globalThis.CGCIRunner) return;
  globalThis.CGCIRunner = true;
  const site = location.origin === "https://gemini.google.com" ? "gemini" : "chatgpt";
  const A = site === "gemini" ? globalThis.CGCIGeminiAdapter : globalThis.CGCIAdapter;
  let running = false, guarded = false, stage = t("開始前"), controller, panel;
  let attempted = false, sent = false, changedMode = false;
  let prepared = false;
  let dismissTimer;
  function closePanel() {
    clearTimeout(dismissTimer);
    panel?.host.remove();
    panel = null;
  }
  const cleanText = text => text.replace(/\r\n/g, "\n").trim();
  function show(text, { error = false, done = false } = {}) {
    clearTimeout(dismissTimer);
    if (!panel) {
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;max-width:390px";
      const shadow = host.attachShadow({ mode: "closed" });
      const box = document.createElement("section");
      box.style.cssText = "font:14px/1.6 system-ui;background:#fff;color:#222;border:2px solid #26745c;border-radius:12px;padding:16px;box-shadow:0 4px 24px #0004;max-height:85vh;overflow:auto";
      const p = document.createElement("p");
      p.style.whiteSpace = "pre-wrap";
      p.setAttribute("role", "status");
      p.setAttribute("aria-live", "polite");
      const buttons = document.createElement("div");
      box.append(p, buttons);
      shadow.append(box);
      document.documentElement.append(host);
      panel = { host, p, buttons };
    }
    panel.p.textContent = text;
    panel.buttons.replaceChildren();
    button(t("設定"), () => chrome.runtime.sendMessage({ type: "CGCI_OPTIONS" }).catch(() => {}));
    if (running) button(t("中止"), () => controller.abort(new Error(t("ユーザーが中止しました。"))));
    else button(t("閉じる"), closePanel);
    if (!running && guarded) button(t("残った下書きを確認済み・ロック解除"), () => {
      guarded = false;
      show(t("実行ロックを解除しました。再実行には、残った入力文と添付を自分で処理し、空の入力欄にしてください。"));
    });
    chrome.runtime.sendMessage({ type: "CGCI_STATUS", text, error, done, stage, site }).catch(() => {});
    // 完了通知を閉じても、下書き保護のロックは維持する。エラーは確認まで残す。
    if (done && !error) dismissTimer = setTimeout(closePanel, 4000);
  }
  function button(text, handler) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "margin:4px;padding:7px;border:1px solid #888;border-radius:6px;cursor:pointer;background:#f5f5f5;color:#222";
    b.addEventListener("click", handler);
    panel.buttons.append(b);
    return b;
  }
  function checkLocation(url) {
    if (location.href !== url) throw new Error(t("チャットの移動を検出しました。元のチャットの下書きを確認してください。"));
  }
  function checkInput() {
    if (!A.editor() || !A.root()) throw new Error(t("チャット入力欄が見つかりません。通常のChat画面を開いてください。UI変更時はadapter.jsを確認してください。"));
    if (A.generating() || A.disabled(A.editor())) throw new Error(t("回答生成中、または入力できない状態です。終了後に実行してください。"));
  }
  function empty() {
    checkInput();
    if (A.text().trim() || A.hasAttachment()) throw new Error(t("既存の入力文または添付があります。内容を自分で確認・処理してから実行してください。"));
    if (A.otherMode()) throw new Error(t("別のツールが選択されています。自分で解除してから実行してください。"));
  }
  function wait(test, timeout = 15000, timeoutDetails) {
    const signal = controller.signal;
    return new Promise((resolve, reject) => {
      let observer, timer, poll, scheduled, finished = false;
      const finish = (error, value) => {
        if (finished) return;
        finished = true;
        observer?.disconnect(); clearTimeout(timer); clearTimeout(scheduled); clearInterval(poll);
        signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve(value);
      };
      const abort = () => finish(signal.reason || new Error(t("中止しました。")));
      const probe = () => {
        try {
          if (signal.aborted) return abort();
          const value = test();
          if (value) finish(null, value);
        } catch (error) { finish(error); }
      };
      // 全画面の細かなmutationごとにレイアウトを調べ続けないようまとめて評価する。
      observer = new MutationObserver(() => {
        if (!scheduled && !finished) scheduled = setTimeout(() => { scheduled = null; probe(); }, 50);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
      // image.complete/value/focusは必ずしもDOM mutationを起こさないため補助的に再評価する。
      poll = setInterval(probe, 250);
      timer = setTimeout(() => {
        let details = "";
        try { if (timeoutDetails) details = t`\n確認結果：${timeoutDetails()}`; } catch { details = t("\n確認結果を取得できませんでした。"); }
        finish(new Error(t`時間内に状態を確認できませんでした。画面の状態と通信環境を確認してください。${details}`));
      }, timeout);
      signal.addEventListener("abort", abort, { once: true });
      probe();
    });
  }
  async function activatedRead() {
    show(t("2/6 クリップボードを読み取れませんでした。対象サイトを前面にして［画像を読み取って続行］を押してください。"));
    let operation;
    let clicked = false;
    const b = button(t("画像を読み取って続行"), () => {
      if (!document.hasFocus()) return;
      clicked = true; b.disabled = true;
      // 信頼されたクリックのハンドラー内で直ちにreadを呼ぶ。
      operation = navigator.clipboard.read().then(items => ({ items })).catch(error => ({ error }));
    });
    await wait(() => clicked, 60000);
    return bounded(operation, 12000);
  }
  function bounded(promise, timeout) {
    const signal = controller.signal;
    return new Promise((resolve, reject) => {
      const abort = () => finish(signal.reason || new Error(t("中止しました。")));
      const timer = setTimeout(() => finish(new Error(t("クリップボードの読み取りがタイムアウトしました。"))), timeout);
      let done = false;
      const finish = (error, result) => {
        if (done) return; done = true;
        clearTimeout(timer); signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve(result);
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      Promise.resolve(promise).then(value => finish(null, value), error => finish(error));
    });
  }
  async function readFile() {
    let result;
    try {
      if (!document.hasFocus()) throw new Error(t("フォーカスがありません。"));
      result = { items: await bounded(navigator.clipboard.read(), 12000) };
    } catch { result = await activatedRead(); }
    if (result.error) return null; // 読み取り拒否のみ、実際のCtrl+Vに切り替える。
    const images = result.items.filter(item => item.types.some(t => /^image\/(png|jpeg|webp)$/i.test(t)));
    if (!images.length) throw new Error(t("クリップボードに対応する画像がありません。Win+Shift+Sで画像をコピーしてください。"));
    if (images.length !== 1) throw new Error(t("画像が複数あります。画像1枚だけをコピーしてください。"));
    const item = images[0];
    const type = ["image/png", "image/jpeg", "image/webp"].find(t => item.types.includes(t));
    const blob = await bounded(item.getType(type), 12000);
    if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error(t("画像が空、または20MiBを超えています。小さな画像をコピーしてください。"));
    return new File([blob], `clipboard-${Date.now()}.${type.split("/")[1]}`, { type });
  }
  async function nativePaste(url, permissionDenied = true) {
    empty();
    show(t`3/6 ${permissionDenied ? t("読み取り権限が拒否されました。") : t("手動添付方式です。")}［貼り付け待機］を押し、入力欄で実際にCtrl+Vを1回押してください。画像だけを受け付けます。`);
    let armed = false, pasted = false;
    const listener = event => {
      if (!armed || !event.isTrusted || !A.editor()?.contains(event.target)) return;
      try { checkLocation(url); empty(); } catch (error) {
        event.preventDefault(); controller.abort(error); return;
      }
      const files = [...(event.clipboardData?.files || [])];
      if (files.length !== 1 || !/^image\/(png|jpeg|webp)$/.test(files[0].type) || files[0].size > 20 * 1024 * 1024) {
        event.preventDefault(); controller.abort(new Error(t("貼り付け内容が対応する画像1枚ではありません。画像をコピーし直してください。"))); return;
      }
      attempted = guarded = pasted = true;
      armed = false;
      // ネイティブpasteはChatGPTのハンドラーに渡す。合成キー入力は使わない。
    };
    document.addEventListener("paste", listener, true);
    button(t("貼り付け待機"), () => {
      try { checkLocation(url); empty(); armed = true; A.editor().focus(); }
      catch (error) { controller.abort(error); }
    });
    try { await wait(() => pasted, 60000); }
    finally { document.removeEventListener("paste", listener, true); }
  }
  function promptFor(preset) {
    return (site === "chatgpt" || preset.shared ? preset.chatgpt : preset.gemini).replace(/\r\n/g, "\n").trim();
  }
  async function chooseFile(summary) {
    show(t`画像ファイルを選んでください。${summary}\nPNG・JPEG・WebP、1枚、20MiB以内。キャンセルすると終了します。`);
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.hidden = true;
    let result, cancelled = false;
    input.addEventListener("change", () => { result = input.files?.[0]; if (!result) cancelled = true; });
    input.addEventListener("cancel", () => { cancelled = true; });
    panel.buttons.append(input);
    // 注入後にはユーザーアクティベーションが失われ得る。信頼されたボタン操作を必ず用意。
    button(t("画像ファイルを選ぶ"), () => input.click());
    try { input.showPicker?.(); } catch { /* Chromeが追加のクリックを要求する場合は上のボタンを使う。 */ }
    await wait(() => result || cancelled, 120000);
    if (cancelled) return null;
    if (!/^image\/(png|jpeg|webp)$/.test(result.type) || !result.size || result.size > 20 * 1024 * 1024)
      throw new Error(t("対応する画像1枚（20MiB以内）を選んでください。"));
    return result;
  }
  async function choosePreset(config, file, warning) {
    show(t`送信せず準備します。プリセットと比率を確認して［準備する］を押してください。${warning ? `\n${warning}` : ""}`);
    const select = document.createElement("select"); select.setAttribute("aria-label", t("プリセット"));
    for (const p of config.presets) {
      const option = document.createElement("option"); option.value = p.id; option.textContent = p.name; select.append(option);
    }
    select.value = config.defaultId;
    const ratio = document.createElement("select"); ratio.setAttribute("aria-label", t("Geminiのアスペクト比"));
    for (const value of globalThis.CGCISettings.ratios) {
      const option = document.createElement("option"); option.value = value; option.textContent = value || t("アスペクト比：指定なし"); ratio.append(option);
    }
    const preview = document.createElement("textarea"); preview.readOnly = true; preview.rows = 5;
    preview.setAttribute("aria-label", t("使用するプロンプト")); preview.style.cssText = "width:100%;box-sizing:border-box;margin-top:8px";
    const update = () => { const p = config.presets.find(p => p.id === select.value); preview.value = promptFor(p); ratio.value = p.ratio; };
    select.addEventListener("change", update); update();
    panel.buttons.append(select); if (site === "gemini") panel.buttons.append(ratio); panel.buttons.append(preview);
    let imageUrl;
    if (file) {
      imageUrl = URL.createObjectURL(file);
      const img = document.createElement("img"); img.src = imageUrl; img.alt = t("今回使用する画像");
      img.style.cssText = "display:block;max-width:240px;max-height:140px;margin:8px 0"; panel.buttons.append(img);
    }
    let selection;
    button(t("準備する"), () => {
      const preset = config.presets.find(p => p.id === select.value);
      if (!promptFor(preset)) { preview.placeholder = t("本文が空です。設定でプロンプトを保存してください。"); return; }
      selection = { ...preset, ratio: ratio.value };
    });
    try { await wait(() => selection, 120000); return selection; }
    finally { if (imageUrl) URL.revokeObjectURL(imageUrl); }
  }
  async function selectRatio(ratio, url) {
    if (site !== "gemini" || !ratio) return;
    stage = t("アスペクト比"); show(t`Geminiのアスペクト比を${ratio}に設定しています。`);
    // 比率ボタンは画像モード選択の少し後に描画されるため、出現を待つ。
    let control;
    try { control = await wait(() => { checkLocation(url); const c = A.ratioButton(); return A.disabled(c) ? null : c; }, 8000); }
    catch (error) { if (controller.signal.aborted) throw error; checkLocation(url); control = A.ratioButton(); }
    if (A.disabled(control)) throw new Error(t("アスペクト比の操作が見つかりません。画面とgemini-adapter.jsを確認してください。"));
    if (A.ratioSelected(ratio)) return;
    control.click();
    const item = await wait(() => { checkLocation(url); return A.ratioItem(ratio); }, 8000);
    if (A.disabled(item)) throw new Error(t("指定したアスペクト比を選択できません。"));
    item.click();
    await wait(() => { checkLocation(url); return A.ratioSelected(ratio); }, 8000);
  }
  async function run(source = "clipboard") {
    if (running) return;
    running = true;
    await globalThis.PPI18n?.init();
    if (guarded && prepared && !A.text().trim() && !A.hasAttachment() && !A.generating()) guarded = false;
    if (guarded) { running = false; show(t("前回の処理で下書きが残っている可能性があります。画面を確認してください。自動再試行は行いません。"), { error: true }); return; }
    attempted = sent = changedMode = false;
    prepared = false;
    controller = new AbortController();
    const url = location.href;
    const total = setTimeout(() => controller.abort(new Error(t("全体の制限時間（360秒）を超えました。"))), 360000);
    const onNavigation = () => { try { checkLocation(url); } catch (error) { controller.abort(error); } };
    const navigationTimer = setInterval(onNavigation, 250);
    try {
      stage = t("事前確認"); show(t("1/6 設定と入力欄を確認しています。"));
      const settings = await globalThis.CGCISettings.load();
      const config = { autoSend: settings.device[`${site}Auto`] === true, manualPaste: settings.device.manualPaste === true };
      let preset = settings.config.presets.find(p => p.id === settings.config.defaultId);
      if (!settings.config.presets.some(p => promptFor(p))) throw new Error(t("プロンプトが未設定です。［設定］から保存してください。"));
      if (config.autoSend && settings.warning) throw new Error(t`${settings.warning} 自動送信せず停止しました。`);
      if (config.autoSend && !promptFor(preset)) throw new Error(t("既定プリセットの本文が未設定です。［設定］から保存してください。"));
      checkLocation(url); empty();
      stage = source === "file" ? t("ファイル選択") : t("クリップボード読取");
      show(t("2/6 画像を取得しています。"));
      const file = source === "file" ? await chooseFile(config.autoSend ? t`選択後に自動送信します。プリセット：${preset.name}、比率：${site === "gemini" ? preset.ratio || t("指定なし") : t("対象外")}` : t("選択後に設定を確認します。")) : await readFile();
      if (source === "file" && !file) { running = false; show(t("ファイル選択をキャンセルしました。添付・入力・送信はしていません。"), { done: true }); return; }
      if (!config.autoSend) { stage = t("実行前の選択"); preset = await choosePreset(settings.config, file, settings.warning); }
      const prompt = promptFor(preset);
      checkLocation(url); empty();
      await wait(() => document.hasFocus(), 15000);
      checkLocation(url); empty();
      stage = t("画像添付"); show(t("3/6 画像を添付しています。処理中は入力欄を操作しないでください。"));
      if (file && !config.manualPaste) {
        const transfer = new DataTransfer(); transfer.items.add(file);
        attempted = guarded = true; // change後に失敗しても再添付しない。
        const input = A.fileInput();
        if (input) {
          input.files = transfer.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (site === "gemini") {
          A.editor().focus();
          A.editor().dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
        } else throw new Error(t("画像用ファイル入力を特定できません。UI変更時はadapter.jsを確認してください。"));
      } else if (source === "file") throw new Error(t("ファイル選択には自動添付方式が必要です。設定のCtrl+V方式をOFFにしてください。"));
      else await nativePaste(url, !file);
      stage = t("添付完了確認"); show(t("4/6 添付の完了を確認しています。"));
      await wait(() => {
        checkLocation(url); checkInput();
        if (A.text().trim()) throw new Error(t("添付中に入力文が変更されました。既存の文は保持しています。"));
        if (A.uploadError()) throw new Error(t("画像のアップロードに失敗しました。残った添付を確認してください。"));
        return A.attachmentReady();
      }, 45000, A.attachmentDiagnostic);
      stage = t("画像作成モード"); show(t("5/6 画像作成モードを選択しています。"));
      if (!A.modeSelected()) {
        const add = A.add();
        if (A.disabled(add)) throw new Error(t("ツールメニューを開けません。画像添付は保持しています。"));
        if (add.getAttribute("aria-expanded") !== "true") add.click();
        const item = await wait(() => { checkLocation(url); return A.modeItem(); }, 8000);
        if (A.disabled(item)) throw new Error(t("画像作成モードが利用できません。アカウントの利用条件を確認してください。"));
        changedMode = guarded = true; item.click();
        await wait(() => { checkLocation(url); return A.modeSelected(); }, 8000);
      }
      checkLocation(url); checkInput();
      await selectRatio(preset.ratio, url);
      checkLocation(url); checkInput();
      if (A.text().trim()) throw new Error(t("モード選択後に入力文があります。上書きせず停止しました。"));
      if (!A.attachmentReady()) throw new Error(t("モード切替後に添付完了を確認できません。画面を確認してください。"));
      stage = t("プロンプト入力"); show(t("6/6 保存したプロンプトを入力しています。"));
      A.insert(prompt);
      await wait(() => {
        checkLocation(url); checkInput();
        return cleanText(A.text()) === prompt && !A.disabled(A.send()) && A.modeSelected() && A.attachmentReady();
      }, 10000, () => A.promptDiagnostic(prompt));
      // 一度安定したあとに再検証。固定待機だけで成功扱いにしない。
      await bounded(new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), 3000);
      checkLocation(url); checkInput();
      if (cleanText(A.text()) !== prompt || !A.modeSelected() || !A.attachmentReady() || (site === "gemini" && !A.ratioSelected(preset.ratio))) throw new Error(t("最終確認で入力状態が変わりました。送信せず停止しました。"));
      if (config.autoSend) {
        stage = t("送信");
        if (!document.hasFocus() || A.disabled(A.send())) throw new Error(t("送信できません。対象サイトを前面にして内容を確認してください。"));
        show(t("確認済みの画像とプロンプトを1回だけ送信します。"));
        const beforeIds = A.messageIds();
        // ここまで対象チャットを固定。送信後には追加操作をせず、会話への反映だけを読む。
        // ChatGPTの一時URL→確定URLの遷移を送信失敗と誤判定しない。
        clearInterval(navigationTimer);
        sent = true; guarded = true; A.send().click();
        await wait(() => {
          if (location.origin !== new URL(url).origin) throw new Error(t("送信後に対象サイト以外へ移動しました。送信履歴を確認してください。"));
          return A.sentMessageVisible(prompt, beforeIds);
        }, 15000, () => t("今回の画像と本文が新しい会話メッセージに反映されたことを確認できませんでした。送信履歴を確認してください。"));
        guarded = false;
        running = false; show(t("送信操作後の画面変化を確認しました。画像生成の結果は対象サイトで確認してください。"), { done: true });
      } else {
        prepared = true;
        running = false; show(t("準備できました。画像・画像作成モード・プロンプトを確認してください。送信はしていません。"), { done: true });
      }
    } catch (error) {
      running = false;
      const remains = sent ? t("送信操作は1回実行済みです。送信結果が不明でも自動再送はしません。履歴を確認してください。") :
        attempted ? t("添付操作済みです。画像が後から反映される場合もあります。添付・入力文を自分で確認してください。") : t("添付操作は実行していません。");
      const draft = A.text().trim() ? t("入力文が残っています。") : t("現在、入力文は検出されていません。");
      show(t`${stage}で停止：${error.message}\n${remains}\n${draft}${A.modeSelected() ? t("画像作成モードは選択済みです。") : changedMode ? t("モード選択を試みました。画面を確認してください。") : ""}\n残った内容を削除・上書きしません。`, { error: true });
      console.warn(t("[CGCI] 停止段階:"), stage); // 画像やプロンプトはログへ出さない。
    } finally {
      clearTimeout(total); clearInterval(navigationTimer); controller.abort();
      running = false;
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "CGCI_START" || !["https://chatgpt.com", "https://gemini.google.com"].includes(location.origin) || (message.source !== undefined && !["clipboard", "file"].includes(message.source))) return;
    reply({ accepted: !running && !guarded });
    void run(message.source);
  });
})();
