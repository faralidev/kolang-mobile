# ویرایشگر کلنگ

ویرایشگر زبان کلنگ — یک کدبیس React Native برای وب (PWA)، مک، ویندوز، iOS و اندروید.
CodeMirror در WebView روی پلتفرم‌های نیتیو و مستقیماً روی وب رندر می‌شود.

## چیست؟

- **یک کدبیس، پنج هدف:** iOS، اندروید، مک، ویندوز و وب (PWA — قابل نصب روی لپ‌تاپ).
- **CodeMirror در WebView:** روی پلتفرم‌های نیتیو، ویرایشگر DOM داخل WebView رندر
  می‌شود. روی وب هم برای سادگی همین مسیر (iframe) استفاده شده است.
- **مفسر WASM داخل WebView:** `@kolang/interpreter` (کامپایل‌شده به WebAssembly)
  در موتور مرورگر WebView اجرا می‌شود — این مشکل «نبود WASM در Hermes» را حل
  می‌کند. روی وب، WASM مستقیم در مرورگر اجرا می‌شود.
- **دکمهٔ اجرا روی همهٔ پلتفرم‌ها فعال است:** چون WASM در WebView کار می‌کند.

## نصب و توسعه

```
npm install
npm run web      # وب (PWA)
npm run ios
npm run android
npm run macos
npm run windows
```

> **توجه:** `npm install` نیازمند انتشار `@kolang/interpreter` و `@kolang/grammar`
> روی npm است (نسخهٔ `^0.0.1`). تا وقتی منتشر نشده‌اند، این دو وابستگی در دسترس
> نیستند.

## معماری

- **WebView میزبان CodeMirror + WASM است:** سند HTML توسط تابع
  `buildEditorHTML()` در `App.js` ساخته می‌شود و شامل CodeMirror 6 (از CDN)،
  گرامر کلنگ و مفسر WASM است.
- **پل اجرا:** React Native با `injectJavaScript` تابع `window.runKolang(code)` را
  در WebView صدا می‌زند؛ WebView نتیجه را با `ReactNativeWebView.postMessage`
  برمی‌گرداند و `onMessage` خروجی را در وضعیت اپلیکیشن می‌نشاند.
- **RTL + پوستهٔ تیرهٔ Catppuccin Mocha** در هر دو سمت (وب و نیتیو).

## پلتفرم‌ها

| پلتفرم | نحوهٔ رندر |
| --- | --- |
| iOS / اندروید | WebView (react-native-webview) |
| مک / ویندوز | WebView (react-native-macos / react-native-windows) |
| وب (PWA) | react-native-web — فعلاً از طریق iframe همان WebView |

## وابستگی‌ها

- `@kolang/interpreter` — مفسر WASM کلنگ
- `@kolang/grammar` — گرامر برجسته‌سازی نحو کلنگ (خروجی CodeMirror)
- `react-native-webview` — میزبان CodeMirror و WASM روی پلتفرم‌های نیتیو

## TODO

- باندل کردن محلی CodeMirror + گرامر + WASM (به‌جای CDN) برای پشتیبانی آفلاین.
- آیکون‌های PWA (فعلاً `icons` در `web/manifest.json` خالی است).
- بهینه‌سازی وب: رندر مستقیم CodeMirror روی DOM (بدون iframe).

---

## English

Kolang editor — a single React Native codebase targeting web (installable PWA),
macOS, Windows, iOS and Android. CodeMirror runs inside a WebView on native and
directly on web. The WASM interpreter (`@kolang/interpreter`) runs inside the
WebView's browser engine on native, so the Run button works on every platform.

Requires `@kolang/interpreter` and `@kolang/grammar` to be published on npm
before `npm install`.

Version 0.0.1 — MIT License.