# PromptPalette

English | [日本語](README.md)

PromptPalette is a Google Chrome extension that prepares image generation in ChatGPT and Gemini in one step. It attaches an image from the clipboard or an image file you choose to the open chat, selects the image creation mode, and enters a saved prompt (a preset). You send it yourself, or turn on auto-send in the settings. The UI is available in English and Japanese.

This repository contains the source code of the publicly released PromptPalette.

## Features

- Attaches an image from the clipboard or an image file you choose (PNG, JPEG or WebP; one image up to 20 MiB) to a ChatGPT or Gemini chat
- Selects the image creation mode and enters the text of a preset. In Gemini, it can also select the aspect ratio (1:1, 9:16, 3:4, 4:3 or 16:9; none by default)
- Up to 20 presets. The text can be shared by both sites or saved separately for each site
- With auto-send off (the default), you choose a preset and ratio when you run it, check the result and send it yourself. With auto-send on, it sends once using the default preset
- Runs from the extension icon or keyboard shortcuts (Ctrl+Shift+Y by default for a clipboard image; none for an image file)
- Exports and imports the settings (JSON), and can optionally share presets between PCs through Chrome sync (off by default)
- Display language: Auto, English or Japanese

It checks for an existing draft, attachments or a response being generated, and stops when the page is not in the expected state. It never retries attaching or sending automatically after a failure. It uses only the `activeTab`, `scripting`, `clipboardRead` and `storage` permissions, and accesses only the tab where you run it from the icon or a shortcut. Images are handled only inside the page and are neither stored nor sent anywhere other than the site you attach them to.

## Supported browser and environment

- Google Chrome 120 or later (the latest stable version is recommended). Tested on Windows 11.
- You need to be signed in to ChatGPT (https://chatgpt.com/) or Gemini (https://gemini.google.com/) in Chrome.
- No build, API key or server of its own is needed.

## Installation

The official distribution channel is the Chrome Web Store. Please get PromptPalette there (free).

- Chrome Web Store: https://chromewebstore.google.com/detail/promptpalette/fefcnpbglobpebdlognmaeddddpnnpjh

This GitHub repository does not distribute packaged extensions (ZIP or CRX).

## Basic usage

1. Right-click the extension icon, open Options, create presets and click Save all settings.
2. Open a ChatGPT or Gemini chat.
3. Copy an image to the clipboard and run PromptPalette from the icon or the shortcut. To use an image file, assign its shortcut at chrome://extensions/shortcuts or change the icon's input source in the settings.
4. With auto-send off, choose a preset (and a ratio in Gemini) in the panel that appears, click Prepare, check the attachment, mode and text, and send.

See the user guide for details.

- User guide: https://www.iwanaga.net/promptpalette/en/manual/

## Loading from source and testing

### Requirements

- Google Chrome 120 or later
- [Node.js](https://nodejs.org/), only to run the tests (21 or later, because the test command uses a glob; verified: 24.19.0). No npm packages are used.

### Loading into Chrome

No build is needed. Turn on Developer mode at chrome://extensions, click Load unpacked and select the folder of this repository (the folder that contains `manifest.json`).

The `key` in `manifest.json` is the public key of the Chrome Web Store version, so the loaded extension has the same ID as the Store version. If the Store version is installed in your Chrome, disable it first or load the source in a different Chrome profile. Settings may not carry over from the Store version, so export them first if needed.

### Tests

Run from the repository root. The tests simulate the Chrome APIs and the page DOM, and do not connect to Chrome, ChatGPT or Gemini.

```powershell
node --test "tests/*.test.cjs"
```

### Layout

| Path | Contents |
|---|---|
| `manifest.json` | Manifest V3 definition (permissions, shortcuts, options page) |
| `background.js` | Service worker: starting a run, injecting scripts, validating messages, saving settings and Chrome sync |
| `content.js` | In-page logic: getting the image, attaching it, selecting the mode and ratio, entering text, sending, and the progress panel |
| `adapter.js` / `gemini-adapter.js` | Detecting and operating the page elements of ChatGPT and Gemini |
| `settings.js` | Settings format, validation and migration |
| `options.html` / `options.css` / `options.js` | Settings page |
| `i18n.js` / `locale-data.js` / `_locales/` | Display languages (English and Japanese) |
| `icons/` | Icons |
| `tests/` | Node.js tests (`node:test`) |

The materials for submitting to the Chrome Web Store and the script that creates the ZIP are not included in this repository.

Source comments are written in Japanese. Detection of the page elements of ChatGPT and Gemini follows each site's pages as they were when checked, and may stop working when the sites change.

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 ja1bus (© ja1bus)

For external services and other notes, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## No warranty

This software is provided "as is", without warranty of any kind, express or implied. In no event shall the author be liable for any damages arising from the use of this software (see [LICENSE](LICENSE) for details).

## Links

- Web page: https://www.iwanaga.net/promptpalette/en/
- User guide: https://www.iwanaga.net/promptpalette/en/manual/
- Changelog: https://www.iwanaga.net/promptpalette/en/changelog/
- Privacy policy: https://www.iwanaga.net/promptpalette/en/privacy/
- Chrome Web Store: https://chromewebstore.google.com/detail/promptpalette/fefcnpbglobpebdlognmaeddddpnnpjh
- Contact: support@iwanaga.net
