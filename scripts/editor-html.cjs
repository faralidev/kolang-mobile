// editor-html.cjs — منبع واحد برای ساخت HTML ویرایشگر وب‌‌ویو
// این تابع هم توسط App.js (React Native) و هم توسط scripts/build-pages.cjs
// (GitHub Pages) استفاده می‌شود تا منطق HTML در یک جا باشد.

'use strict'

function buildEditorHTML(bundleJS) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>ویرایشگر کلنگ</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{height:100%;margin:0;overscroll-behavior:none}
  body{
    display:flex;flex-direction:column;
    background:#1e1e2e;color:#cdd6f4;
    font-family:Vazirmatn,"Iranian Sans","Segoe UI",system-ui,sans-serif;
    padding-top:env(safe-area-inset-top);
    padding-bottom:env(safe-area-inset-bottom);
  }

  /* ─── نوار بالا ─── */
  .topbar{
    display:flex;align-items:center;gap:6px;
    padding:8px 12px;
    background:#181825;
    border-bottom:1px solid #313244;
    flex-shrink:0;
  }
  .topbar-title{
    color:#cdd6f4;font-weight:700;font-size:15px;
    flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .topbar-btn{
    display:flex;align-items:center;justify-content:center;gap:4px;
    min-height:40px;min-width:40px;
    padding:8px 12px;border-radius:10px;border:none;
    font-family:inherit;font-size:14px;font-weight:600;
    cursor:pointer;white-space:nowrap;
  }
  .btn-menu{background:#313244;color:#cdd6f4;font-size:18px;padding:8px 12px}
  .btn-menu:active{background:#45475a}
  .btn-file{background:#313244;color:#cdd6f4;font-size:16px;padding:8px 10px}
  .btn-file:active{background:#45475a}
  .btn-run{background:#a6e3a1;color:#1e1e2e}
  .btn-run:active{opacity:0.8}

  /* ─── overlay (روی گوشی) ─── */
  #sidebar-overlay{
    position:fixed;inset:0;
    background:rgba(0,0,0,0.5);
    opacity:0;pointer-events:none;
    transition:opacity 0.25s ease;
    z-index:90;
  }
  #sidebar-overlay.visible{opacity:1;pointer-events:auto}

  /* ─── نوار کناری مثال‌ها ─── */
  #sidebar{
    position:fixed;top:0;bottom:0;left:0;
    width:280px;
    background:#181825;
    border-right:1px solid #313244;
    transform:translateX(-100%);
    transition:transform 0.25s ease;
    z-index:100;
    display:flex;flex-direction:column;
    overflow:hidden;
  }
  #sidebar.open{transform:translateX(0)}

  /* روی تبلتِ پین‌شده: نوار فضا می‌گیرد، ویرایشگر کوچک می‌شود */
  @media (min-width:768px){
    #sidebar{width:320px}
    #sidebar.pinned{
      transform:translateX(0);
      position:fixed;
      box-shadow:2px 0 12px rgba(0,0,0,0.3);
    }
    body.sidebar-pinned #editor{margin-left:320px}
    body.sidebar-pinned #output-panel{margin-left:320px}
  }

  .sidebar-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;
    border-bottom:1px solid #313244;
    flex-shrink:0;
  }
  .sidebar-title{color:#cdd6f4;font-weight:700;font-size:15px}
  .sidebar-close{
    background:none;border:none;color:#a6adc8;
    font-size:20px;cursor:pointer;padding:4px 8px;
    min-width:36px;min-height:36px;
    border-radius:6px;
  }
  .sidebar-close:active{background:#313244}

  /* ردیف‌های مثال */
  #examples-list{
    flex:1;overflow-y:auto;
    -webkit-overflow-scrolling:touch;
  }
  .example-item{
    padding:12px 16px;
    color:#cdd6f4;font-size:14px;
    border-bottom:1px solid #313244;
    cursor:pointer;
    min-height:44px;display:flex;align-items:center;
    border-left:3px solid transparent;
    transition:background 0.15s;
  }
  .example-item:active{background:#313244}
  .example-item.active{
    background:#313244;
    border-left-color:#cba6f7;
    color:#cba6f7;
  }

  /* آموزش داخل نوار کناری */
  #tutorial{
    border-top:1px solid #313244;
    flex-shrink:0;
  }
  #tutorial-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;cursor:pointer;
  }
  .tutorial-title{color:#a6adc8;font-size:13px;font-weight:600}
  .tutorial-chevron{color:#585b70;font-size:12px;transition:transform 0.2s}
  #tutorial-body{
    display:none;padding:4px 16px 12px;
    max-height:40vh;overflow-y:auto;
  }
  #tutorial-body.open{display:block}
  .tutorial-step{
    display:flex;gap:10px;padding:7px 0;
    color:#bac2de;font-size:12px;line-height:1.6;
    border-bottom:1px solid #31324430;
  }
  .tutorial-step:last-child{border-bottom:none}
  .tutorial-num{
    flex-shrink:0;width:22px;height:22px;border-radius:50%;
    background:#313244;color:#cba6f7;
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;
  }

  /* ─── ویرایشگر ─── */
  #editor{flex:1;min-height:0;overflow:hidden;transition:margin-left 0.25s ease}
  .cm-editor{height:100%;font-size:15px}
  .cm-editor.cm-focused{outline:none}

  /* ─── پنل خروجی ─── */
  #output-panel{
    flex-shrink:0;background:#181825;
    border-top:1px solid #313244;
    max-height:45vh;transition:max-height 0.2s ease,margin-left 0.25s ease;
    display:flex;flex-direction:column;
  }
  #output-panel.collapsed{max-height:44px}
  #output-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;cursor:pointer;
    border-bottom:1px solid #31324440;
  }
  #output-panel.collapsed #output-header{border-bottom:none}
  .output-title{color:#a6adc8;font-size:13px;font-weight:600}
  .output-chevron{color:#585b70;font-size:12px;transition:transform 0.2s}
  #output-panel.collapsed .output-chevron{transform:rotate(-90deg)}
  #output{
    padding:10px 14px;overflow-y:auto;flex:1;
    white-space:pre-wrap;direction:rtl;text-align:right;
    font-family:Vazirmatn,"SF Mono",Menlo,monospace;font-size:13px;
    color:#cdd6f4;line-height:1.6;
  }
  #output.running{color:#a6adc8}
  #output.error{color:#f38ba8}
</style>
</head>
<body>

  <!-- نوار بالا -->
  <div class="topbar">
    <button id="sidebar-toggle-btn" class="topbar-btn btn-menu" title="مثال‌ها">☰</button>
    <span class="topbar-title">ویرایشگر کلنگ</span>
    <button id="open-btn" class="topbar-btn btn-file" title="باز کردن فایل">📂</button>
    <button id="save-btn" class="topbar-btn btn-file" title="ذخیره فایل">💾</button>
    <button id="run-btn" class="topbar-btn btn-run">▶ اجرا</button>
  </div>

  <!-- overlay نوار کناری -->
  <div id="sidebar-overlay"></div>

  <!-- نوار کناری مثال‌ها + آموزش -->
  <div id="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">مثال‌ها</span>
      <button id="sidebar-close" class="sidebar-close">✕</button>
    </div>
    <div id="examples-list"></div>
    <div id="tutorial">
      <div id="tutorial-header">
        <span class="tutorial-title">📚 آموزش</span>
        <span class="tutorial-chevron">▾</span>
      </div>
      <div id="tutorial-body">
        <div class="tutorial-step"><span class="tutorial-num">۱</span><span>کد را در ویرایشگر بنویسید یا ویرایش کنید.</span></div>
        <div class="tutorial-step"><span class="tutorial-num">۲</span><span>دکمهٔ ▶ اجرا را بزنید (یا Cmd+Enter).</span></div>
        <div class="tutorial-step"><span class="tutorial-num">۳</span><span>خروجی برنامه در پایین نمایش داده می‌شود.</span></div>
        <div class="tutorial-step"><span class="tutorial-num">۴</span><span>از نوار کناری مثال‌ها را برای یادگیری باز کنید.</span></div>
        <div class="tutorial-step"><span class="tutorial-num">۵</span><span>برای جمع‌کردن خروجی، روی عنوان آن ضربه بزنید.</span></div>
        <div class="tutorial-step"><span class="tutorial-num">۶</span><span>برای باز کردن فایل از دکمهٔ 📂 و برای ذخیره از 💾 استفاده کنید.</span></div>
      </div>
    </div>
  </div>

  <!-- ورودی مخفی فایل (برای باز کردن) -->
  <input type="file" id="file-input" accept=".kolang,.txt,.kl" style="display:none" />

  <!-- ویرایشگر -->
  <div id="editor"></div>

  <!-- پنل خروجی -->
  <div id="output-panel">
    <div id="output-header">
      <span class="output-title">خروجی</span>
      <span class="output-chevron">▾</span>
    </div>
    <pre id="output">(خروجی خالی)</pre>
  </div>

  <script>${bundleJS}</script>
</body>
</html>`
}

module.exports = { buildEditorHTML }
