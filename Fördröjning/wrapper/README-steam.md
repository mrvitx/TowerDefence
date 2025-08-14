# Kaffekatten TD — Windows Wrapper (Steam-ready)

This project wraps your existing HTML/JS game in a native WinForms WebView2 app so you can ship a .exe on Steam without rewriting the game.

## Prereqs
- Windows 10/11
- .NET SDK 8.0+
- WebView2 Runtime (most Steam players will have Edge/Runtime; you can bundle Evergreen Standalone if needed)

## Build
1. Open the `wrapper/` folder in VS Code or Visual Studio.
2. Restore and build Release x64.

The project copies your game files into `bin/Release/net8.0-windows/Content/` and launches `SPEL.HTML` (fallbacks to `START.html`).

## Steam packaging (summary)
- App type: Windows Only.
- Upload folder contents of `wrapper/bin/Release/net8.0-windows/`.
- Set executable: `KaffekattenTD.Wrapper.exe`.
- (Optional) bundle WebView2 Evergreen Standalone in a subfolder and install via a first-run step if runtime is missing.

## LocalStorage, file:// and modules
Your game already supports file:// and localStorage. WebView2 also allows file urls and local storage; no special flags needed.

## Notes
- If you load external URLs, add network permissions accordingly.
- To set a window icon, place an `.ico` and set `<ApplicationIcon>` in the csproj.
