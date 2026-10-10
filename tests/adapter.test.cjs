"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const context = vm.createContext({ document: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../adapter.js"), "utf8"), context);
const A = context.CGCIAdapter;
const text = value => ({ nodeType: 3, nodeValue: value });
const node = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes });
const imagePill = () => {
  const pill = node("SPAN", text("画像を作成する"));
  const attrs = { contenteditable: "false", "data-system-hint-type": "picture_v2",
    "data-prompt-link-href": "chatgpt-system-hint://picture_v2" };
  pill.getAttribute = name => attrs[name] || null;
  return pill;
};
test("送信確認は新規ID・本文一致・添付画像をすべて要求する", () => {
  const body = node("DIV", node("P", text("送信本文")));
  const image = { alt: "ユーザーの添付画像" };
  let id = "new", hasImage = true;
  const message = { getAttribute: () => id, querySelector: () => body, querySelectorAll: () => hasImage ? [image] : [] };
  const previous = { userMessages: A.userMessages, visible: A.visible };
  A.userMessages = () => [message]; A.visible = () => true;
  assert.equal(A.sentMessageVisible("送信本文", new Set(["old"])), true);
  id = "old";
  assert.equal(A.sentMessageVisible("送信本文", new Set(["old"])), false);
  id = "new";
  assert.equal(A.sentMessageVisible("別の本文", new Set()), false);
  hasImage = false;
  assert.equal(A.sentMessageVisible("送信本文", new Set()), false);
  Object.assign(A, previous);
});
test("実画面の画像作成タグを本文として数えず、続く本文は保持する", () => {
  assert.equal(A.readEditorText(node("DIV", node("P", imagePill(), text(" ")))).trim(), "");
  assert.equal(A.readEditorText(node("DIV", node("P", imagePill(), text(" 指示文")))).trim(), "指示文");
  assert.equal(A.readEditorText(node("DIV", node("P", text("画像を作成する")))), "画像を作成する");
});
test("画像作成タグを識別する際は表示文字だけで判断しない", () => {
  assert.equal(A.isImagePill(imagePill()), true);
  assert.equal(A.isImagePill(node("SPAN", text("画像を作成する"))), false);
});
test("隣接する段落の区切りを1改行として比較する", () => {
  const editor = node("DIV", node("P", text("一行目")), node("P", text("二行目")));
  editor.innerText = "一行目\n\n二行目";
  assert.notEqual(editor.innerText, "一行目\n二行目");
  assert.equal(A.readEditorText(editor), "一行目\n二行目");
});
test("空段落と連続改行を保存する", () => {
  assert.equal(A.readEditorText(node("DIV", node("P", text("一")), node("P", node("BR")), node("P", text("三")))), "一\n\n三");
  assert.equal(A.readEditorText(node("DIV", node("P", text("一"), node("BR"), node("BR"), text("三")))), "一\n\n三");
});
test("実画面で確認したliteral-paste spanを読み取る", () => {
  assert.equal(A.readEditorText(node("DIV", node("P", node("SPAN", text("一行目"), node("BR"), text("二行目"), node("BR"), node("BR"), text("四行目"))))), "一行目\n二行目\n\n四行目");
});
test("スペースとゼロ幅文字を勝手に消さない", () => {
  assert.equal(A.readEditorText(node("DIV", node("P", text("a  b\u200bc")))), "a  b\u200bc");
});
test("空のカーソル表示用brを本文と扱わない", () => {
  assert.equal(A.readEditorText(node("DIV", node("P", node("BR")))), "");
});
test("明示的な改行とProseMirrorの補助brを区別する", () => {
  const trailing = node("BR");
  trailing.classList = { contains: name => name === "ProseMirror-trailingBreak" };
  assert.equal(A.readEditorText(node("DIV", node("P", text("一"), node("BR"), trailing), node("P", text("三")))), "一\n\n三");
});
test("textareaの改行コードを揃える", () => {
  assert.equal(A.readEditorText({ tagName: "TEXTAREA", value: "a\r\nb" }), "a\nb");
});
test("入力時のカーソルを段落の外へ置かない", () => {
  const paragraph = node("P", node("BR"));
  const editor = { tagName: "DIV", focus() {}, querySelector: () => paragraph };
  let rangeNode, collapsed, command;
  const range = { selectNodeContents: target => { rangeNode = target; }, collapse: value => { collapsed = value; } };
  context.document = { createRange: () => range, execCommand: (...args) => { command = args; return true; } };
  context.window = { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };
  A.editor = () => editor;
  A.text = () => "";
  A.insert("検証文");
  assert.equal(rangeNode, paragraph);
  assert.equal(collapsed, true);
  assert.equal(command[0], "insertText");
  assert.equal(command[2], "検証文");
});
test("モードタグがある場合は段落末尾へ挿入してタグを保持する", () => {
  const saved = A.imagePill;
  let collapsed;
  A.imagePill = () => imagePill();
  context.document.createRange = () => ({ selectNodeContents() {}, collapse: value => { collapsed = value; } });
  A.insert("タグの後の指示");
  assert.equal(collapsed, false);
  A.imagePill = saved;
});
test("診断は本文を出さず、不成立の条件だけを示す", () => {
  A.text = () => "秘密の文";
  A.send = () => null;
  A.modeSelected = () => true;
  A.attachmentReady = () => true;
  const result = A.promptDiagnostic("別の文");
  assert.match(result, /本文一致=NG/);
  assert.match(result, /送信可能=NG/);
  assert.match(result, /画像作成モード=OK/);
  assert.ok(!result.includes("秘密の文") && !result.includes("別の文"));
});
