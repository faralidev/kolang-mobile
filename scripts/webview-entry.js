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
import { EditorState, Compartment } from '@codemirror/state'
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

// ─── پوستهٔ روشن CodeMirror (Catppuccin Latte) ──────────────────────────────

const editorThemeLight = EditorView.theme({
  '&': { height: '100%', backgroundColor: '#eff1f5', color: '#4c4f69', direction: 'rtl' },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#bcc0cc #e6e9ef',
    direction: 'rtl',
  },
  '.cm-scroller::-webkit-scrollbar': { width: '8px' },
  '.cm-scroller::-webkit-scrollbar-track': { background: '#e6e9ef' },
  '.cm-scroller::-webkit-scrollbar-thumb': { background: '#bcc0cc', borderRadius: '4px' },
  '.cm-content': { caretColor: '#dc8a78', direction: 'rtl', textAlign: 'right', fontFamily: "'Vazirmatn','Iranian Sans','Sahel',monospace" },
  '.cm-line': { direction: 'rtl', textAlign: 'right' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#acb0be80' },
  '.cm-cursor': { borderLeftColor: '#dc8a78' },
  '.cm-activeLine': { backgroundColor: '#bcc0cc40' },
  '.cm-activeLineGutter': { backgroundColor: '#ccd0da', color: '#4c4f69' },
  '.cm-gutters': { backgroundColor: '#e6e9ef', color: '#acb0be', border: 'none', direction: 'rtl' },
  '.cm-matchingBracket': { backgroundColor: '#acb0be40', outline: '1px solid #1e66f580' },
}, { dark: false })

const kolangHighlightLight = HighlightStyle.define([
  { tag: tags.comment, color: '#7c7f93', fontStyle: 'italic' },
  { tag: tags.string, color: '#40a02b' },
  { tag: tags.number, color: '#fe640b' },
  { tag: tags.bool, color: '#fe640b', fontWeight: 'bold' },
  { tag: tags.null, color: '#fe640b' },
  { tag: tags.controlKeyword, color: '#8839ef', fontWeight: 'bold' },
  { tag: tags.definitionKeyword, color: '#df8e1d', fontWeight: 'bold' },
  { tag: tags.keyword, color: '#04a5e5', fontStyle: 'italic' },
  { tag: tags.operatorKeyword, color: '#d20f39' },
  { tag: tags.operator, color: '#1e66f5' },
  { tag: tags.standard(tags.function(tags.variableName)), color: '#40a02b' },
  { tag: tags.function(tags.variableName), color: '#1e66f5' },
  { tag: tags.typeName, color: '#179299', fontStyle: 'italic' },
  { tag: tags.className, color: '#d20f39', textDecoration: 'underline' },
  { tag: tags.namespace, color: '#04a5e5', fontStyle: 'italic' },
  { tag: tags.self, color: '#d20f39', fontStyle: 'italic' },
  { tag: tags.variableName, color: '#4c4f69' },
  { tag: tags.punctuation, color: '#7c7f93' },
  { tag: tags.meta, color: '#ea76cb' },
])

