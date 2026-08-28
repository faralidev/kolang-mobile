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
import { EditorView } from '@codemirror/view'
import { foldGutter, codeFolding } from '@codemirror/language'

// گرامر کلنگ — ساخت ویرایشگر با factory مشترک (base، تم، keymap داخل آن)
import { createKolangEditor } from '@kolang/grammar/codemirror/kolang-editor.js'

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

// ─── بخش‌های راهنمای تعاملی ───────────────────────────────────────────────
// هر بخش یک مفهوم کلنگ را آموزش می‌دهد: توضیح در پنل راست، کد در ویرایشگر.
// کاربر با کمترین تغییر (اجرا، ویرایش یک کلمه) مفهوم را یاد می‌گیرد.
// نحو (syntax) بر اساس SPEC.md و examples/ کلنگ است.

const HELP_SECTIONS = [
  {
    title: '۱. سلام دنیا',
    filename: 'hello.kolang',
    explanation: 'تابع «بنویس» متن را در خروجی چاپ می‌کند. متن‌ها در کلنگ با گیومهٔ فرانسوی «» نوشته می‌شوند. این ساده‌ترین برنامهٔ ممکن است.',
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
    title: '۳. انواع داده',
    filename: 'data-types.kolang',
    explanation: 'کلنگ چند نوع داده دارد: عدد صحیح (۱۲۳)، عدد اعشاری (۳٫۱۴)، بولی (درست/غلط)، و متن («...»). هر کدام کاربرد خود را دارد.',
    action: 'مقدار سن را تغییر دهید و نتیجه را ببینید.',
    code: 'سن = ۲۰\nامتیاز = ۱۸٫۵\nفعال = درست\nنام = «علی»\n«سن: » + متن(سن) بنویس\n«امتیاز: » + متن(امتیاز) بنویس\n«فعال: » + متن(فعال) بنویس',
  },
  {
    title: '۴. محاسبات',
    filename: 'calculations.kolang',
    explanation: 'کلنگ از عملیات ریاضی پشتیبانی می‌کند: + (جمع)، - (منها)، × (ضرب)، ÷ (تقسیم)، * (توان)، % (باقی‌مانده).',
    action: 'اعداد ۱۰ یا ۵ را تغییر دهید و نتیجه را ببینید.',
    code: 'طول = ۱۰\nعرض = ۵\nمساحت = طول × عرض\n«مساحت: » + متن(مساحت) بنویس\n«توان: » + متن(طول * ۲) بنویس\n«باقی‌مانده: » + متن(طول % ۳) بنویس',
  },
  {
    title: '۵. رشته‌ها',
    filename: 'strings.kolang',
    explanation: 'رشته‌ها در کلنگ می‌توانند متغیر را درون خود جای دهند (f-string). کافی است نام متغیر را درون آکولاد { } قرار دهید. این کار ساختن پیام‌های پویا را آسان می‌کند.',
    action: 'نام «علی» را تغییر دهید و پیام را ببینید.',
    code: 'نام = «علی»\n«سلام {نام}!» بنویس\nپیام = «سلام {نام} عزیز، به کلنگ خوش آمدید»\nپیام بنویس',
  },
  {
    title: '۶. شرط‌ها',
    filename: 'conditionals.kolang',
    explanation: 'با «اگر ... باشد:» می‌توان بر اساس یک شرط تصمیم گرفت. بخش «وگرنه:» زمانی اجرا می‌شود که شرط برقرار نباشد. بلوک‌ها با فاصله (تورفتگی) مشخص می‌شوند.',
    action: 'عدد ۲۰ را به ۱۵ تغییر دهید و اجرا کنید تا «کودک» چاپ شود.',
    code: 'سن = ۲۰\nاگر سن >= ۱۸ باشد:\n    «بزرگسال» بنویس\nوگرنه:\n    «کودک» بنویس',
  },
  {
    title: '۷. حلقهٔ برای',
    filename: 'loops.kolang',
    explanation: 'با «برای ای از A تا B:» می‌توان روی اعداد پشت سر هم کار کرد. متغیر حلقه در هر تکرار مقدار بعدی را می‌گیرد. این برای تکرار یک کار مفید است.',
    action: 'عدد ۵ را به ۱۰ تغییر دهید و اجرا کنید.',
    code: 'برای ای از ۱ تا ۵:\n    «شماره: » + متن(ای) بنویس',
  },
  {
    title: '۸. حلقهٔ تاوقتی',
    filename: 'while-loop.kolang',
    explanation: 'حلقهٔ «تاوقتی» تا زمانی که شرط برقرار باشد تکرار می‌شود. برای کارهایی که نمی‌دانیم چند بار باید تکرار شوند مناسب است. مراقب باشید که شرط روزی غلط شود وگرنه حلقه بی‌نهایت می‌شود!',
    action: 'مقدار نهایی ۱۰ را به ۲۰ تغییر دهید و اجرا کنید.',
    code: 'شمارنده = ۰\nتاوقتی شمارنده < ۱۰ باشد:\n    «شمارنده: » + متن(شمارنده) بنویس\n    شمارنده += ۱',
  },
  {
    title: '۹. توابع',
    filename: 'functions.kolang',
    explanation: 'با «تعریف نام(پارامتر):» می‌توان یک تابع ساخت و آن را چند بار با ورودی‌های متفاوت صدا زد. تابع‌ها کد را سازمان‌دهی می‌کنند و از تکرار جلوگیری می‌کنند. آرگومان‌ها با «و» جدا می‌شوند.',
    action: 'یک فراخوانی سوم اضافه کنید: سلام(«نام شما») و اجرا کنید.',
    code: 'تعریف سلام(نام):\n    «سلام » + نام بنویس\n\nسلام(«رامین»)\nسلام(«دنیا»)',
  },
  {
    title: '۱۰. عبارت لوله',
    filename: 'pipe.kolang',
    explanation: 'عملگر لوله (|>) خروجی یک مرحله را به ورودی مرحلهٔ بعد می‌دهد. این کار خواندن زنجیرهٔ توابع را آسان می‌کند — مثل لولهٔ آب که داده را جریان می‌دهد.',
    action: 'عدد ۵ را تغییر دهید یا یک مرحلهٔ لوله اضافه کنید.',
    code: 'تعریف دو‌برابر(x):\n    x × ۲ برگردان\n\nتعریف یکی‌اضافه(x):\n    x + ۱ برگردان\n\n۵ |> دو‌برابر |> یکی‌اضافه |> بنویس',
  },
  {
    title: '۱۱. درک فهرست',
    filename: 'comprehensions.kolang',
    explanation: 'درک فهرست راهی کوتاه برای ساختن فهرست‌های جدید از فهرست‌های موجود است. الگو: [عبارت برای متغیر در منبع اگر شرط]. مانند ریاضی: «مربع اعداد زوج».',
    action: 'بازه(۱۰) را به بازه(۲۰) تغییر دهید و اجرا کنید.',
    code: 'مربع‌ها = [ای * ۲ برای ای در بازه(۱۰)]\nمربع‌ها بنویس\n\nزوج‌ها = [ای برای ای در بازه(۱۰) اگر ای % ۲ == ۰ باشد]\nزوج‌ها بنویس',
  },
  {
    title: '۱۲. کلاس‌ها',
    filename: 'classes.kolang',
    explanation: 'کلاس (گونه) قالبی برای ساخت شیء است. با «گونه نام:» تعریف می‌شود. تابع «ساخت» سازنده است و هنگام ساختن شیء فراخوانی می‌شود. «خود» به خود شیء اشاره دارد (مثل self در پایتون).',
    action: 'یک سگ دیگر با نام متفاوت بسازید و صدادهی کنید.',
    code: 'گونه حیوان:\n    ساخت(خود و نام):\n        نامِ خود = نام\n    تعریف صدادهی(خود):\n        «صدای حیوان» بنویس\n\nس = حیوان(«رکس»)\nصدادهیِ() س\nنامِ س بنویس',
  },
  {
    title: '۱۳. وراثت',
    filename: 'inheritance.kolang',
    explanation: 'وراثت به یک کلاس اجازه می‌دهد از کلاس دیگر خصوصیات و رفتارها را به ارث ببرد. با «وارث» مشخص می‌شود. کلاس فرزند می‌تواند متدهای والد را با «والدِ خود» صدا بزند.',
    action: 'یک گونهٔ گربه وارث حیوان اضافه کنید و صدادهی کنید.',
    code: 'گونه حیوان:\n    ساخت(خود و نام):\n        نامِ خود = نام\n    تعریف صدادهی(خود):\n        «صدای حیوان» بنویس\n    تعریف معرفی(خود):\n        «من یک حیوان به نام » + نامِ خود بنویس\n\nگونه سگ وارث حیوان:\n    تعریف صدادهی(خود):\n        «واف واف» بنویس\n    تعریف معرفی(خود):\n        صدادهیِ() والدِ خود\n        «من یک سگ هستم به نام » + نامِ خود بنویس\n\nرکس = سگ(«رکس»)\nصدادهیِ() رکس\nمعرفیِ() رکس',
  },
  {
    title: '۱۴. رابط‌ها',
    filename: 'interfaces.kolang',
    explanation: 'رابط (interface) مانند قراردادی است که می‌گوید یک شیء باید چه متدهایی داشته باشد. هر کلاسی که آن متدها را داشته باشد، خودبه‌خود رابط را پیاده می‌کند (بدون اعلان صریح). این کار کد را انعطاف‌پذیر می‌کند.',
    action: 'یک گونهٔ سگ با همان متدها اضافه کنید و معرفی کنید.',
    code: 'رابط حیوان:\n    تعریف صدادهی(خود)\n    تعریف نام(خود) -> متن\n\nگونه گربه:\n    ساخت(خود و نام):\n        نامِ خود = نام\n    تعریف صدادهی(خود):\n        «میو» بنویس\n    تعریف نام(خود) -> متن:\n        نامِ خود برگردان\n\nتعریف معرفی(ح: حیوان):\n    صدادهیِ() ح\n    «نام: » + نامِ() ح بنویس\n\nپشمک = گربه(«پشمک»)\nمعرفی(پشمک)',
  },
  {
    title: '۱۵. استثناها',
    filename: 'exceptions.kolang',
    explanation: 'استثنا برای مدیریت خطاهاست. «بپا:» بخشی که ممکن است خطا دهد را در بر می‌گیرد. «بگیر:» خطا را می‌گیرد و مدیریت می‌کند. «درنهایت:» همیشه اجرا می‌شود. «بده» یک استثنا پرتاب می‌کند.',
    action: 'خطای‌مقدار را به خطای‌نوع تغییر دهید و اجرا کنید.',
    code: 'بپا:\n    «قبل از خطا» بنویس\n    خطای‌مقدار(«یک مشکل!») بده\n    «این چاپ نمی‌شود» بنویس\nخطای‌مقدار بگیر بانام err:\n    «خطا گرفته شد:» بنویس\n    پیامِ err بنویس\nدرنهایت:\n    «درنهایت اجرا شد» بنویس',
  },
  {
    title: '۱۶. کانال‌ها',
    filename: 'channels.kolang',
    explanation: 'کانال برای ارتباط بین تارک‌ها (goroutines) است که کارها را همزمان انجام می‌دهند. «برو» یک تابع را در پس‌زمینه اجرا می‌کند. «<<» مقدار را به کانال می‌فرستد و «>>» می‌گیرد.',
    action: 'تعداد اعداد تولیدشده را از ۵ به ۸ تغییر دهید و اجرا کنید.',
    code: 'تعریف تولیدکننده(ch):\n    برای ای از ۰ تا ۵:\n        ch << ای\n    ch ببند\n\nتعریف مصرف‌کننده(ch):\n    تاوقتی درست باشد:\n        مقدار = >>ch\n        اگر بسته‌استِ ch == درست باشد:\n            اتمام\n        مقدار بنویس\n\nch = کانال(صحیح و ۲)\nبرو تولیدکننده(ch)\nبرو مصرف‌کننده(ch)',
  },
  {
    title: '۱۷. جنریتورها',
    filename: 'generators.kolang',
    explanation: 'جنریتور تابعی است که مقدارها را یکی‌یکی تولید می‌کند (با «بساز») به‌جای همه را یک‌جا. این کار حافظه را ذخیره می‌کند و برای دنباله‌های بزرگ یا بی‌نهایت عالی است.',
    action: 'تعداد شمارش را از ۵ به ۱۰ تغییر دهید و اجرا کنید.',
    code: 'تعریف شمارش(ن):\n    برای ای از ۰ تا ن:\n        ای بساز\n\nبرای ای در شمارش(۵):\n    ای بنویس',
  },
  {
    title: '۱۸. پوشش‌ها',
    filename: 'decorators.kolang',
    explanation: 'پوشش (decorator) تابع را درون لایه‌ای از رفتار اضافی می‌پیچد. با «پوشش نام» بالای تعریف تابع استفاده می‌شود. مفید برای اضافه کردن قابلیت‌هایی مثل زمان‌سنجی یا تکرار بدون تغییر خود تابع.',
    action: 'تعداد تکرار را از ۳ به ۵ تغییر دهید و اجرا کنید.',
    code: 'تعریف تکرار(تعداد):\n    تعریف تزیین(ف):\n        تعریف درونی():\n            برای ای از ۰ تا تعداد:\n                ف()\n        درونی برگردان\n    تزیین برگردان\n\nپوشش تکرار(۳)\nتعریف سلام():\n    «سلام!» بنویس\n\nسلام()',
  },
  {
    title: '۱۹. پروژهٔ نهایی',
    filename: 'final-project.kolang',
    explanation: 'این پروژه چند مفهوم را ترکیب می‌کند: کلاس، شرط، حلقه، و تابع. یک دفترچهٔ تلفن ساده است که مخاطب اضافه می‌کند و جستجو می‌کند. این پایه‌ای است برای پروژه‌های بزرگ‌تر.',
    action: 'یک مخاطب جدید اضافه کنید و سپس نام او را جستجو کنید.',
    code: 'گونه مخاطب:\n    ساخت(خود و نام و شماره):\n        نامِ خود = نام\n        شمارهِ خود = شماره\n    تعریف نمایش(خود):\n        نامِ خود + «: » + شمارهِ خود بنویس\n\nدفترچه = []\n\nتعریف افزودن(نام و شماره):\n    فرد = مخاطب(نام و شماره)\n    فرد  به دفترچه بیافزا\n\nتعریف جستجو(نام):\n    برای فرد در دفترچه:\n        اگر نامِ فرد == نام باشد:\n            نمایشِ() فرد\n            برگردان\n    «پیدا نشد» بنویس\n\nافزودن(«علی» و «۰۹۱۲۳۴۵۶۷۸۹»)\nافزودن(«سارا» و «۰۹۸۷۶۵۴۳۲۱۰»)\nجستجو(«علی»)\nجستجو(«سارا»)',
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

  // متغیرهای چند تب — قبل از ساخت ویرایشگر اعلان می‌شوند تا updateListener
  // بتواند به آن‌ها دسترسی داشته باشد.
  let tabs = [{ id: 0, filename: 'برنامه.kolang', content: '' }]
  let activeTabId = 0
  let tabIdCounter = 1
  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId)
  }

  // ساخت ویرایشگر با factory مشترک: base (شماره خط، history، تطبیق پرانتز،
  // زبان کلنگ، keymap پیش‌فرض) و compartmentهای تم داخل kolang-editor.js
  // ساخته می‌شوند. اینجا فقط اضافات مخصوص موبایل پاس داده می‌شوند.
  let setThemeFn = null

  const { view, setTheme } = createKolangEditor({
    parent: editorEl,
    doc: '«سلام دنیا!» بنویس',
    theme: 'dark',
    extensions: [
      foldGutter(),
      codeFolding(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          post({ type: 'code', text: update.state.doc.toString() })
          // همگام‌سازی محتوای تب فعلی
          const tab = getActiveTab()
          if (tab) tab.content = update.state.doc.toString()
        }
      }),
    ],
  })
  editor = view
  setThemeFn = setTheme

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

  // ─── مدیریت تم (تیره/روشن) ───────────────────────────────────────────────
  // روی بارگذاری، تم سیستم عامل را تشخیص می‌دهد. کاربر می‌تواند با دکمهٔ ☀️/🌙
  // تم را دستی عوض کند. پس از تغییر دستی، دنبال‌کردن تم سیستم متوقف می‌شود.
  const themeToggleBtn = document.getElementById('theme-toggle-btn')
  let userOverrodeTheme = false

  function applyTheme(isLight) {
    document.body.classList.toggle('light', isLight)
    // جابه‌جایی تم روی compartmentهای داخل factory (setTheme از createKolangEditor)
    if (setThemeFn) setThemeFn(isLight)
    if (themeToggleBtn) {
      // در حالت تیره → ☀️ (کلیک برای روشن)
      // در حالت روشن → 🌙 (کلیک برای تیره)
      themeToggleBtn.textContent = isLight ? '🌙' : '☀️'
    }
  }

  function getSystemLight() {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches
    } catch (_) {
      return false
    }
  }

  // بارگذاری اولیه: ترجیح ذخیره‌شده، وگرنه تم سیستم
  const savedTheme = localStorage.getItem('kolang-theme')
  let isLight
  if (savedTheme === 'light') {
    isLight = true
    userOverrodeTheme = true
  } else if (savedTheme === 'dark') {
    isLight = false
    userOverrodeTheme = true
  } else {
    // 'auto' یا ذخیره‌نشده — از تم سیستم استفاده کن
    isLight = getSystemLight()
  }
  applyTheme(isLight)

  // دکمهٔ تغییر تم
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      userOverrodeTheme = true
      const newLight = !document.body.classList.contains('light')
      applyTheme(newLight)
      localStorage.setItem('kolang-theme', newLight ? 'light' : 'dark')
    })
  }

  // گوش‌دادن به تغییر تم سیستم — فقط اگر کاربąd دستی نکرده باشد
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (userOverrodeTheme) return
      // e.matches == true یعنی سیستم به تیره تغییر کرد
      applyTheme(!e.matches)
    })
  } catch (_) {
    // مرورگر قدیمی — بی‌خیال
  }

  // ─── باز کردن، ذخیره، و فایل جدید (پشتیبانی چند تب) ──────────────────────
  // (متغیرهای tabs/activeTabId/tabIdCounter/getActiveTab در ابتدای boot اعلان شدند)

  const tabsContainer = document.getElementById('tabs-container')

  function ensureKolangExtension(name) {
    if (!name) return 'برنامه.kolang'
    return name.endsWith('.kolang') ? name : name + '.kolang'
  }

  function renderTabs() {
    if (!tabsContainer) return
    tabsContainer.innerHTML = ''
    tabs.forEach(tab => {
      const item = document.createElement('div')
      item.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '')

      const icon = document.createElement('span')
      icon.className = 'tab-icon'
      icon.textContent = '📄'
      item.appendChild(icon)

      const name = document.createElement('span')
      name.className = 'tab-name'
      name.textContent = tab.filename
      name.addEventListener('click', () => switchTab(tab.id))
      item.appendChild(name)

      if (tabs.length > 1) {
        const close = document.createElement('button')
        close.className = 'tab-close'
        close.textContent = '✕'
        close.addEventListener('click', (e) => {
          e.stopPropagation()
          closeTab(tab.id)
        })
        item.appendChild(close)
      }

      tabsContainer.appendChild(item)
    })
  }

  function switchTab(id) {
    // ذخیرهٔ محتوای تب فعلی
    const current = getActiveTab()
    if (current && editor) {
      current.content = editor.state.doc.toString()
    }
    activeTabId = id
    const tab = tabs.find(t => t.id === id)
    if (tab && editor) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: tab.content },
      })
    }
    renderTabs()
    post({ type: 'file', action: 'switch', filename: tab ? tab.filename : '' })
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id)
    if (idx < 0) return
    tabs.splice(idx, 1)
    if (tabs.length === 0) {
      // همیشه حداقل یک تب
      tabs.push({ id: tabIdCounter++, filename: 'برنامه.kolang', content: '' })
    }
    if (activeTabId === id) {
      const newIdx = Math.min(idx, tabs.length - 1)
      activeTabId = tabs[newIdx].id
      const tab = tabs[newIdx]
      if (editor) {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: tab.content },
        })
      }
    }
    renderTabs()
  }

  function newTab() {
    const id = tabIdCounter++
    tabs.push({ id, filename: `برنامه-${id}.kolang`, content: '' })
    // ذخیرهٔ محتوای فعلی قبل از تعویض
    const current = getActiveTab()
    if (current && editor) {
      current.content = editor.state.doc.toString()
    }
    activeTabId = id
    if (editor) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } })
    }
    renderTabs()
    post({ type: 'file', action: 'new', filename: `برنامه-${id}.kolang` })
  }

  // فایل جدید: 📄 یک تب جدید می‌سازد
  const newBtn = document.getElementById('new-btn')
  if (newBtn) {
    newBtn.addEventListener('click', newTab)
  }

  // باز کردن فایل: 📂 یک تب جدید با محتوای فایل می‌سازد
  const openBtn = document.getElementById('open-btn')
  const fileInput = document.getElementById('file-input')
  if (openBtn && fileInput) {
    openBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      try {
        const content = await file.text()
        const id = tabIdCounter++
        tabs.push({ id, filename: ensureKolangExtension(file.name), content })
        // ذخیرهٔ محتوای فعلی قبل از تعویض
        const current = getActiveTab()
        if (current && editor) {
          current.content = editor.state.doc.toString()
        }
        activeTabId = id
        if (editor) {
          editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: content },
          })
        }
        renderTabs()
        post({ type: 'file', action: 'open', filename: ensureKolangExtension(file.name) })
      } catch (err) {
        post({ type: 'error', detail: String((err && err.message) || err) })
      }
      fileInput.value = ''
    })
  }

  // ذخیره فایل: 💾 محتوای تب فعلی را دانلود می‌کند
  const saveBtn = document.getElementById('save-btn')
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!editor) return
      const tab = getActiveTab()
      const content = editor.state.doc.toString()
      if (tab) tab.content = content
      const filename = ensureKolangExtension(tab ? tab.filename : 'برنامه.kolang')
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      post({ type: 'file', action: 'save', filename })
    })
  }

  // به‌روزرسانی محتوای تب فعلی هنگام تایپ — در updateListener (بالای boot) انجام می‌شود

  renderTabs()

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
  const prevBtn = document.getElementById('prev-btn')
  const nextBtn = document.getElementById('next-btn')
  const navProgressEl = document.getElementById('nav-progress')

  let sidebarOpen = false
  let activeSectionIndex = -1

  function getPanelWidth() {
    return sidebarEl ? sidebarEl.offsetWidth : 0
  }

  // push layout (margin-right) اعمال می‌شود روی: تبلت (≥۷۶۸پیکسل) و گوشی لنداسکیپ.
  // روی گوشی پرتره پنل bottom sheet است و push لازم ندارد.
  function isPushLayout() {
    if (isTablet()) return true
    return window.matchMedia('(orientation:landscape) and (max-width:767px)').matches
  }

  function updatePanelMargin() {
    // margin-right فقط در حالت push (تبلت یا گوشی لنداسکیپ) و وقتی پنل باز است.
    const w = (sidebarOpen && isPushLayout()) ? getPanelWidth() : 0
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

  // ─── حالت اولیه: روی تبلت پنل باز است، روی گوشی بسته ─────────────────────
  // بعد از تعیین حالت اولیه، کلاس ready را اضافه کن تا visibility:hidden
  // برداشته شود و فلاش نزند.
  if (isTablet()) {
    sidebarOpen = true
  }
  applySidebarState()
  if (sidebarEl) sidebarEl.classList.add('ready')

  // ─── ناوبری بین بخش‌ها ───────────────────────────────────────────────────
  function loadSection(index) {
    if (index < 0 || index >= HELP_SECTIONS.length) return
    const section = HELP_SECTIONS[index]
    if (editor) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: section.code },
      })
    }
    // کد بخش در تب فعلی بارگذاری می‌شود (تب جدید ساخته نمی‌شود)
    const tab = getActiveTab()
    if (tab) {
      tab.filename = section.filename
      tab.content = section.code
      renderTabs()
    }
    activeSectionIndex = index
    renderHelpCurrent()
    renderHelpSections()
    updateNavButtons()
  }

  function prevSection() {
    if (activeSectionIndex > 0) loadSection(activeSectionIndex - 1)
  }

  function nextSection() {
    if (activeSectionIndex < HELP_SECTIONS.length - 1) loadSection(activeSectionIndex + 1)
  }

  function updateNavButtons() {
    if (prevBtn) prevBtn.disabled = activeSectionIndex <= 0
    if (nextBtn) nextBtn.disabled = activeSectionIndex >= HELP_SECTIONS.length - 1
    if (navProgressEl) {
      const persianNum = (activeSectionIndex + 1).toLocaleString('fa-IR')
      const totalNum = HELP_SECTIONS.length.toLocaleString('fa-IR')
      navProgressEl.textContent = 'گام ' + persianNum + ' از ' + totalNum
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', prevSection)
  if (nextBtn) nextBtn.addEventListener('click', nextSection)

  // دکمهٔ toggle: نمایش/پنهان‌کردن فهرست مراحل (نه دکمه‌های ناوبری)
  const navToggle = document.getElementById('nav-toggle')
  if (navToggle && sidebarEl) {
    navToggle.addEventListener('click', () => {
      sidebarEl.classList.toggle('show-list')
    })
  }

  // ─── ساخت محتوای بخش فعلی (همیشهvisible) ─────────────────────────────────
  function renderHelpCurrent() {
    const el = document.getElementById('help-current')
    if (!el) return
    el.innerHTML = ''
    const section = HELP_SECTIONS[activeSectionIndex]
    if (!section) return

    const title = document.createElement('div')
    title.className = 'help-current-title'
    title.textContent = section.title
    el.appendChild(title)

    const expl = document.createElement('div')
    expl.className = 'help-explanation'
    expl.textContent = section.explanation
    el.appendChild(expl)

    const act = document.createElement('div')
    act.className = 'help-action'
    act.textContent = '🎯 ' + section.action
    el.appendChild(act)
  }

  // ─── ساخت فهرست بخش‌ها (پنهان به‌صورت پیش‌فرض) ─────────────────────────────
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

        sec.appendChild(body)
      }

      helpListEl.appendChild(sec)
    })
  }

  // بارگذاری بخش اول به‌صورت پیش‌فرض
  loadSection(0)

  // جمع‌شدنی: خروجی
  const outputHeader = document.getElementById('output-header')
  const outputPanel = document.getElementById('output-panel')
  if (outputHeader && outputPanel) {
    outputHeader.addEventListener('click', () => {
      outputPanel.classList.toggle('collapsed')
    })
  }

  // واکنش به تغییر اندازهٔ پنجره (شامل چرخش گوشی).
  // وضعیت باز/بستهٔ پنل را حفظ کن — فقط state را دوباره اعمال کن تا
  // transform/width مناسب جهت جدید اعمال شود و margin به‌روز شود.
  window.addEventListener('resize', () => {
    applySidebarState()
    updatePanelMargin()
  })

  // ─── میان‌برهای کیبورد (سطح پنجره، فاز capture — قبل از CM6) ──────────────
  // از فاز capture استفاده می‌کنیم تا قبل از CodeMirror اجرا شود و میان‌برها
  // را ببلعد. Mod = Ctrl روی ویندوز/لینوکس، Cmd روی مک.
  window.addEventListener('keydown', (e) => {
    const isMod = e.ctrlKey || e.metaKey

    // اجرا: Ctrl/Cmd+Enter یا Shift+Enter
    if ((isMod && e.key === 'Enter') || (e.shiftKey && e.key === 'Enter')) {
      e.preventDefault()
      e.stopPropagation()
      runKolangNow()
      return false
    }

    // بخش بعدی: Ctrl/Cmd+ArrowLeft (در RTL، جلو = چپ)
    if (isMod && (e.key === 'ArrowLeft' || e.key === 'Left')) {
      e.preventDefault()
      e.stopPropagation()
      nextSection()
      return false
    }

    // بخش قبلی: Ctrl/Cmd+ArrowRight (در RTL، عقب = راست)
    if (isMod && (e.key === 'ArrowRight' || e.key === 'Right')) {
      e.preventDefault()
      e.stopPropagation()
      prevSection()
      return false
    }
  }, true) // ← capture phase
}

boot()
