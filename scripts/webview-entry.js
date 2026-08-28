// webview-entry.js — نقطهٔ ورود باندل ویرایشگر وب‌‌ویو
// این فایل توسط scripts/build-webview.cjs با esbuild باندل می‌شود و خروجی
// آن (dist/webview-bundle.js) به‌صورت یک تگ <script> در HTML قرارداده می‌شود.
// همهٔ وابستگی‌ها (CodeMirror، گرامر کلنگ، مفسر WASM) به‌صورت محلی باندل
// می‌شوند — هیچ درخواست CDN وجود ندارد.

// اجرای زمان‌اجرای Go (کلاس Go را روی globalThis تعریف می‌کند)
import './wasm-runtime.js'

// باینری WASM به‌صورت رشتهٔ base64 در زمان باندل درون فایل قرار می‌گیرد
import wasmBase64 from 'kolang-wasm-base64'

// CodeMirror 6
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting, bracketMatching, foldGutter, codeFolding } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'

// گرامر کلنگ
import { kolang } from '@kolang/grammar/codemirror/kolang-syntax.js'

// ─── مفسر WASM ────────────────────────────────────────────────────────────

let wasmLoaded = false
let wasmLoadPromise = null

async function loadWasm() {
  if (wasmLoaded) return
  if (wasmLoadPromise) return wasmLoadPromise

  wasmLoadPromise = (async () => {
    if (typeof globalThis.Go !== 'function') {
      throw new Error('wasm_exec.js بارگذاری نشد')
    }
    const go = new globalThis.Go()
    // decode base64 → Uint8Array
    const binary = atob(wasmBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject)
    // go.run مفسر را اجرا می‌کند؛ برنامه روی select{} منتظر می‌ماند
    go.run(instance)
    wasmLoaded = true
  })()

  return wasmLoadPromise
}

function runKolang(code) {
  if (typeof globalThis.runKolang === 'function') {
    return globalThis.runKolang(code)
  }
  return Promise.reject(new Error('WASM بارگذاری نشده — ابتدا loadWasm() را صدا بزنید'))
}

// ─── پل پیام به React Native ──────────────────────────────────────────────

const post = (payload) => {
  const data = JSON.stringify(payload)
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(data)
  }
}

// ─── پوستهٔ تیرهٔ CodeMirror (Catppuccin Mocha) ──────────────────────────────

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#1e1e2e', color: '#cdd6f4', direction: 'rtl' },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#45475a #181825',
    direction: 'rtl',
  },
  '.cm-scroller::-webkit-scrollbar': { width: '8px' },
  '.cm-scroller::-webkit-scrollbar-track': { background: '#181825' },
  '.cm-scroller::-webkit-scrollbar-thumb': { background: '#45475a', borderRadius: '4px' },
  '.cm-content': { caretColor: '#f5e0dc', direction: 'rtl', textAlign: 'right', fontFamily: "'Vazirmatn','Iranian Sans','Sahel',monospace" },
  '.cm-line': { direction: 'rtl', textAlign: 'right' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#585b7040' },
  '.cm-cursor': { borderLeftColor: '#f5e0dc' },
  '.cm-activeLine': { backgroundColor: '#31324440' },
  '.cm-activeLineGutter': { backgroundColor: '#313244', color: '#cdd6f4' },
  '.cm-gutters': { backgroundColor: '#181825', color: '#585b70', border: 'none', direction: 'rtl' },
  '.cm-matchingBracket': { backgroundColor: '#585b7040', outline: '1px solid #89b4fa80' },
}, { dark: true })

const kolangHighlight = HighlightStyle.define([
  { tag: tags.comment, color: '#7f849c', fontStyle: 'italic' },
  { tag: tags.string, color: '#a6e3a1' },
  { tag: tags.number, color: '#fab387' },
  { tag: tags.bool, color: '#fab387', fontWeight: 'bold' },
  { tag: tags.null, color: '#fab387' },
  { tag: tags.controlKeyword, color: '#cba6f7', fontWeight: 'bold' },
  { tag: tags.definitionKeyword, color: '#f9e2af', fontWeight: 'bold' },
  { tag: tags.keyword, color: '#89dceb', fontStyle: 'italic' },
  { tag: tags.operatorKeyword, color: '#f38ba8' },
  { tag: tags.operator, color: '#89b4fa' },
  { tag: tags.standard(tags.function(tags.variableName)), color: '#a6e3a1' },
  { tag: tags.function(tags.variableName), color: '#89b4fa' },
  { tag: tags.typeName, color: '#94e2d5', fontStyle: 'italic' },
  { tag: tags.className, color: '#f38ba8', textDecoration: 'underline' },
  { tag: tags.namespace, color: '#74c7ec', fontStyle: 'italic' },
  { tag: tags.self, color: '#f38ba8', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#cdd6f4' },
  { tag: tags.punctuation, color: '#9399b2' },
  { tag: tags.meta, color: '#f5c2e7' },
])

// ─── مثال‌ها ──────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: 'سلام دنیا',
    code: '«سلام دنیا!» بنویس',
  },
  {
    label: 'محاسبه',
    code: 'نتیجه = ۵ + ۳\n«نتیجه» بنویس',
  },
  {
    label: 'حلقه',
    code: 'برای ای از ۰ تا ۵:\n    «ای» بنویس',
  },
  {
    label: 'شرط',
    code: 'سن = ۲۰\nاگر سن >= ۱۸ باشد:\n    «بزرگسال» بنویس\nوگرنه:\n    «کودک» بنویس',
  },
  {
    label: 'تابع',
    code: 'تعریف سلام(نام):\n    «سلام » + نام بنویس\n\nسلام(«رامین»)',
  },
  {
    label: 'فیبوناچی',
    code: 'تعریف فیبوناچی(ن):\n    اگر ن <= ۱ باشد:\n        ن برگردان\n    فیبوناچی(ن - ۱) + فیبوناچی(ن - ۲) برگردان\n\nبرای ای از ۰ تا ۱۰:\n    فیبوناچی(ای) بنویس',
  },
]

