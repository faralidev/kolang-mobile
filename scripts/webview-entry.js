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

// ─── بخش‌های راهنمای تعاملی ───────────────────────────────────────────────
// هر بخش یک مفهوم کلنگ را آموزش می‌دهد: توضیح در پنل راست، کد در ویرایشگر.
// کاربر با کمترین تغییر (اجرا، ویرایش یک کلمه) مفهوم را یاد می‌گیرد.

const HELP_SECTIONS = [
  {
    title: '۱. سلام دنیا',
    filename: 'hello.kolang',
    explanation: 'تابع «بنویس» متن را در خروجی چاپ می‌کند. متن‌ها در کلنگ با گیومهٔ فرانسوی «» نوشته می‌شوند.',
    action: 'دکمهٔ ▶ اجرا را بزنید تا «سلام دنیا!» چاپ شود.',
    code: '«سلام دنیا!» بنویس',
  },
  {
    title: '۲. متغیرها',
    filename: 'variables.kolang',
    explanation: 'برای ذخیرهٔ یک مقدار در یک نام، از = استفاده کنید. سپس می‌توانید از آن نام در جاهای دیگر کد بهره ببرید. علامت + رشته‌ها را به هم می‌چسباند.',
    action: 'نام «رامین» را به نام خودتان تغییر دهید و اجرا کنید.',
    code: 'نام = «رامین»\n«سلام » + نام بنویس',
  },
  {
    title: '۳. محاسبات',
    filename: 'calculations.kolang',
    explanation: 'کلنگ از عملیات ریاضی پشتیبانی می‌کند: + ، - ، × (ضرب) ، ÷ (تقسیم). متغیرها می‌توانند اعداد را هم ذخیره کنند.',
    action: 'اعداد ۱۰ یا ۵ را تغییر دهید و نتیجه را ببینید.',
    code: 'طول = ۱۰\nعرض = ۵\nمساحت = طول × عرض\n«مساحت: » + مساحت بنویس',
  },
  {
    title: '۴. شرط‌ها',
    filename: 'conditionals.kolang',
    explanation: 'با «اگر ... باشد:» می‌توان بر اساس یک شرط تصمیم گرفت. بخش «وگرنه:» زمانی اجرا می‌شود که شرط برقرار نباشد. بلوک‌ها با فاصله (تورفتگی) مشخص می‌شوند — مانند پایتون.',
    action: 'عدد ۲۰ را به ۱۵ تغییر دهید و اجرا کنید تا «کودک» چاپ شود.',
    code: 'سن = ۲۰\nاگر سن >= ۱۸ باشد:\n    «بزرگسال» بنویس\nوگرنه:\n    «کودک» بنویس',
  },
  {
    title: '۵. حلقه‌ها',
    filename: 'loops.kolang',
    explanation: 'با «برای ای از A تا B:» می‌توان روی اعداد پشت سر هم کار کرد. متغیر حلقه در هر تکرار مقدار بعدی را می‌گیرد.',
    action: 'عدد ۵ را به ۱۰ تغییر دهید و اجرا کنید.',
    code: 'برای ای از ۱ تا ۵:\n    «شماره: » + ای بنویس',
  },
  {
    title: '۶. توابع',
    filename: 'functions.kolang',
    explanation: 'با «تعریف نام(پارامتر):» می‌توان یک تابع ساخت و آن را چند بار با ورودی‌های متفاوت صدا زد. بدنهٔ تابع با تورفتگی مشخص می‌شود.',
    action: 'یک فراخوانی سوم اضافه کنید: سلام(«نام شما») و اجرا کنید.',
    code: 'تعریف سلام(نام):\n    «سلام » + نام بنویس\n\nسلام(«رامین»)\nسلام(«دنیا»)',
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

  let currentFilename = 'برنامه.kolang'

  // اطمینان از وجود پسوند .kolang
  function ensureKolangExtension(name) {
    if (!name) return 'برنامه.kolang'
    return name.endsWith('.kolang') ? name : name + '.kolang'
  }

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
        currentFilename = ensureKolangExtension(file.name)
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
      a.download = ensureKolangExtension(currentFilename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // آزاد کردن URL پس از مدت کوتاه
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      post({ type: 'file', action: 'save', filename: a.download })
    })
  }

  // ─── پنل راهنما (راست، push—not overlay) ─────────────────────────────────
  // پنل از سمت راست باز می‌شود و ویرایشگر/خروجی را به چپ هل می‌دهد.
  // روی تبلت به‌صورت پیش‌فرض باز است؛ روی گوشی بسته است.

  function isTablet() {
    return window.matchMedia('(min-width: 768px)').matches
  }

  const sidebarEl = document.getElementById('sidebar')
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn')
  const sidebarCloseBtn = document.getElementById('sidebar-close')
  const helpListEl = document.getElementById('help-list')

  let sidebarOpen = false
  let activeSectionIndex = -1

  function getPanelWidth() {
    return sidebarEl ? sidebarEl.offsetWidth : 0
  }

  function updatePanelMargin() {
    // عرض پنل را به‌صورت متغیر CSS تنظیم می‌کند تا ویرایشگر و خروجی
    // به اندازهٔ آن به چپ هل شوند (push، نه overlay).
    const w = sidebarOpen ? getPanelWidth() : 0
    document.documentElement.style.setProperty('--panel-w', w + 'px')
  }

  function applySidebarState() {
    if (!sidebarEl) return
    sidebarEl.classList.toggle('open', sidebarOpen)
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    updatePanelMargin()
  }

  function openSidebar() {
    sidebarOpen = true
    applySidebarState()
  }

  function closeSidebar() {
    sidebarOpen = false
    applySidebarState()
  }

  function toggleSidebar() {
    if (sidebarOpen) closeSidebar()
    else openSidebar()
  }

  if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar)
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar)

  // ─── حالت اولیه: روی تبلت پنل باز است ───────────────────────────────────
  if (isTablet()) {
    sidebarOpen = true
  }
  applySidebarState()

  // ─── ساخت بخش‌های راهنما ─────────────────────────────────────────────────
  function loadSection(index) {
    if (index < 0 || index >= HELP_SECTIONS.length) return
    const section = HELP_SECTIONS[index]
    // بارگذاری کد در ویرایشگر
    if (editor) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: section.code },
      })
    }
    // به‌روزرسانی نام فایل
    currentFilename = section.filename
    // برجسته‌سازی بخش فعال و باز کردن آن
    activeSectionIndex = index
    renderHelpSections()
  }

  function renderHelpSections() {
    if (!helpListEl) return
    helpListEl.innerHTML = ''
    HELP_SECTIONS.forEach((section, index) => {
      const isActive = index === activeSectionIndex
      const sec = document.createElement('div')
      sec.className = 'help-section' + (isActive ? ' active' : '')

      const title = document.createElement('div')
      title.className = 'help-section-title'
      title.innerHTML = '<span>' + section.title + '</span><span class="help-section-chevron">▸</span>'
      title.addEventListener('click', () => {
        loadSection(index)
        // روی گوشی، پنل باز بماند تا کاربر توضیح را بخواند
        if (!sidebarOpen) openSidebar()
      })
      sec.appendChild(title)

      if (isActive) {
        const body = document.createElement('div')
        body.className = 'help-section-body'

        const expl = document.createElement('div')
        expl.className = 'help-explanation'
        expl.textContent = section.explanation
        body.appendChild(expl)

        const act = document.createElement('div')
        act.className = 'help-action'
        act.textContent = '🎯 ' + section.action
        body.appendChild(act)

        const nav = document.createElement('div')
        nav.className = 'help-nav'
        const prevBtn = document.createElement('button')
        prevBtn.className = 'help-nav-btn'
        prevBtn.textContent = '← قبلی'
        prevBtn.disabled = index === 0
        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); loadSection(index - 1) })
        nav.appendChild(prevBtn)

        const progress = document.createElement('span')
        progress.className = 'help-progress'
        progress.textContent = 'گام ' + (index + 1) + ' از ' + HELP_SECTIONS.length
        nav.appendChild(progress)

        const nextBtn = document.createElement('button')
        nextBtn.className = 'help-nav-btn'
        nextBtn.textContent = 'بعدی →'
        nextBtn.disabled = index === HELP_SECTIONS.length - 1
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); loadSection(index + 1) })
        nav.appendChild(nextBtn)

        body.appendChild(nav)
        sec.appendChild(body)
      }

      helpListEl.appendChild(sec)
    })
  }

  // بارگذاری بخش اول به‌صورت پیش‌فرض (کد آن در ویرایشگر قرار می‌گیرد)
  loadSection(0)

  // جمع‌شدنی: خروجی
  const outputHeader = document.getElementById('output-header')
  const outputPanel = document.getElementById('output-panel')
  if (outputHeader && outputPanel) {
    outputHeader.addEventListener('click', () => {
      outputPanel.classList.toggle('collapsed')
    })
  }

  // واکنش به تغییر اندازهٔ پنجره:
  // - تبلت ← گوشی: پنل بسته شود
  // - گوشی ← تبلت: پنل باز شود
  // - همیشه margin به‌روز شود (عرض پنل ممکن است با media query تغییر کند)
  window.addEventListener('resize', () => {
    if (isTablet()) {
      if (!sidebarOpen) {
        sidebarOpen = true
        applySidebarState()
      }
    } else {
      if (sidebarOpen) {
        sidebarOpen = false
        applySidebarState()
      }
    }
    // عرض پنل با media query تغییر می‌کند — margin را به‌روز کن
    updatePanelMargin()
  })
}

boot()
