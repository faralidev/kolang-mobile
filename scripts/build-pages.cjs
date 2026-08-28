// build-pages.cjs — تولید dist/index.html برای GitHub Pages
// باندل JS را می‌خواند، با تابع buildEditorHTML (از editor-html.cjs) HTML
// نهایی را می‌سازد و در dist/index.html می‌نویسد. هم در CI و هم محلی کار می‌کند.

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const { buildEditorHTML } = require('./editor-html.cjs')

// خواندن باندل JS
const bundlePath = path.join(ROOT, 'dist', 'webview-bundle.js')
if (!fs.existsSync(bundlePath)) {
  console.error('خطا: dist/webview-bundle.js وجود ندارد. ابتدا npm run build:webview را اجرا کنید.')
  process.exit(1)
}

const bundle = fs.readFileSync(bundlePath, 'utf8')
const html = buildEditorHTML(bundle)

const outPath = path.join(ROOT, 'dist', 'index.html')
fs.writeFileSync(outPath, html)

const sizeMB = (html.length / 1024 / 1024).toFixed(1)
console.log('dist/index.html built (' + sizeMB + ' MB)')

// همچنین نسخهٔ نمایشی در /tmp برای تست در مرورگر
const demoPath = '/tmp/kolang-mobile-demo.html'
try {
  fs.writeFileSync(demoPath, html)
  console.log('/tmp/kolang-mobile-demo.html regenerated')
} catch (e) {
  // در محیطی که /tmp موجود نیست، نادیده بگیر
}