// ─── اجرای کد ─────────────────────────────────────────────────────────────

let editor = null

async function runKolangNow(code) {
  const src = typeof code === 'string' ? code : (editor ? editor.state.doc.toString() : '')
  const outputEl = document.getElementById('output')
  if (outputEl) {
    outputEl.textContent = 'در حال اجرا…'
    outputEl.className = 'running'
  }
  post({ type: 'running' })
  try {
    await loadWasm()
    const { ok, output, error } = await runKolang(src)
    const text = error ? error : (output || '(خروجی خالی)')
    if (outputEl) {
      outputEl.textContent = text
      outputEl.className = error ? 'error' : ''
    }
    post({ type: 'output', ok, output: output || '', error: error || '' })
  } catch (err) {
    const message = String((err && err.message) || err)
    if (outputEl) {
      outputEl.textContent = message
      outputEl.className = 'error'
    }
    post({ type: 'output', ok: false, output: '', error: message })
  }
}

// پل اجرا — React Native از طریق injectJavaScript این را صدا می‌زند
window.runKolang = runKolangNow

// پل بارگذاری مثال — React Native از طریق injectJavaScript این را صدا می‌زند
window.loadExample = function (code) {
  if (editor && typeof code === 'string') {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: code },
    })
    post({ type: 'code', text: code })
  }
}

// ─── راه‌اندازی ویرایشگر ───────────────────────────────────────────────────

