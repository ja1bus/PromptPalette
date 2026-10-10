"use strict";
// _locales/en/jaと同じ翻訳。手動言語選択用のローカル辞書。
globalThis.PPMessageCatalog = {
  "m000": {
    "ja": "開始前",
    "en": "Not started"
  },
  "m001": {
    "ja": "設定",
    "en": "Settings"
  },
  "m002": {
    "ja": "中止",
    "en": "Cancel"
  },
  "m003": {
    "ja": "閉じる",
    "en": "Close"
  },
  "m004": {
    "ja": "残った下書きを確認済み・ロック解除",
    "en": "I checked the remaining draft — unlock"
  },
  "m005": {
    "ja": "ユーザーが中止しました。",
    "en": "Cancelled by the user."
  },
  "m006": {
    "ja": "中止しました。",
    "en": "Cancelled."
  },
  "m007": {
    "ja": "実行ロックを解除しました。再実行には、残った入力文と添付を自分で処理し、空の入力欄にしてください。",
    "en": "Unlocked. Review and clear the remaining text and attachments before running again."
  },
  "m008": {
    "ja": "チャットの移動を検出しました。元のチャットの下書きを確認してください。",
    "en": "The chat changed. Check the draft in the original chat."
  },
  "m009": {
    "ja": "チャット入力欄が見つかりません。通常のChat画面を開いてください。UI変更時はadapter.jsを確認してください。",
    "en": "The chat composer was not found. Open a regular chat. If the UI changed, check the site adapter."
  },
  "m010": {
    "ja": "回答生成中、または入力できない状態です。終了後に実行してください。",
    "en": "A response is being generated, or the composer is unavailable. Wait and try again."
  },
  "m011": {
    "ja": "既存の入力文または添付があります。内容を自分で確認・処理してから実行してください。",
    "en": "The composer already contains text or attachments. Review and clear them before running."
  },
  "m012": {
    "ja": "別のツールが選択されています。自分で解除してから実行してください。",
    "en": "Another tool is selected. Deselect it before running."
  },
  "m013": {
    "ja": "\n確認結果：{0}",
    "en": "\nChecks: {0}"
  },
  "m014": {
    "ja": "\n確認結果を取得できませんでした。",
    "en": "\nCould not obtain diagnostic checks."
  },
  "m015": {
    "ja": "時間内に状態を確認できませんでした。画面の状態と通信環境を確認してください。{0}",
    "en": "The operation timed out. Check the page and your connection.{0}"
  },
  "m016": {
    "ja": "2/6 クリップボードを読み取れませんでした。対象サイトを前面にして［画像を読み取って続行］を押してください。",
    "en": "2/6 Could not read the clipboard. Focus the chat tab and click [Read image and continue]."
  },
  "m017": {
    "ja": "画像を読み取って続行",
    "en": "Read image and continue"
  },
  "m018": {
    "ja": "クリップボードの読み取りがタイムアウトしました。",
    "en": "Clipboard reading timed out."
  },
  "m019": {
    "ja": "フォーカスがありません。",
    "en": "The page is not focused."
  },
  "m020": {
    "ja": "クリップボードに対応する画像がありません。Win+Shift+Sで画像をコピーしてください。",
    "en": "No supported image is on the clipboard. Copy an image using Win+Shift+S."
  },
  "m021": {
    "ja": "画像が複数あります。画像1枚だけをコピーしてください。",
    "en": "Multiple images were found. Copy exactly one image."
  },
  "m022": {
    "ja": "画像が空、または20MiBを超えています。小さな画像をコピーしてください。",
    "en": "The image is empty or exceeds 20 MiB. Copy a smaller image."
  },
  "m023": {
    "ja": "3/6 {0}［貼り付け待機］を押し、入力欄で実際にCtrl+Vを1回押してください。画像だけを受け付けます。",
    "en": "3/6 {0}Click [Wait for paste], then press Ctrl+V once in the composer. Only images are accepted."
  },
  "m024": {
    "ja": "読み取り権限が拒否されました。",
    "en": "Clipboard access was denied. "
  },
  "m025": {
    "ja": "手動添付方式です。",
    "en": "Manual attachment mode. "
  },
  "m026": {
    "ja": "貼り付け待機",
    "en": "Wait for paste"
  },
  "m027": {
    "ja": "貼り付け内容が対応する画像1枚ではありません。画像をコピーし直してください。",
    "en": "The pasted content is not one supported image. Copy the image again."
  },
  "m028": {
    "ja": "画像ファイルを選んでください。{0}\nPNG・JPEG・WebP、1枚、20MiB以内。キャンセルすると終了します。",
    "en": "Choose an image file. {0}\nOne PNG, JPEG or WebP image, up to 20 MiB. Cancel to exit."
  },
  "m029": {
    "ja": "画像ファイルを選ぶ",
    "en": "Choose image file"
  },
  "m030": {
    "ja": "対応する画像1枚（20MiB以内）を選んでください。",
    "en": "Choose one supported image up to 20 MiB."
  },
  "m031": {
    "ja": "送信せず準備します。プリセットと比率を確認して［準備する］を押してください。{0}",
    "en": "Prepare without sending. Review the preset and aspect ratio, then click [Prepare].{0}"
  },
  "m032": {
    "ja": "プリセット",
    "en": "Presets"
  },
  "m033": {
    "ja": "Geminiのアスペクト比",
    "en": "Gemini aspect ratio"
  },
  "m034": {
    "ja": "アスペクト比：指定なし",
    "en": "Aspect ratio: unspecified"
  },
  "m035": {
    "ja": "使用するプロンプト",
    "en": "Prompt to use"
  },
  "m036": {
    "ja": "今回使用する画像",
    "en": "Image for this run"
  },
  "m037": {
    "ja": "準備する",
    "en": "Prepare"
  },
  "m038": {
    "ja": "本文が空です。設定でプロンプトを保存してください。",
    "en": "The prompt is empty. Save a prompt in Settings."
  },
  "m039": {
    "ja": "アスペクト比",
    "en": "Aspect ratio"
  },
  "m040": {
    "ja": "Geminiのアスペクト比を{0}に設定しています。",
    "en": "Setting Gemini aspect ratio to {0}."
  },
  "m041": {
    "ja": "アスペクト比の操作が見つかりません。画面とgemini-adapter.jsを確認してください。",
    "en": "The aspect ratio control was not found. Check the page and gemini-adapter.js."
  },
  "m042": {
    "ja": "指定したアスペクト比を選択できません。",
    "en": "The requested aspect ratio is unavailable."
  },
  "m043": {
    "ja": "前回の処理で下書きが残っている可能性があります。画面を確認してください。自動再試行は行いません。",
    "en": "A draft may remain from the previous run. Check the page. No automatic retry will occur."
  },
  "m044": {
    "ja": "全体の制限時間（360秒）を超えました。",
    "en": "The overall time limit of 360 seconds was exceeded."
  },
  "m045": {
    "ja": "事前確認",
    "en": "Preflight checks"
  },
  "m046": {
    "ja": "1/6 設定と入力欄を確認しています。",
    "en": "1/6 Checking settings and the composer."
  },
  "m047": {
    "ja": "プロンプトが未設定です。［設定］から保存してください。",
    "en": "No prompt is configured. Save one in [Settings]."
  },
  "m048": {
    "ja": "{0} 自動送信せず停止しました。",
    "en": "{0} Stopped without automatic sending."
  },
  "m049": {
    "ja": "既定プリセットの本文が未設定です。［設定］から保存してください。",
    "en": "The default preset has no prompt. Save one in [Settings]."
  },
  "m050": {
    "ja": "ファイル選択",
    "en": "File selection"
  },
  "m051": {
    "ja": "クリップボード読取",
    "en": "Clipboard reading"
  },
  "m052": {
    "ja": "2/6 画像を取得しています。",
    "en": "2/6 Getting the image."
  },
  "m053": {
    "ja": "選択後に自動送信します。プリセット：{0}、比率：{1}",
    "en": "The image will be sent automatically after selection. Preset: {0}; aspect ratio: {1}"
  },
  "m054": {
    "ja": "指定なし",
    "en": "Unspecified"
  },
  "m055": {
    "ja": "対象外",
    "en": "Not applicable"
  },
  "m056": {
    "ja": "選択後に設定を確認します。",
    "en": "You will review the settings after selection."
  },
  "m057": {
    "ja": "ファイル選択をキャンセルしました。添付・入力・送信はしていません。",
    "en": "File selection cancelled. Nothing was attached, entered or sent."
  },
  "m058": {
    "ja": "実行前の選択",
    "en": "Review before running"
  },
  "m059": {
    "ja": "画像添付",
    "en": "Image attachment"
  },
  "m060": {
    "ja": "3/6 画像を添付しています。処理中は入力欄を操作しないでください。",
    "en": "3/6 Attaching the image. Do not edit the composer during this operation."
  },
  "m061": {
    "ja": "画像用ファイル入力を特定できません。UI変更時はadapter.jsを確認してください。",
    "en": "Could not identify the image upload input. Check adapter.js if the UI changed."
  },
  "m062": {
    "ja": "ファイル選択には自動添付方式が必要です。設定のCtrl+V方式をOFFにしてください。",
    "en": "File selection requires automatic attachment. Turn off manual Ctrl+V in Settings."
  },
  "m063": {
    "ja": "添付完了確認",
    "en": "Attachment verification"
  },
  "m064": {
    "ja": "4/6 添付の完了を確認しています。",
    "en": "4/6 Verifying the attachment."
  },
  "m065": {
    "ja": "添付中に入力文が変更されました。既存の文は保持しています。",
    "en": "The text changed during attachment. The existing text has been preserved."
  },
  "m066": {
    "ja": "画像のアップロードに失敗しました。残った添付を確認してください。",
    "en": "Image upload failed. Check the remaining attachment."
  },
  "m067": {
    "ja": "画像作成モード",
    "en": "Image creation mode"
  },
  "m068": {
    "ja": "5/6 画像作成モードを選択しています。",
    "en": "5/6 Selecting image creation mode."
  },
  "m069": {
    "ja": "ツールメニューを開けません。画像添付は保持しています。",
    "en": "Could not open the tools menu. The attachment has been preserved."
  },
  "m070": {
    "ja": "画像作成モードが利用できません。アカウントの利用条件を確認してください。",
    "en": "Image creation mode is unavailable. Check your account eligibility."
  },
  "m071": {
    "ja": "モード選択後に入力文があります。上書きせず停止しました。",
    "en": "Text appeared after mode selection. Stopped without overwriting it."
  },
  "m072": {
    "ja": "モード切替後に添付完了を確認できません。画面を確認してください。",
    "en": "Could not verify the attachment after switching mode. Check the page."
  },
  "m073": {
    "ja": "プロンプト入力",
    "en": "Prompt entry"
  },
  "m074": {
    "ja": "6/6 保存したプロンプトを入力しています。",
    "en": "6/6 Entering the saved prompt."
  },
  "m075": {
    "ja": "最終確認で入力状態が変わりました。送信せず停止しました。",
    "en": "The composer changed during final checks. Stopped without sending."
  },
  "m076": {
    "ja": "送信",
    "en": "Sending"
  },
  "m077": {
    "ja": "送信できません。対象サイトを前面にして内容を確認してください。",
    "en": "Cannot send. Focus the chat tab and review its contents."
  },
  "m078": {
    "ja": "確認済みの画像とプロンプトを1回だけ送信します。",
    "en": "Sending the verified image and prompt exactly once."
  },
  "m079": {
    "ja": "送信後に対象サイト以外へ移動しました。送信履歴を確認してください。",
    "en": "The tab left the target site after sending. Check the chat history."
  },
  "m080": {
    "ja": "今回の画像と本文が新しい会話メッセージに反映されたことを確認できませんでした。送信履歴を確認してください。",
    "en": "Could not verify this image and prompt in a new chat message. Check the chat history."
  },
  "m081": {
    "ja": "送信操作後の画面変化を確認しました。画像生成の結果は対象サイトで確認してください。",
    "en": "The sent message was reflected on the page. Check the image generation result on the site."
  },
  "m082": {
    "ja": "準備できました。画像・画像作成モード・プロンプトを確認してください。送信はしていません。",
    "en": "Ready. Review the image, image creation mode and prompt. Nothing has been sent."
  },
  "m083": {
    "ja": "送信操作は1回実行済みです。送信結果が不明でも自動再送はしません。履歴を確認してください。",
    "en": "Send was clicked once. It will not be repeated even if the result is unknown. Check the chat history."
  },
  "m084": {
    "ja": "添付操作済みです。画像が後から反映される場合もあります。添付・入力文を自分で確認してください。",
    "en": "Attachment was attempted and may appear later. Review the attachments and text yourself."
  },
  "m085": {
    "ja": "添付操作は実行していません。",
    "en": "No attachment operation was performed."
  },
  "m086": {
    "ja": "入力文が残っています。",
    "en": "Text remains in the composer. "
  },
  "m087": {
    "ja": "現在、入力文は検出されていません。",
    "en": "No composer text is currently detected. "
  },
  "m088": {
    "ja": "画像作成モードは選択済みです。",
    "en": "Image creation mode is selected."
  },
  "m089": {
    "ja": "モード選択を試みました。画面を確認してください。",
    "en": "Mode selection was attempted. Check the page."
  },
  "m090": {
    "ja": "{0}で停止：{1}\n{2}\n{3}{4}\n残った内容を削除・上書きしません。",
    "en": "Stopped at {0}: {1}\n{2}\n{3}{4}\nRemaining content will not be deleted or overwritten."
  },
  "m091": {
    "ja": "[CGCI] 停止段階:",
    "en": "[PromptPalette] Stopped at:"
  },
  "m092": {
    "ja": "プリセットは1〜20件で指定してください。",
    "en": "Provide between 1 and 20 presets."
  },
  "m093": {
    "ja": "プリセットの形式が不正です。本文は各20,000文字以内です。",
    "en": "Invalid preset format. Each prompt must be at most 20,000 characters."
  },
  "m094": {
    "ja": "既定のプリセットがありません。",
    "en": "The default preset does not exist."
  },
  "m095": {
    "ja": "標準",
    "en": "Default"
  },
  "m096": {
    "ja": "同期容量を超えます。同期をOFFにしてください。",
    "en": "Sync capacity exceeded. Turn off sync."
  },
  "m097": {
    "ja": "同期容量を超えます。プリセットを減らすか、同期をOFFにしてください。",
    "en": "Sync capacity exceeded. Reduce the presets or turn off sync."
  },
  "m098": {
    "ja": "同期データの形式が不正です。",
    "en": "Invalid sync data format."
  },
  "m099": {
    "ja": "同期データを受信中です。しばらくして再読み込みしてください。",
    "en": "Sync data is incomplete. Wait a moment and reload."
  },
  "m100": {
    "ja": "同期への保存が未完了です。このPCの設定を保持しています。設定画面で再保存または同期OFFを選んでください。",
    "en": "Sync saving is incomplete. This PC's settings are preserved. Save again or turn off sync in Settings."
  },
  "m101": {
    "ja": "同期設定がありません。このPCの保存済み設定を使用します。",
    "en": "No synced settings were found. Using this PC's saved settings."
  },
  "m102": {
    "ja": "同期を読み取れません。このPCの保存済み設定を使用します。設定画面で確認してください。",
    "en": "Could not read synced settings. Using this PC's saved settings. Check Settings."
  },
  "m103": {
    "ja": "PC設定が不正です。",
    "en": "Invalid device settings."
  },
  "m104": {
    "ja": "別の画面・PCで設定が更新されました。エクスポートで編集中の内容を保存し、再読み込みしてください。",
    "en": "Settings changed in another window or PC. Export your edits, then reload."
  },
  "m105": {
    "ja": "このPCには保存しましたが、同期への保存に失敗しました。容量・Chromeの同期設定を確認してください。同期ONへの切替は完了していません。",
    "en": "Saved on this PC, but sync saving failed. Check capacity and Chrome sync settings. Enabling sync has not completed."
  },
  "m106": {
    "ja": "（名前未入力）",
    "en": "(Unnamed)"
  },
  "m107": {
    "ja": "同期領域の設定を読み込みました。",
    "en": "Settings were loaded from Chrome sync storage."
  },
  "m108": {
    "ja": "同期OFF：このPCに保存します。",
    "en": "Sync is off: settings are saved on this PC."
  },
  "m109": {
    "ja": "プリセットは20件までです。",
    "en": "You can save up to 20 presets."
  },
  "m110": {
    "ja": "{0} 複製",
    "en": "{0} copy"
  },
  "m111": {
    "ja": "新しいプリセット",
    "en": "New preset"
  },
  "m112": {
    "ja": "このプリセットを編集画面から削除しますか？保存するまでは再読み込みで戻せます。",
    "en": "Remove this preset from the editor? You can reload to restore it before saving."
  },
  "m113": {
    "ja": "保存しました（Chrome同期領域への保存完了）。",
    "en": "Saved to Chrome sync storage."
  },
  "m114": {
    "ja": "このPCに保存しました。",
    "en": "Saved on this PC."
  },
  "m115": {
    "ja": "設定ファイルが大きすぎます。",
    "en": "The settings file is too large."
  },
  "m116": {
    "ja": "対応する設定ファイルではありません。",
    "en": "This settings file is not supported."
  },
  "m117": {
    "ja": "取り込みました。自動送信・同期はOFFです。保存で確定してください。",
    "en": "Imported into the editor. Auto-send and sync are off. Save to apply."
  },
  "m118": {
    "ja": "Chromeのアドレス欄に chrome://extensions/shortcuts を入力してください。",
    "en": "Enter chrome://extensions/shortcuts in Chrome's address bar."
  },
  "m119": {
    "ja": "診断情報をコピーしました。",
    "en": "Diagnostics copied."
  },
  "m120": {
    "ja": "診断欄を選択してCtrl+Cでコピーしてください。",
    "en": "Select the diagnostics text and press Ctrl+C to copy."
  },
  "m121": {
    "ja": "同期設定が更新されました。編集中の内容は保持しています。必要ならエクスポート後に再読み込みしてください。",
    "en": "Synced settings changed. Your edits are preserved. Export them before reloading if needed."
  },
  "m122": {
    "ja": "操作記録はありません。",
    "en": "No operation has been recorded."
  },
  "m123": {
    "ja": "設定を読み込めません。拡張機能のエラーを確認してください。",
    "en": "Could not load settings. Check extension errors."
  },
  "m124": {
    "ja": "入力欄が変わったか、既存の入力文があります。",
    "en": "The composer changed or already contains text."
  },
  "m125": {
    "ja": "入力操作が拒否されました。プロンプトを手動で貼り付けてください。",
    "en": "Text entry was rejected. Paste the prompt manually."
  },
  "m126": {
    "ja": "入力が拒否されました。画面で本文を確認してください。",
    "en": "Text entry was rejected. Check the composer."
  },
  "m127": {
    "ja": "本文一致={0}（入力{1}文字／設定{2}文字）、送信可能={3}、画像作成モード={4}、添付完了={5}",
    "en": "Prompt match={0} (entered: {1} characters; expected: {2}), send enabled={3}, image mode={4}, attachment ready={5}"
  },
  "m128": {
    "ja": "本文一致={0}、画像モード={1}、添付完了={2}",
    "en": "Prompt match={0}, image mode={1}, attachment ready={2}"
  },
  "m129": {
    "ja": "画像枚数={0}、画像読込={1}、処理中={2}、送信ボタン検出={3}、送信可能={4}",
    "en": "Image count={0}, image loaded={1}, uploading={2}, send button found={3}, send enabled={4}"
  },
  "m130": {
    "ja": "あり",
    "en": "yes"
  },
  "m131": {
    "ja": "なし",
    "en": "no"
  },
  "m132": {
    "ja": "ChatGPTまたはGeminiのチャットタブを前面にして実行してください。",
    "en": "Focus a ChatGPT or Gemini chat tab before running."
  },
  "m133": {
    "ja": "起動できません。対象サイトを再読み込みして実行してください。途中の下書きは先に確認してください。",
    "en": "Could not start. Review any remaining draft, then reload the chat page and run again."
  },
  "m134": {
    "ja": "PromptPalette",
    "en": "PromptPalette",
    "source": "画像プロンプトアシスト"
  },
  "m135": {
    "ja": "PromptPalette 設定",
    "en": "PromptPalette Settings",
    "source": "画像プロンプトアシスト 設定"
  },
  "m136": {
    "ja": "バージョン",
    "en": "Version"
  },
  "m137": {
    "ja": "編集するプリセット",
    "en": "Preset to edit"
  },
  "m138": {
    "ja": "追加",
    "en": "Add"
  },
  "m139": {
    "ja": "複製",
    "en": "Duplicate"
  },
  "m140": {
    "ja": "削除",
    "en": "Delete"
  },
  "m141": {
    "ja": "名前",
    "en": "Name"
  },
  "m142": {
    "ja": "ChatGPTとGeminiで同じ本文を使う",
    "en": "Use the same prompt for ChatGPT and Gemini"
  },
  "m143": {
    "ja": "ChatGPT用プロンプト（共通の場合は両サイトで使用）",
    "en": "ChatGPT prompt (used for both sites when shared)"
  },
  "m144": {
    "ja": "Gemini用プロンプト",
    "en": "Gemini prompt"
  },
  "m145": {
    "ja": "指定なしでは画面の比率を操作しません。既に指定が残っている場合は画面で確認してください。",
    "en": "Unspecified leaves the page's aspect ratio unchanged. Check the page if a ratio is already selected."
  },
  "m146": {
    "ja": "既定のプリセット",
    "en": "Default preset"
  },
  "m147": {
    "ja": "このPCの動作",
    "en": "Device settings"
  },
  "m148": {
    "ja": "アイコンの入力元",
    "en": "Input source for the toolbar icon"
  },
  "m149": {
    "ja": "クリップボード",
    "en": "Clipboard"
  },
  "m150": {
    "ja": "画像ファイル選択",
    "en": "Image file picker"
  },
  "m151": {
    "ja": "ChatGPT：入力後に自動送信する",
    "en": "ChatGPT: send automatically after preparation"
  },
  "m152": {
    "ja": "Gemini：入力後に自動送信する",
    "en": "Gemini: send automatically after preparation"
  },
  "m153": {
    "ja": "初期値OFF。OFFでは画像取得後にプリセット・比率を選び「準備する」を押します。ONでは既定プリセットで1回だけ送信します。ファイル入力は「画像ファイルを選ぶ」の操作が必要です。",
    "en": "Off by default. When off, choose a preset and ratio after getting the image, then click Prepare. When on, the default preset is sent once. File input requires selecting a file."
  },
  "m154": {
    "ja": "クリップボード添付に実際のCtrl+Vを使う",
    "en": "Use a real Ctrl+V paste for clipboard attachments"
  },
  "m155": {
    "ja": "複数PCの同期",
    "en": "Sync across PCs"
  },
  "m156": {
    "ja": "設定を複数PCで同期する",
    "en": "Sync settings across PCs"
  },
  "m157": {
    "ja": "初期値OFF。同じGoogleアカウント・同じ拡張機能ID・Chromeの同期有効が必要です。プリセットと既定選択をGoogleの同期サービスに保存します。画像・自動送信・入力元・診断は同期しません。",
    "en": "Off by default. Requires the same Google account and extension ID, with Chrome sync enabled. Presets and the default selection are stored in Google's sync service. Images, auto-send, input source and diagnostics are not synced."
  },
  "m158": {
    "ja": "同期をONにするとき",
    "en": "When enabling sync"
  },
  "m159": {
    "ja": "このPCのプリセットを同期先に保存",
    "en": "Upload this PC's presets to sync"
  },
  "m160": {
    "ja": "同期済みのプリセットを取り込む",
    "en": "Import presets from sync"
  },
  "m161": {
    "ja": "同期OFFにすると、このPCのプリセットを保持し、同期先は削除しません。画像・自動送信・入力元・表示言語・診断は同期しません。",
    "en": "Turning sync off keeps presets on this PC and does not delete synced data. Images, auto-send, input source, language and diagnostics are not synced."
  },
  "m162": {
    "ja": "すべて保存",
    "en": "Save all settings"
  },
  "m163": {
    "ja": "バックアップ・移行",
    "en": "Backup and migration"
  },
  "m164": {
    "ja": "設定をエクスポート",
    "en": "Export settings"
  },
  "m165": {
    "ja": "設定ファイルをインポート",
    "en": "Import settings file"
  },
  "m166": {
    "ja": "インポートは編集画面への取り込みです。「すべて保存」で確定します。自動送信はOFF、同期はOFFに戻します。書き出したファイルにはプロンプト本文が含まれます。",
    "en": "Import loads settings into the editor. Click Save all settings to apply. Auto-send and sync are turned off. Exported files contain your prompts."
  },
  "m167": {
    "ja": "ショートカット",
    "en": "Keyboard shortcuts"
  },
  "m168": {
    "ja": "ショートカット設定を開く",
    "en": "Open keyboard shortcut settings"
  },
  "m169": {
    "ja": "クリップボード実行：初期候補 Ctrl+Shift+Y。ファイル選択実行：初期値未割り当て。Chromeを前面にし対象のチャットを選択してください。2つのキーは独立して変更できます。",
    "en": "Clipboard: suggested shortcut Ctrl+Shift+Y. File picker: unassigned by default. Focus Chrome and select the chat tab. You can change each shortcut independently."
  },
  "m170": {
    "ja": "診断",
    "en": "Diagnostics"
  },
  "m171": {
    "ja": "診断情報をコピー",
    "en": "Copy diagnostics"
  },
  "m172": {
    "ja": "診断情報",
    "en": "Diagnostics"
  },
  "m173": {
    "ja": "診断にはバージョンと停止段階のみ含めます。画像・本文・チャットURLは含めません。クリップボード画像を上書きしたくない場合はコピーしないでください。",
    "en": "Diagnostics contain version and operation status, not images, prompts or chat URLs. Copying diagnostics replaces your clipboard contents."
  },
  "m174": {
    "ja": "画像は実行時のみ扱い保存しません。独自サーバーへの送信はありません。添付・送信先は現在のChatGPTまたはGeminiです。各サービスのアカウント・利用条件に従います。",
    "en": "Images are used only during a run and are not stored. No data is sent to our own servers. Attachments and prompts go to the current ChatGPT or Gemini chat, subject to that service's account and usage terms."
  },
  "m175": {
    "ja": "同期のON/OFFはこのPCに即時保存します。ONにするだけでは送信しません。Chrome起動時・設定表示時・実行前と、更新が届いたときに取り込みます。",
    "en": "The switch is saved immediately on this PC. Turning it on does not upload presets. Updates are imported at startup, when opening Settings, before running and when received."
  },
  "m176": {
    "ja": "同期済みのプリセットを取り込む",
    "en": "Import synced presets"
  },
  "m177": {
    "ja": "取り込みはChromeがこのPCに受信済みの内容を読みます。Googleからの取得を強制することはできません。未保存の編集は自動で置き換えません。",
    "en": "Import reads data already received by Chrome on this PC. It cannot force a download from Google. Unsaved edits are not replaced automatically."
  },
  "m178": {
    "ja": "補助操作（初回登録・再送・復元）",
    "en": "More actions (initial upload, retry, restore)"
  },
  "m179": {
    "ja": "このPCのプリセットを同期先へ保存",
    "en": "Upload presets from this PC"
  },
  "m180": {
    "ja": "直前のプリセットを復元",
    "en": "Restore previous presets"
  },
  "m181": {
    "ja": "初回登録・再送は同期先を置き換えます。復元は直前の1世代に戻し、このPCの同期をOFFにします。",
    "en": "Upload replaces synced presets. Restore returns to the previous saved copy and turns sync off on this PC."
  },
  "m182": {
    "ja": "同期への保存が未完了です。このPCの設定を保持しています。補助操作から再送できます。",
    "en": "Sync writing is incomplete. Settings on this PC are preserved. Retry from More actions."
  },
  "m183": {
    "ja": "同期データがまだ届いていません。初回登録は補助操作から行えます。",
    "en": "No synced data has arrived yet. Use More actions for the initial upload."
  },
  "m184": {
    "ja": "同期データを取り込めません。受信途中の場合は到着後に再確認します。このPCの設定を保持しています。",
    "en": "Cannot import synced data. If data is incomplete, it will be checked again on arrival. Settings on this PC are preserved."
  },
  "m185": {
    "ja": "同期データが更新されています。編集中の内容をエクスポートし、同期済みのプリセットを取り込んでから保存してください。",
    "en": "Synced data has changed. Export your edits, import synced presets, then save again."
  },
  "m186": {
    "ja": "このPCには保存しましたが、Chrome同期領域への書き込みに失敗しました。補助操作から再送してください。",
    "en": "Saved on this PC, but writing to Chrome sync storage failed. Retry from More actions."
  },
  "m187": {
    "ja": "復元できるプリセットはありません。",
    "en": "There are no presets to restore."
  },
  "m188": {
    "ja": "同期ON：保存したプリセットを共有し、届いた更新を自動で取り込みます。",
    "en": "Sync is on: saved preset changes are shared and received updates are imported automatically."
  },
  "m189": {
    "ja": "このPCに保存し、Chrome同期領域へ書き込みました。他PCへの到着はChromeが処理します。",
    "en": "Saved on this PC and written to Chrome sync storage. Chrome handles delivery to other PCs."
  },
  "m190": {
    "ja": "同期をONにして取り込むと、未保存のプリセットとPC設定の編集を破棄します。続けますか？",
    "en": "Enabling sync and importing discards unsaved preset and PC setting edits. Continue?"
  },
  "m191": {
    "ja": "このPCの同期をONにしました。ONにするだけではプリセットを送信しません。",
    "en": "Sync is on for this PC. Enabling it alone does not upload presets."
  },
  "m192": {
    "ja": "このPCの同期をOFFにしました。",
    "en": "Sync is off for this PC."
  },
  "m193": {
    "ja": "未保存の編集または未送信の変更を破棄し、同期済みのプリセットに置き換えますか？",
    "en": "Discard unsaved edits or pending changes and replace them with synced presets?"
  },
  "m194": {
    "ja": "同期済みのプリセットを取り込みました。",
    "en": "Imported synced presets."
  },
  "m195": {
    "ja": "取り込める更新はありません。",
    "en": "There are no updates to import."
  },
  "m196": {
    "ja": "同期をONにし、この画面のプリセットを保存して同期先を置き換えます。初回登録・再送に使用してください。続けますか？",
    "en": "Turn on sync, save the presets in this editor and replace synced presets? Use for initial upload or retry. Continue?"
  },
  "m197": {
    "ja": "直前の保存・取り込み前のプリセットに戻し、このPCの同期をOFFにします。未保存の編集は破棄します。続けますか？",
    "en": "Restore presets from before the last save or import and turn sync off on this PC? Unsaved edits will be discarded. Continue?"
  },
  "m198": {
    "ja": "直前のプリセットを復元しました。同期はOFFです。",
    "en": "Restored previous presets. Sync is off."
  },
  "m199": {
    "ja": "同期データが更新されています。編集中の内容は保持しています。取り込みボタンで反映できます。",
    "en": "Synced data has changed. Your edits are preserved. Use the import button to apply the update."
  }
};
