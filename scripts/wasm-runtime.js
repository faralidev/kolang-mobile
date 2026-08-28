// wasm-runtime.js — بارگذاری wasm_exec.js به‌صورت یک فایل ساده (بدون import/export)
// این فایل توسط esbuild به‌صورت باندل درون webview-entry.js قرار می‌گیرد و
// کلاس Go را روی globalThis تعریف می‌کند.

// wasm_exec.js یک IIFE است که globalThis.Go را تعریف می‌کند؛ فقط آن را import
// می‌کنیم تا اثر جانبی‌اش اجرا شود.
import './wasm_exec.js'