async function boot() {
  // ابتدا ویرایشگر را بساز
  const editorEl = document.getElementById('editor')
  if (!editorEl) return

  editor = new EditorView({
    parent: editorEl,
    state: EditorState.create({
      doc: '«سلام دنیا!» بنویس',
      extensions: [
        lineNumbers(),
        foldGutter(),
        codeFolding(),
        history(),
        bracketMatching(),
        autocompletion(),
        kolang(),
        editorTheme,
        syntaxHighlighting(kolangHighlight),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          indentWithTab,
          { key: 'Mod-Enter', run: () => { runKolangNow(); return true } },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            post({ type: 'code', text: update.state.doc.toString() })
          }
        }),
      ],
    }),
  })

  post({ type: 'code', text: editor.state.doc.toString() })

  // حالا WASM را در پس‌زمینه بارگذاری کن
  try {
    await loadWasm()
    post({ type: 'status', status: 'ready' })
  } catch (err) {
    post({ type: 'status', status: 'error', detail: String((err && err.message) || err) })
  }

  // سیم‌کشی دکمه‌ها
  const runBtn = document.getElementById('run-btn')
  if (runBtn) runBtn.addEventListener('click', () => runKolangNow())

  // ─── باز کردن و ذخیره فایل ───────────────────────────────────────────────
  // از API مرورگر (FileReader و Blob download) استفاده می‌شود که هم در
  // WebView ری‌اکت‌نیتیو و هم در مرورگر معمولی (GitHub Pages) کار می‌کند.

  let currentFilename = 'untitled.kolang'

  // باز کردن فایل: دکمهٔ 📂 ورودی مخفی file-input را فعال می‌کند
  const openBtn = document.getElementById('open-btn')
  const fileInput = document.getElementById('file-input')
  if (openBtn && fileInput) {
    openBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      try {
        const content = await file.text()
        if (editor) {
          editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content },
          })
        }
        currentFilename = file.name || 'untitled.kolang'
        post({ type: 'file', action: 'open', filename: currentFilename })
      } catch (err) {
        post({ type: 'error', detail: String((err && err.message) || err) })
      }
      // ریست مقدار ورودی تا انتخاب همان فایل دوباره trigger شود
      fileInput.value = ''
    })
  }

  // ذخیره فایل: دکمهٔ 💾 یک Blob با محتوای ویرایشگر می‌سازد و آن را دانلود می‌کند
  const saveBtn = document.getElementById('save-btn')
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!editor) return
      const content = editor.state.doc.toString()
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = currentFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // آزاد کردن URL پس از مدت کوتاه
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      post({ type: 'file', action: 'save', filename: currentFilename })
    })
  }

  // ─── نوار کناری مثال‌ها ─────────────────────────────────────────────────
  // نوار کناری روی تبلت (min-width:768px) به‌صورت پیش‌فرض پین‌شده باز می‌شود.
  // روی گوشی به‌صورت پیش‌فرض بسته است و با ☰ به‌صورت overlay باز می‌شود.

  const sidebarEl = document.getElementById('sidebar')
  const overlayEl = document.getElementById('sidebar-overlay')
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn')
  const sidebarCloseBtn = document.getElementById('sidebar-close')
  const examplesListEl = document.getElementById('examples-list')

  let sidebarOpen = false
  let sidebarPinned = false
  let activeExampleIndex = -1

  function isTablet() {
    return window.matchMedia('(min-width: 768px)').matches
  }

  function applySidebarState() {
    if (!sidebarEl || !overlayEl) return
    const showSidebar = sidebarOpen || sidebarPinned
    sidebarEl.classList.toggle('open', showSidebar)
    sidebarEl.classList.toggle('pinned', sidebarPinned)
    overlayEl.classList.toggle('visible', sidebarOpen && !sidebarPinned)
    document.body.classList.toggle('sidebar-pinned', sidebarPinned)
    document.body.classList.toggle('sidebar-open', sidebarOpen && !sidebarPinned)
  }

  function openSidebar() {
    sidebarOpen = true
    applySidebarState()
  }

  function closeSidebar() {
    if (sidebarPinned) {
      sidebarPinned = false
      sidebarOpen = false
    } else {
      sidebarOpen = false
    }
    applySidebarState()
  }

  function toggleSidebar() {
    if (sidebarOpen || sidebarPinned) {
      closeSidebar()
    } else {
      openSidebar()
    }
  }

  function handleToggleClick() {
    if (isTablet()) {
      if (sidebarPinned) {
        sidebarPinned = false
        sidebarOpen = false
      } else {
        sidebarPinned = true
        sidebarOpen = false
      }
      applySidebarState()
    } else {
      toggleSidebar()
    }
  }

  if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', handleToggleClick)
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar)
  if (overlayEl) overlayEl.addEventListener('click', closeSidebar)

  // ─── حالت اولیه بر اساس عرض صفحه ───────────────────────────────────────
  // روی تبلت (≥۷۶۸px) نوار کناری به‌صورت پیش‌فرض پین‌شده باز می‌شود.
  // این باید پس از بارگذاری اولیه DOM انجام شود تا کلاس‌های CSS اعمال شوند.
  if (isTablet()) {
    sidebarPinned = true
  }
  applySidebarState()

  // ساخت ردیف‌های مثال داخل نوار کناری
  if (examplesListEl) {
    EXAMPLES.forEach((ex, index) => {
      const item = document.createElement('div')
      item.className = 'example-item'
      item.textContent = ex.label
      item.dataset.index = String(index)
      item.addEventListener('click', () => {
        // بارگذاری مثال و بستن نوار (روی گوشی). روی تبلتِ پین‌شده نوار باز می‌ماند.
        window.loadExample(ex.code)
        activeExampleIndex = index
        // برجسته‌سازی ردیف فعال
        examplesListEl.querySelectorAll('.example-item').forEach((el) => el.classList.remove('active'))
        item.classList.add('active')
        if (!sidebarPinned) closeSidebar()
      })
      examplesListEl.appendChild(item)
    })
  }

  // جمع‌شدنی: خروجی
  const outputHeader = document.getElementById('output-header')
  const outputPanel = document.getElementById('output-panel')
  if (outputHeader && outputPanel) {
    outputHeader.addEventListener('click', () => {
      outputPanel.classList.toggle('collapsed')
    })
  }

  // جمع‌شدنی: آموزش (داخل نوار کناری)
  const tutorialHeader = document.getElementById('tutorial-header')
  const tutorialBody = document.getElementById('tutorial-body')
  if (tutorialHeader && tutorialBody) {
    tutorialHeader.addEventListener('click', () => {
      tutorialBody.classList.toggle('open')
    })
  }

  // واکنش به تغییر اندازهٔ پنجره (چرخش گوشی/تبلت):
  // - تبلت ← گوشی: پین برداشته شود، نوار بسته شود
  // - گوشی ← تبلت: نوار به‌صورت پین‌شده باز شود
  window.addEventListener('resize', () => {
    if (isTablet()) {
      if (!sidebarPinned && !sidebarOpen) {
        sidebarPinned = true
        applySidebarState()
      }
    } else {
      if (sidebarPinned) {
        sidebarPinned = false
        sidebarOpen = false
        applySidebarState()
      }
    }
  })
}

boot()
