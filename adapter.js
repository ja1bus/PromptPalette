"use strict";
// ChatGPTのDOM差異はこのファイルに集約する。CSSクラスには依存しない。
(() => {
  const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
  if (globalThis.CGCIAdapter) return;
  const A = {};
  A.visible = e => !!e && e.isConnected && !e.closest("[hidden],[aria-hidden='true']") &&
    e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none";
  A.label = e => (e.getAttribute("aria-label") || e.getAttribute("title") || e.innerText || "").trim();
  A.buttons = root => [...root.querySelectorAll("button,[role='button'],[role='menuitem'],[role='menuitemradio'],[role='menuitemcheckbox']")].filter(A.visible);
  A.unique = list => list.length === 1 ? list[0] : null;
  A.editor = () => A.unique([...document.querySelectorAll(
    "[data-chatgpt-composer] [contenteditable='true'][role='textbox'],#prompt-textarea,textarea[placeholder]"
  )].filter(A.visible).filter(e => e.tagName !== "TEXTAREA" || /ChatGPT|メッセージ|Message|Ask|何でも/i.test(e.placeholder || e.getAttribute("aria-label") || "")));
  A.root = () => A.editor()?.closest("form") || A.editor()?.closest("[data-chatgpt-composer]");
  // 実画面で確認した編集不可の画像作成タグ。本文の文字列だけでは判定しない。
  A.isImagePill = e => e?.getAttribute?.("contenteditable") === "false" &&
    e.getAttribute("data-system-hint-type") === "picture_v2" &&
    e.getAttribute("data-prompt-link-href") === "chatgpt-system-hint://picture_v2";
  A.imagePill = () => A.unique([...(A.editor()?.querySelectorAll?.("[data-inline-selection-pill]") || [])]
    .filter(e => A.isImagePill(e) && A.visible(e)));
  // innerTextは隣接する<p>の間に余分な空行を入れるため、段落構造から読む。
  // 空行や連続スペースを一律に潰すと本文の不一致を見逃すので、そのまま保持する。
  A.readEditorText = e => {
    if (!e) return "";
    if (e.tagName === "TEXTAREA") return e.value.replace(/\r\n/g, "\n");
    const block = node => node.nodeType === 1 && /^(P|DIV|LI|PRE|BLOCKQUOTE|H[1-6])$/.test(node.tagName);
    const read = node => {
      if (node.nodeType === 3) return node.nodeValue || "";
      if (node.nodeType !== 1) return "";
      if (A.isImagePill(node)) return "";
      if (node.tagName === "BR") return node.classList?.contains("ProseMirror-trailingBreak") ? "" : "\n";
      const children = [...node.childNodes];
      // 空の段落のカーソル表示用brは本文の改行ではない。
      if (children.length === 1 && children[0].tagName === "BR") return "";
      let result = "";
      children.forEach((child, index) => {
        if (index && (block(child) || block(children[index - 1]))) result += "\n";
        result += read(child);
      });
      return result;
    };
    return read(e).replace(/\r\n/g, "\n");
  };
  A.text = () => A.readEditorText(A.editor());
  // 送信後の会話DOMで確認した属性。URL変更や入力欄の消去だけでは送信確認にしない。
  A.userMessages = () => [...document.querySelectorAll("[data-chatgpt-search-message-ids]")]
    .filter(e => e.querySelector("[data-user-message-bubble='true']"));
  A.messageIds = () => new Set(A.userMessages().map(e => e.getAttribute("data-chatgpt-search-message-ids")));
  // 表示上の空白・改行の揺れだけを吸収する。
  A.normalize = text => text.replace(/\r\n/g, "\n").replace(/[ \t\u00a0]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
  // 2026-10-11の実画面では、本文の data-markdown-text-tone が無くなり、吹き出しの中は属性のないdivだけだった。
  // 本文は旧属性があればそこから、なければ吹き出し全体から読み、モード名などの表示が加わっても一致とみなせるよう包含で比べる。
  // 画像はaltの文言に依存せず、新しいメッセージ内に表示された画像の有無で確認する。
  A.sentStatus = (prompt, beforeIds) => {
    const fresh = A.userMessages().filter(e => {
      const id = e.getAttribute("data-chatgpt-search-message-ids");
      return id && !beforeIds.has(id);
    });
    const expected = A.normalize(prompt);
    const status = { fresh: fresh.length, textMatches: false, images: 0, ok: false };
    for (const e of fresh) {
      const body = e.querySelector("[data-markdown-text-tone='user-message']") || e.querySelector("[data-user-message-bubble='true']");
      const textMatches = !!body && A.visible(body) && !!expected && A.normalize(A.readEditorText(body)).includes(expected);
      const images = [...e.querySelectorAll("img")].filter(img => A.visible(img) &&
        (/^(ユーザーの添付画像|User uploaded image|Uploaded image)$/i.test(img.alt || "") || img.getBoundingClientRect().width >= 32)).length;
      status.textMatches ||= textMatches; status.images = Math.max(status.images, images);
      if (textMatches && images >= 1) status.ok = true;
    }
    return status;
  };
  A.sentMessageVisible = (prompt, beforeIds) => A.sentStatus(prompt, beforeIds).ok;
  A.sentDiagnostic = (prompt, beforeIds) => {
    const status = A.sentStatus(prompt, beforeIds);
    return t`新しいメッセージ=${status.fresh}件、本文一致=${status.textMatches ? "OK" : "NG"}、画像=${status.images}枚`;
  };
  A.disabled = e => !e || e.disabled || e.getAttribute("aria-disabled") === "true" || e.getAttribute("contenteditable") === "false";
  A.generating = () => A.buttons(document).some(e => /^(停止|生成を停止|回答の生成を停止|Stop generating|Stop streaming|Stop)$/i.test(A.label(e)) || e.getAttribute("data-testid") === "stop-button");
  A.send = () => A.unique(A.buttons(A.root() || document.createElement("div")).filter(e =>
    /^(送信|メッセージを送信|Send|Send message|Send prompt)$/i.test(A.label(e)) || e.getAttribute("data-testid") === "send-button"));
  A.add = () => A.unique(A.buttons(A.root() || document.createElement("div")).filter(e =>
    /^(ファイルなどを追加|ファイルと写真を追加|ツール|Add files and more|Add photos and files|Tools)$/i.test(A.label(e)) || e.getAttribute("data-composer-navigation-target") === "add-context"));
  A.modeItem = () => A.unique(A.buttons(document).filter(e =>
    /^(画像を作成(?:する)?|Create image|Create an image|Create images)(?:\s|$)/i.test(A.label(e)) && !/削除|Remove|Cancel/i.test(A.label(e))));
  A.modeSelected = () => !!A.imagePill() || A.buttons(A.root() || document.createElement("div")).some(e =>
    /^(画像を作成(?:する)?\s*を削除|Remove\s+(?:Create\s+(?:an?\s+)?images?)|Cancel\s+(?:Create\s+(?:an?\s+)?images?))$/i.test(A.label(e)) ||
    (/^(画像を作成(?:する)?|Create (?:an? )?images?)$/i.test(A.label(e)) &&
      (e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-checked") === "true")));
  A.otherMode = () => A.buttons(A.root() || document.createElement("div")).some(e =>
    /を削除$|^Remove /i.test(A.label(e)) && !/画像を作成|Create (?:an? )?images?/i.test(A.label(e)) && !/添付|ファイル|画像|attachment|file|image/i.test(A.label(e)));
  A.area = () => A.root()?.querySelector("[data-composer-attachments]");
  A.previewImages = () => [...(A.area()?.querySelectorAll("img") || [])].filter(A.visible);
  A.removeButtons = () => A.buttons(A.area() || document.createElement("div")).filter(e =>
    /削除|取り消|Remove|Delete|Cancel/i.test(A.label(e)));
  A.hasAttachment = () => {
    const root = A.root();
    const area = A.area();
    return !!(area && A.visible(area) && (area.children.length || area.textContent.trim())) ||
      !!root?.querySelector("img,[data-testid*='attachment'],[data-testid*='file-preview']") ||
      [...(root?.querySelectorAll("input[type='file']") || [])].some(e => e.files?.length);
  };
  A.uploadBusy = () => !!A.area() && ([...A.area().querySelectorAll("[role='progressbar'],[aria-busy='true']")].some(A.visible) ||
    /アップロード中|Uploading|Processing|処理中/i.test(A.area().innerText));
  A.uploadError = () => /アップロード.*失敗|アップロードでき|Upload failed|Unable to upload|Error uploading/i.test(A.area()?.innerText || "");
  // 完了はDOM上のプレビュー、削除操作、送信可能状態で判断する。サーバ応答そのものは読まない。
  A.attachmentReady = () => A.previewImages().length === 1 && A.previewImages().every(e => e.complete && e.naturalWidth > 0) &&
    A.removeButtons().length === 1 && !A.uploadBusy() && !A.uploadError() && !A.disabled(A.send());
  A.promptStatus = prompt => {
    const text = A.text().replace(/\r\n/g, "\n").trim();
    return { textMatches: text === prompt, textLength: text.length, expectedLength: prompt.length,
      sendEnabled: !A.disabled(A.send()), modeSelected: A.modeSelected(), attachmentReady: A.attachmentReady() };
  };
  A.promptDiagnostic = prompt => {
    const status = A.promptStatus(prompt);
    const flag = value => value ? "OK" : "NG";
    return t`本文一致=${flag(status.textMatches)}（入力${status.textLength}文字／設定${status.expectedLength}文字）、送信可能=${flag(status.sendEnabled)}、画像作成モード=${flag(status.modeSelected)}、添付完了=${flag(status.attachmentReady)}`;
  };
  // 入力欄内のfile inputを属性と意味で分類する。実画面（2026-10）では写真を撮る（capture）、写真を添付（image/*）、
  // 写真または動画を添付（image/*,video/*）、ファイルを添付（accept指定なし）が同時に存在した。
  A.inputLabel = e => (e.getAttribute("aria-label") || e.getAttribute("title") || "").trim();
  A.inputKind = e => {
    if (e.disabled || e.files?.length) return "busy";
    const label = A.inputLabel(e);
    if (e.hasAttribute("capture") || /写真を撮る|撮影|カメラ|take (?:a )?(?:photo|picture)|camera/i.test(label)) return "camera";
    const accept = (e.getAttribute("accept") || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!accept.length) return "generic";
    const image = a => a === "image/*" || /^image\/[\w.+-]+$/.test(a) || /^\.(png|jpe?g|webp|gif)$/.test(a);
    if (!accept.some(image)) return "other";
    if (accept.every(image)) return "image";
    return accept.every(a => image(a) || /^video\//.test(a)) ? "media" : "other";
  };
  A.fileInputs = () => [...(A.root()?.querySelectorAll("input[type='file']") || [])];
  A.fileInputSummary = () => {
    const summary = { total: 0, camera: 0, image: 0, media: 0, generic: 0, other: 0, busy: 0 };
    for (const e of A.fileInputs()) { summary.total++; summary[A.inputKind(e)]++; }
    return summary;
  };
  // 画像専用→画像と動画→ファイル添付の順に、同じ優先度の候補が1つに定まる場合だけ選ぶ。先頭候補では選ばない。
  A.fileInput = () => {
    const inputs = A.fileInputs();
    const attachLabel = /添付|アップロード|追加|attach|upload|add/i;
    for (const kind of ["image", "media", "generic"]) {
      let list = inputs.filter(e => A.inputKind(e) === kind);
      if (kind === "generic") list = list.filter(e => attachLabel.test(A.inputLabel(e)));
      if (!list.length) continue;
      // 同じ優先度に複数あれば添付用のラベルで絞る。それでも定まらなければ下位へ進まず停止する。
      if (list.length > 1) list = list.filter(e => attachLabel.test(A.inputLabel(e)));
      return A.unique(list);
    }
    return null;
  };
  A.insert = text => {
    const e = A.editor();
    if (!e || A.text().trim()) throw new Error(t("入力欄が変わったか、既存の入力文があります。"));
    e.focus();
    if (e.tagName === "TEXTAREA") {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(e, text);
      e.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // textContentの直書きは行わず、ブラウザーの編集操作を通してエディターへ反映する。
      const range = document.createRange();
      // エディター直下の段落の外ではなく、空の段落の中にカーソルを置く。
      range.selectNodeContents(e.querySelector("p") || e);
      // 新UIのモードタグを置換せず、タグの後に本文を挿入する。
      range.collapse(!A.imagePill());
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand("insertText", false, text)) throw new Error(t("入力操作が拒否されました。プロンプトを手動で貼り付けてください。"));
    }
  };
  globalThis.CGCIAdapter = A;
})();
