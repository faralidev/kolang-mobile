// build-webview.cjs — باندلر esbuild برای ویرایشگر وب‌‌ویو موبایل
// فایل scripts/webview-entry.js (+ CodeMirror + گرامر کلنگ + مفسر WASM) را
// در یک فایل واحد dist/webview-bundle.js باندل می‌کند. WASM به‌صورت base64
// درون باندل قرار می‌گیرد تا هیچ درخواست CDN یا فایل خارجی لازم نباشد.
'use strict'

const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const NM = (p) => path.resolve(ROOT, 'node_modules', p)

// پلاگین esbuild: فایل kolang.wasm را به‌صورت رشتهٔ base64 درون باندل قرار
// می‌دهد. نام مجازی «kolang-wasm-base64» برای import استفاده می‌شود.
const wasmBase64Plugin = {
  name: 'wasm-base64',
  setup(build) {
    build.onResolve({ filter: /^kolang-wasm-base64$/ }, () => ({
      path: 'kolang-wasm-base64',
      namespace: 'wasm-base64-ns',
    }))
    build.onLoad({ filter: /.*/, namespace: 'wasm-base64-ns' }, () => {
      const wasmPath = NM('@kolang/interpreter/kolang.wasm')
      const bytes = fs.readFileSync(wasmPath)
      const base64 = bytes.toString('base64')
      return {
        contents: 'export default "' + base64 + '"',
        loader: 'js',
      }
    })
  },
}

// پلاگین: wasm_exec.js را از بستهٔ @kolang/interpreter بارگذاری کن. این فایل
// یک IIFE ساده است (بدون export) و فقط globalThis.Go را تعریف می‌کند.
const wasmExecResolverPlugin = {
  name: 'wasm-exec-resolver',
  setup(build) {
    build.onResolve({ filter: /^\.\/wasm_exec\.js$/ }, (args) => {
      // فقط در wasm-runtime.js این import اتفاق می‌افتد
      if (args.importer.includes('wasm-runtime')) {
        return {
          path: NM('@kolang/interpreter/wasm_exec.js'),
        }
      }
      return null
    })
  },
}

esbuild
  .build({
    entryPoints: [path.resolve(__dirname, 'webview-entry.js')],
    bundle: true,
    outfile: path.join(ROOT, 'dist', 'webview-bundle.js'),
    platform: 'browser',
    format: 'iife',
    target: ['chrome110', 'safari16'],
    sourcemap: false,
    minify: true,
    loader: { '.js': 'js' },
    alias: {
      '@codemirror/view': NM('@codemirror/view/dist/index.js'),
      '@codemirror/state': NM('@codemirror/state/dist/index.js'),
      '@codemirror/commands': NM('@codemirror/commands/dist/index.js'),
      '@codemirror/language': NM('@codemirror/language/dist/index.js'),
      '@codemirror/search': NM('@codemirror/search/dist/index.js'),
      '@codemirror/autocomplete': NM('@codemirror/autocomplete/dist/index.js'),
      '@lezer/highlight': NM('@lezer/highlight/dist/index.js'),
    },
    plugins: [wasmBase64Plugin, wasmExecResolverPlugin],
    logLevel: 'info',
  })
  .then(() => {
    const stat = fs.statSync(path.join(ROOT, 'dist', 'webview-bundle.js'))
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1)
    console.log('dist/webview-bundle.js built (' + sizeMB + ' MB)')

    // همچنین یک فایل CommonJS بساز که باندل را به‌صورت رشته export می‌کند.
    // این فایل توسط App.js با require() import می‌شود و در محیط React Native
    // (metro bundler) کار می‌کند — require('fs') در RN موجود نیست.
    const bundle = fs.readFileSync(path.join(ROOT, 'dist', 'webview-bundle.js'), 'utf8')
    const stringModule = 'module.exports = ' + JSON.stringify(bundle) + ';\n'
    fs.writeFileSync(path.join(ROOT, 'dist', 'webview-bundle-string.js'), stringModule)
    console.log('dist/webview-bundle-string.js built (string export for RN)')
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
