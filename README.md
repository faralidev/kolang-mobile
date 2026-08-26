# ویرایشگر کلنگ

ویرایشگر زبان کلنگ — یک کدبیس React Native برای iOS و اندروید.
CodeMirror داخل WebView رندر می‌شود و مفسر WASM هم در همان WebView اجرا می‌شود.

## چیست؟

- **یک کدبیس، دو هدف:** iOS و اندروید.
- **CodeMirror در WebView:** ویرایشگر DOM داخل WebView رندر می‌شود.
- **مفسر WASM داخل WebView:** `@kolang/interpreter` (کامپایل‌شده به WebAssembly)
  در موتور مرورگر WebView اجرا می‌شود — این مشکل «نبود WASM در Hermes» را حل
  می‌کند.
- **دکمهٔ اجرا فعال است:** چون WASM در WebView کار می‌کند.

## نصب و توسعه

```
npm install
npm run ios
npm run android
npm run start
```

> **توجه:** `npm install` نیازمند انتشار `@kolang/interpreter` و `@kolang/grammar`
> روی npm است (نسخهٔ `^0.0.1`). تا وقتی منتشر نشده‌اند، این دو وابستگی در دسترس
> نیستند.

## معماری

- **WebView میزبان CodeMirror + WASM است:** سند HTML توسط تابع
  `buildEditorHTML()` در `App.js` ساخته می‌شود و شامل CodeMirror 6، گرامر کلنگ
  و مفسر WASM است.
- **پل اجرا:** React Native با `injectJavaScript` تابع `window.runKolang(code)` را
  در WebView صدا می‌زند؛ WebView نتیجه را با `ReactNativeWebView.postMessage`
  برمی‌گرداند و `onMessage` خروجی را در وضعیت اپلیکیشن می‌نشاند.
- **RTL + پوستهٔ تیرهٔ Catppuccin Mocha** در سمت نیتیو.

## پلتفرم‌ها

| پلتفرم | نحوهٔ رندر |
| --- | --- |
| iOS / اندروید | WebView (react-native-webview) |

## وابستگی‌ها

- `@kolang/interpreter` — مفسر WASM کلنگ
- `@kolang/grammar` — گرامر برجسته‌سازی نحو کلنگ (خروجی CodeMirror)
- `react-native-webview` — میزبان CodeMirror و WASM روی iOS و اندروید

## TODO

- باندل کردن محلی CodeMirror + گرامر + WASM (به‌جای CDN) برای پشتیبانی آفلاین.

---

## English

Kolang editor — a single React Native codebase targeting iOS and Android.
CodeMirror runs inside a WebView and the WASM interpreter (`@kolang/interpreter`)
runs in the same WebView's browser engine, so the Run button works without
native Hermes WASM support.

Requires `@kolang/interpreter` and `@kolang/grammar` to be published on npm
before `npm install`.

Version 0.0.1 — MIT License.