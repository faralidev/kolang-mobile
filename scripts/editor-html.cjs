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

  /* ─── نوار تب (نام فایل فعلی) ─── */
  #tab-bar{
    display:flex;align-items:center;
    padding:4px 12px;
    background:#11111b;
    border-bottom:1px solid #313244;
    flex-shrink:0;
    transition:margin-right 0.25s ease;
  }
  .tab-item{
    display:flex;align-items:center;gap:6px;
    padding:6px 12px;
    background:#181825;
    border-radius:8px 8px 0 0;
    color:#cdd6f4;font-size:12px;
    cursor:pointer;
    max-width:200px;
  }
  .tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tab-icon{font-size:13px}

  /* ─── پنل راهنما (راست، push—not overlay) ─── */
  #sidebar{
    position:fixed;top:0;bottom:0;right:0;
    width:min(280px,70vw);
    background:#181825;
    border-left:1px solid #313244;
    transform:translateX(100%);
    transition:transform 0.25s ease;
    z-index:100;
    display:flex;flex-direction:column;
    overflow:hidden;
    box-shadow:-2px 0 12px rgba(0,0,0,0.3);
  }
  #sidebar.open{transform:translateX(0)}

  @media (min-width:768px){
    #sidebar{width:320px}
  }

  body.sidebar-open #editor,
  body.sidebar-open #output-panel,
  body.sidebar-open #tab-bar{margin-right:var(--panel-w)}
  :root{--panel-w:0px}

  /* نوار ناوبری بالا (قبلی/بعدی/گام) */
  .sidebar-nav{
    display:flex;align-items:center;gap:6px;
    padding:10px 12px;
    border-bottom:1px solid #313244;
    flex-shrink:0;
  }
  .sidebar-nav-title{
    color:#cdd6f4;font-weight:700;font-size:14px;
    flex:1;white-space:nowrap;
  }
  .nav-btn{
    background:#45475a;color:#cdd6f4;border:none;
    border-radius:8px;padding:6px 10px;
    font-family:inherit;font-size:12px;font-weight:600;
    cursor:pointer;min-height:32px;min-width:32px;
    display:flex;align-items:center;gap:3px;
  }
  .nav-btn:active{background:#585b70}
  .nav-btn:disabled{opacity:0.3;cursor:default}
  .nav-progress{color:#a6adc8;font-size:11px;white-space:nowrap}

  .sidebar-close{
    background:none;border:none;color:#a6adc8;
    font-size:20px;cursor:pointer;padding:4px 8px;
    min-width:36px;min-height:36px;
    border-radius:6px;
  }
  .sidebar-close:active{background:#313244}

  /* روی تبلت: ☰ و ✕ پنهان می‌شوند (پنل همیشه باز است) */
  @media (min-width:768px){
    #sidebar-toggle-btn{display:none}
    #sidebar .sidebar-close{display:none}
  }

  /* ─── فهرست بخش‌های راهنما ─── */
  #help-list{
    flex:1;overflow-y:auto;
    -webkit-overflow-scrolling:touch;
  }
  .help-section{border-bottom:1px solid #313244}
  .help-section-title{
    padding:14px 16px;
    color:#cdd6f4;font-size:14px;font-weight:600;
    cursor:pointer;
    min-height:44px;display:flex;align-items:center;gap:8px;
    border-right:3px solid transparent;
    transition:background 0.15s;
  }
  .help-section-title:active{background:#313244}
  .help-section.active .help-section-title{
    background:#313244;
    border-right-color:#cba6f7;
    color:#cba6f7;
  }
  .help-section-chevron{color:#585b70;font-size:11px;transition:transform 0.2s;margin-right:auto}
  .help-section.active .help-section-chevron{transform:rotate(90deg)}
  .help-section-body{display:none;padding:8px 16px 14px}
  .help-section.active .help-section-body{display:block}

  .help-explanation{
    color:#bac2de;font-size:13px;line-height:1.7;
    margin-bottom:12px;
  }
  .help-action{
    background:#313244;border-radius:8px;padding:8px 12px;
    color:#fab387;font-size:12px;line-height:1.5;
  }

  /* ─── ویرایشگر ─── */
  #editor{
    flex:1;min-height:0;overflow:hidden;
    transition:margin-right 0.25s ease;
  }
  .cm-editor{height:100%;font-size:15px}
  .cm-editor.cm-focused{outline:none}

  /* ─── پنل خروجی ─── */
  #output-panel{
    flex-shrink:0;background:#181825;
    border-top:1px solid #313244;
    max-height:45vh;transition:max-height 0.2s ease,margin-right 0.25s ease;
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

  <!-- نوار بالا: عنوان در چپ، دکمه‌ها در راست -->
  <div class="topbar">
    <span class="topbar-title">ویرایشگر کلنگ</span>
    <button id="new-btn" class="topbar-btn btn-file" title="فایل جدید">📄</button>
    <button id="open-btn" class="topbar-btn btn-file" title="باز کردن فایل">📂</button>
    <button id="save-btn" class="topbar-btn btn-file" title="ذخیره فایل">💾</button>
    <button id="run-btn" class="topbar-btn btn-run">▶ اجرا</button>
    <button id="sidebar-toggle-btn" class="topbar-btn btn-menu" title="راهنما">☰</button>
  </div>

  <!-- نوار تب (نام فایل) -->
  <div id="tab-bar">
    <div class="tab-item">
      <span class="tab-icon">📄</span>
      <span class="tab-name" id="tab-name">برنامه.kolang</span>
    </div>
  </div>

  <!-- پنل راهنما (راست) -->
  <div id="sidebar">
    <div class="sidebar-nav">
      <span class="sidebar-nav-title">راهنما</span>
      <button id="prev-btn" class="nav-btn" title="قبلی (Ctrl+→)">→ قبلی</button>
      <span id="nav-progress" class="nav-progress">گام ۱ از ۱۹</span>
      <button id="next-btn" class="nav-btn" title="بعدی (Ctrl+←)">بعدی ←</button>
      <button id="sidebar-close" class="sidebar-close">✕</button>
    </div>
    <div id="help-list"></div>
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