// ─── Compartment برای تعویض پویای تم و برجسته‌سازی ─────────────────────────
// با reconfigure می‌توان تم ویرایشگر را بدون بازسازی کامل آن عوض کرد.
const themeCompartment = new Compartment()
const highlightCompartment = new Compartment()

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
        themeCompartment.of(editorTheme),
        highlightCompartment.of(syntaxHighlighting(kolangHighlight)),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          indentWithTab,
          { key: 'Mod-Enter', run: () => { runKolangNow(); return true } },
          { key: 'Shift-Enter', run: () => { runKolangNow(); return true } },
          { key: 'Ctrl-ArrowLeft', run: () => { prevSection(); return true } },
          { key: 'Ctrl-ArrowRight', run: () => { nextSection(); return true } },
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

  // ─── مدیریت تم (تیره/روشن) ───────────────────────────────────────────────
  // روی بارگذاری، تم سیستم عامل را تشخیص می‌دهد. کاربر می‌تواند با دکمهٔ ☀️/🌙
  // تم را دستی عوض کند. پس از تغییر دستی، دنبال‌کردن تم سیستم متوقف می‌شود.
  const themeToggleBtn = document.getElementById('theme-toggle-btn')
  let userOverrodeTheme = false

  function applyTheme(isLight) {
    document.body.classList.toggle('light', isLight)
    if (editor) {
      editor.dispatch({
        effects: [
          themeCompartment.reconfigure(isLight ? editorThemeLight : editorTheme),
          highlightCompartment.reconfigure(syntaxHighlighting(isLight ? kolangHighlightLight : kolangHighlight)),
        ],
      })
    }
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

  // ─── باز کردن، ذخیره، و فایل جدید ────────────────────────────────────────
  // از API مرورگر (FileReader و Blob download) استفاده می‌شود که هم در
  // WebView ری‌اکت‌نیتیو و هم در مرورگر معمولی (GitHub Pages) کار می‌کند.

  let currentFilename = 'برنامه.kolang'
  const tabNameEl = document.getElementById('tab-name')

  // اطمینان از وجود پسوند .kolang
  function ensureKolangExtension(name) {
    if (!name) return 'برنامه.kolang'
    return name.endsWith('.kolang') ? name : name + '.kolang'
  }

  function updateTabName() {
    if (tabNameEl) tabNameEl.textContent = currentFilename
  }

  // فایل جدید: 📄 ویرایشگر را خالی می‌کند و نام را به پیش‌فرض برمی‌گرداند
  const newBtn = document.getElementById('new-btn')
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (editor) {
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '' } })
      }
      currentFilename = 'برنامه.kolang'
      updateTabName()
      post({ type: 'file', action: 'new', filename: currentFilename })
    })
  }

  // کلیک روی نام تب → تغییر نام با prompt
  if (tabNameEl) {
    tabNameEl.addEventListener('click', () => {
      const newName = prompt('نام فایل جدید:', currentFilename)
      if (newName && newName.trim()) {
        currentFilename = ensureKolangExtension(newName.trim())
        updateTabName()
      }
    })
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
        updateTabName()
        post({ type: 'file', action: 'open', filename: currentFilename })
      } catch (err) {
        post({ type: 'error', detail: String((err && err.message) || err) })
      }
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
  const prevBtn = document.getElementById('prev-btn')
  const nextBtn = document.getElementById('next-btn')
  const navProgressEl = document.getElementById('nav-progress')

  let sidebarOpen = false
  let activeSectionIndex = -1

  function getPanelWidth() {
    return sidebarEl ? sidebarEl.offsetWidth : 0
  }

  function updatePanelMargin() {
    // فقط روی تبلت margin-right اعمال می‌شود (push layout).
    // روی گوشی پنل تمام‌صفحه است و margin لازم ندارد.
    const w = (sidebarOpen && isTablet()) ? getPanelWidth() : 0
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
    currentFilename = section.filename
    updateTabName()
    activeSectionIndex = index
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

  // ─── ساخت بخش‌های راهنما ─────────────────────────────────────────────────
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

  // واکنش به تغییر اندازهٔ پنجره
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
    updatePanelMargin()
  })

  // ─── میان‌برهای کیبورد (سطح پنجره — حتی وقتی ویرایشگر فوکوس ندارد) ────────
  // Mod-Enter / Ctrl+Enter → اجرا. Ctrl+←/→ → بخش قبلی/بعدی.
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runKolangNow()
    } else if (e.ctrlKey && e.key === 'ArrowLeft') {
      e.preventDefault()
      prevSection()
    } else if (e.ctrlKey && e.key === 'ArrowRight') {
      e.preventDefault()
      nextSection()
    }
  })
}

boot()
