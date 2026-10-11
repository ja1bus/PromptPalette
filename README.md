# PromptPalette

[English](README.en.md) | 日本語

PromptPalette は、ChatGPT と Gemini で画像を作るときの準備をまとめて行う Google Chrome の拡張機能です。クリップボードの画像または選んだ画像ファイルを、開いているチャットに添付し、画像作成モードの選択と、保存しておいたプロンプト（プリセット）の入力までを行います。送信は手動か、設定で自動にできます。画面は英語と日本語に対応しています。

このリポジトリは、一般公開している PromptPalette のソースコードです。

## 主な機能

- クリップボードの画像、または選んだ画像ファイル（PNG・JPEG・WebP、1枚、20 MiB 以内）を ChatGPT・Gemini のチャットに添付
- 画像作成モードの選択と、プリセットの本文の入力。Gemini では比率（1:1・9:16・3:4・4:3・16:9。既定は指定なし）も選択
- プリセットは最大20件。本文は両サイト共通か、サイトごとに分けて保存
- 自動送信 OFF（既定）では、実行時にプリセットと比率を選んで準備し、内容を確認してから手動で送信。ON では既定のプリセットで1回だけ送信
- 拡張機能のアイコン、ショートカット（クリップボード画像は既定 Ctrl+Shift+Y、画像ファイルは未割り当て）で実行
- 設定の書き出し・読み込み（JSON）と、Chrome 同期を使った任意の PC 間でのプリセット共有（既定は OFF）。届いた更新は確認してから反映し、すべて空になる更新・多くの削除・同時編集は利用者が選ぶまで反映しない。上書き前の内容はこの PC にバックアップとして残す
- 表示言語は自動・English・日本語から選択

既存の下書き・添付・回答の生成中などを確認し、想定と違う状態では操作をやめます。失敗したときに自動で添付や送信をやり直すことはしません。権限は `activeTab`・`scripting`・`clipboardRead`・`storage` だけで、拡張機能のアイコンかショートカットで実行したタブにだけアクセスします。画像はページの中だけで扱い、保存も外部への送信もしません（サイトへの添付・送信を除く）。

## 対応 OS と実行環境

- Google Chrome 120 以降（最新の安定版を推奨）。動作確認は Windows 11 で行っています。
- ChatGPT（https://chatgpt.com/ ）または Gemini（https://gemini.google.com/ ）に Chrome でログインしていること。
- ビルド・API キー・独自のサーバーは不要です。

## インストール

正式な配布先は Chrome ウェブストアです。そちらから入手してください（無料）。

- Chrome ウェブストア: https://chromewebstore.google.com/detail/promptpalette/fefcnpbglobpebdlognmaeddddpnnpjh

この GitHub リポジトリでは、パッケージ化した拡張機能（ZIP・CRX）は配布していません。

## 基本的な使い方

1. 拡張機能のアイコンを右クリックして「オプション」を開き、プリセットを作って「すべて保存」を押します。
2. ChatGPT または Gemini のチャットを開きます。
3. 画像をクリップボードにコピーして、アイコンまたはショートカットで実行します。画像ファイルを使う場合は、ショートカットを chrome://extensions/shortcuts で割り当てるか、設定でアイコンの入力元を変えます。
4. 自動送信 OFF では、表示されたパネルでプリセット（Gemini では比率も）を選んで「準備する」を押し、添付・モード・本文を確認して送信します。

詳しくは取扱説明書をご覧ください。

- 取扱説明書: https://www.iwanaga.net/promptpalette/manual/

## ソースから読み込む・テストする

### 必要なもの

- Google Chrome 120 以降
- テストを実行する場合だけ [Node.js](https://nodejs.org/)（`node:test` で glob を使うため 21 以降。確認済み: 24.19.0）。npm パッケージは使いません。

### Chrome への読み込み

ビルドは不要です。chrome://extensions で「デベロッパー モード」をオンにし、「パッケージ化されていない拡張機能を読み込む」でこのリポジトリのフォルダ（`manifest.json` のあるフォルダ）を選びます。

`manifest.json` の `key` は Chrome ウェブストア版の公開鍵で、読み込んだ拡張機能はストア版と同じ ID になります。ストア版を入れている Chrome では、先にストア版を無効にするか、別の Chrome プロファイルで読み込んでください。設定はストア版と共有されないことがあるため、必要なら先に設定を書き出してください。

### テスト

リポジトリのルートで実行します。Chrome の API とページの DOM を模擬したテストで、Chrome や ChatGPT・Gemini には接続しません。

```powershell
node --test "tests/*.test.cjs"
```

### 構成

| パス | 内容 |
|---|---|
| `manifest.json` | Manifest V3 の定義（権限・ショートカット・設定ページ） |
| `background.js` | service worker。実行の開始、スクリプトの注入、メッセージの確認、設定の保存と Chrome 同期 |
| `content.js` | ページ内の処理。画像の取得、添付、モード・比率の選択、入力、送信、進捗パネル |
| `adapter.js` / `gemini-adapter.js` | ChatGPT・Gemini の画面要素の検出と操作 |
| `settings.js` | 設定の形式・検証・移行、PC 間の共有（同期）とバックアップ |
| `options.html` / `options.css` / `options.js` | 設定画面 |
| `i18n.js` / `locale-data.js` / `_locales/` | 表示言語（英語・日本語） |
| `icons/` | アイコン |
| `tests/` | Node.js のテスト（`node:test`） |

Chrome ウェブストアへの申請用の資料・ZIP の作成スクリプトは、このリポジトリに含めていません。

ソースのコメントは日本語です。ChatGPT・Gemini の画面要素の検出は、確認した時点の各サイトの画面に合わせています。サイトの変更で動かなくなることがあります。

## ライセンス

[MIT License](LICENSE) で公開しています。

Copyright (c) 2026 ja1bus（© ja1bus）

外部サービスなどについては [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) をご覧ください。

## 無保証

このソフトウェアは「現状のまま」提供され、明示・黙示を問わず、いかなる保証もありません。作者は、このソフトウェアの使用によって生じたいかなる損害についても責任を負いません（詳しくは [LICENSE](LICENSE) をご覧ください）。

## 関連リンク

- Web ページ: https://www.iwanaga.net/promptpalette/
- 取扱説明書: https://www.iwanaga.net/promptpalette/manual/
- 更新履歴: https://www.iwanaga.net/promptpalette/changelog/
- プライバシーポリシー: https://www.iwanaga.net/promptpalette/privacy/
- Chrome ウェブストア: https://chromewebstore.google.com/detail/promptpalette/fefcnpbglobpebdlognmaeddddpnnpjh
- お問い合わせ: support@iwanaga.net
