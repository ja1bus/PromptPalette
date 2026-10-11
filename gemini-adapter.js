"use strict";
(() => {
  const t = globalThis.PPI18n?.t || ((s, ...v) => typeof s === "string" ? s : s.reduce((a, b, i) => a + b + (i < v.length ? v[i] : ""), ""));
  if (location.origin !== "https://gemini.google.com" || globalThis.CGCIGeminiAdapter) return;
  const B = globalThis.CGCIAdapter;
  const A = { ...B, site: "gemini" };
  A.label = e => {
    const label = e.getAttribute("aria-label") || e.getAttribute("title");
    if (label) return label.trim();
    const read = node => {
      if (node.nodeType === 3) return node.nodeValue || "";
      if (node.nodeType !== 1 || node.matches("[aria-hidden=true],mat-icon,gem-icon")) return "";
      return [...node.childNodes].map(read).join("");
    };
    return read(e).trim();
  };
  A.editor = () => A.unique([...document.querySelectorAll("[contenteditable='true'][role='textbox'][aria-label]")]
    .filter(A.visible).filter(e => /Gemini|プロンプト|prompt/i.test(e.getAttribute("aria-label"))));
  A.root = () => A.editor()?.closest("input-container");
  A.imagePill = () => null;
  A.text = () => A.readEditorText(A.editor());
  const rootButtons = () => A.buttons(A.root() || document.createElement("div"));
  A.add = () => A.unique(rootButtons().filter(e => /^(アップロードとツール|Upload and tools|Uploads and tools)$/i.test(A.label(e))));
  A.send = () => A.unique(rootButtons().filter(e => /^(送信|メッセージを送信|プロンプトを送信|Send|Send message|Send prompt)$/i.test(A.label(e)) || e.getAttribute("data-test-id") === "send-button"));
  A.generating = () => A.buttons(document).some(e => /^(回答を停止|応答を停止|停止|Stop response|Stop generating|Stop)$/i.test(A.label(e)));
  A.modeItem = () => A.unique(A.buttons(document).filter(e => /^(画像を作成|Create image|Create images)$/i.test(A.label(e))));
  A.modeSelected = () => rootButtons().some(e => /^(画像の選択を解除|Deselect images|Deselect image|Deselect image creation)$/i.test(A.label(e)));
  A.otherMode = () => rootButtons().some(e => /選択を解除|^Deselect /i.test(A.label(e)) && !/画像|image/i.test(A.label(e)));
  A.previewImages = () => [...(A.root()?.querySelectorAll("img") || [])].filter(A.visible);
  A.removeButtons = () => rootButtons().filter(e => /^(.*(?:ファイル|添付).*(?:削除|解除)|画像を削除|Remove (?:file|image|attachment)|Delete (?:file|image))$/i.test(A.label(e)));
  A.hasAttachment = () => A.previewImages().length > 0 || !!A.root()?.querySelector("file-preview,user-query-file-preview,[data-test-id='file-preview']") ||
    [...(A.root()?.querySelectorAll("input[type=file]") || [])].some(e => e.files?.length);
  A.uploadBusy = () => [...(A.root()?.querySelectorAll("[role=progressbar],[aria-busy=true]") || [])].some(A.visible);
  A.uploadError = () => /アップロード.*失敗|アップロードでき|Upload failed|Unable to upload|Error uploading/i.test(A.root()?.innerText || "");
  A.attachmentReady = () => A.previewImages().length === 1 && A.previewImages().every(e => e.complete && e.naturalWidth > 0) &&
    !A.uploadBusy() && !A.uploadError() && !A.disabled(A.send());
  A.attachmentDiagnostic = () => t`画像枚数=${A.previewImages().length}、画像読込=${A.previewImages().every(e => e.complete && e.naturalWidth > 0) ? "OK" : "NG"}、処理中=${A.uploadBusy() ? t("あり") : t("なし")}、送信ボタン検出=${A.send() ? "OK" : "NG"}、送信可能=${!A.disabled(A.send()) ? "OK" : "NG"}`;
  A.fileInputs = () => [...document.querySelectorAll("input[type=file]")];
  A.fileInputSummary = () => {
    const summary = { total: 0, camera: 0, image: 0, media: 0, generic: 0, other: 0, busy: 0 };
    for (const e of A.fileInputs()) { summary.total++; summary[B.inputKind(e)]++; }
    return summary;
  };
  A.fileInput = () => A.unique([...document.querySelectorAll("input[type=file]")].filter(e => !e.disabled && !e.files?.length && /image\//i.test(e.accept)));
  A.insert = text => {
    const e = A.editor();
    if (!e || A.text().trim()) throw new Error(t("入力欄が変わったか、既存の入力文があります。"));
    e.focus();
    const range = document.createRange(); range.selectNodeContents(e.querySelector("p") || e); range.collapse(true);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    if (!document.execCommand("insertText", false, text)) throw new Error(t("入力が拒否されました。画面で本文を確認してください。"));
  };
  // 選択後のaria-labelは「アスペクト比、4:3」「Aspect ratio, 4:3」のように現在値を含む。
  const ratioLabel = /^(?:(?:アスペクト比|Aspect ratio)(?:\s*[、,:：]\s*(1:1|9:16|3:4|4:3|16:9))?|(1:1|9:16|3:4|4:3|16:9))$/i;
  A.ratioButton = () => A.unique(rootButtons().filter(e => ratioLabel.test(A.label(e))));
  A.ratioValue = e => { const m = e && A.label(e).match(ratioLabel); return m ? m[1] || m[2] || "" : ""; };
  A.ratioItem = ratio => A.unique([...document.querySelectorAll("[role=menuitemradio]")].filter(A.visible).filter(e => A.label(e) === ratio));
  A.ratioSelected = ratio => !ratio || !!A.ratioItem(ratio)?.matches("[aria-checked=true]") || A.ratioValue(A.ratioButton()) === ratio;
  A.userMessages = () => [...document.querySelectorAll("user-query")];
  A.messageKey = e => e.querySelector("[id^='user-query-content-']")?.id;
  A.messageIds = () => new Set(A.userMessages().map(A.messageKey));
  A.sentMessageVisible = (prompt, before) => A.userMessages().some(e => {
    const key = A.messageKey(e);
    const paragraphs = [...e.querySelectorAll("[id^='user-query-content-'] p")];
    const body = paragraphs.map(p => A.readEditorText(p).trim()).join("\n").trim();
    return key && !before.has(key) && body === prompt && [...e.querySelectorAll("img[data-test-id='uploaded-img']")].filter(A.visible).length === 1;
  });
  A.promptDiagnostic = prompt => t`本文一致=${A.text().trim() === prompt ? "OK" : "NG"}、画像モード=${A.modeSelected() ? "OK" : "NG"}、添付完了=${A.attachmentReady() ? "OK" : "NG"}`;
  globalThis.CGCIGeminiAdapter = A;
})();
