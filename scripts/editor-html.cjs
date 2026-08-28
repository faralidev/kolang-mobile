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
  /* ─── متغیرهای رنگ (Catppuccin Mocha = تیره، Latte = روشن) ─── */
  :root{
    --bg:#1e1e2e;--mantle:#181825;--crust:#11111b;
    --surface0:#313244;--surface1:#45475a;--surface2:#585b70;
    --text:#cdd6f4;--subtext0:#a6adc8;--subtext1:#bac2de;
    --overlay0:#6c7086;--overlay1:#7f849c;
    --green:#a6e3a1;--red:#f38ba8;--peach:#fab387;
    --mauve:#cba6f7;--blue:#89b4fa;--yellow:#f9e2af;
    --run-text:#1e1e2e;
  }
  body.light{
    --bg:#eff1f5;--mantle:#e6e9ef;--crust:#dce0e8;
    --surface0:#ccd0da;--surface1:#bcc0cc;--surface2:#acb0be;
    --text:#4c4f69;--subtext0:#6c6f85;--subtext1:#5c5f77;
    --overlay0:#9ca0b0;--overlay1:#8c8fa1;
    --green:#40a02b;--red:#d20f39;--peach:#fe640b;
    --mauve:#8839ef;--blue:#1e66f5;--yellow:#df8e1d;
    --run-text:#eff1f5;
  }

  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{height:100%;margin:0;overscroll-behavior:none}
  body{
    display:flex;flex-direction:column;
    background:var(--bg);color:var(--text);
    font-family:Vazirmatn,"Iranian Sans","Segoe UI",system-ui,sans-serif;
    padding-top:env(safe-area-inset-top);
    padding-bottom:env(safe-area-inset-bottom);
    transition:background 0.2s ease,color 0.2s ease;
  }

  /* ─── نوار بالا ─── */
  .topbar{
    display:flex;align-items:center;gap:6px;
    padding:8px 12px;
    background:var(--mantle);
    border-bottom:1px solid var(--surface0);
    flex-shrink:0;
    direction:ltr;
    transition:margin-right 0.25s ease;
  }
  .topbar-title{
    color:var(--text);font-weight:700;font-size:15px;
    flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    direction:rtl;
  }
  .topbar-btn{
    display:flex;align-items:center;justify-content:center;gap:4px;
    min-height:40px;min-width:40px;
    padding:8px 12px;border-radius:10px;border:none;
    font-family:inherit;font-size:14px;font-weight:600;
    cursor:pointer;white-space:nowrap;
  }
  .btn-menu{background:var(--surface0);color:var(--text);font-size:18px;padding:8px 12px}
  .btn-menu:active{background:var(--surface1)}
  .btn-file{background:var(--surface0);color:var(--text);font-size:16px;padding:8px 10px}
  .btn-file:active{background:var(--surface1)}
  .btn-run{background:var(--green);color:var(--run-text)}
  .btn-run:active{opacity:0.8}
  .btn-theme{background:transparent;border:none;font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px;border-radius:8px}
  .btn-theme:active{background:var(--surface0)}

  /* ─── نوار تب (نام فایل فعلی) ─── */
  #tab-bar{
    display:flex;align-items:center;
    padding:4px 12px;
    background:var(--crust);
    border-bottom:1px solid var(--surface0);
    flex-shrink:0;
    transition:margin-right 0.25s ease,background 0.2s ease;
  }
  .tab-item{
    display:flex;align-items:center;gap:6px;
    padding:6px 12px;
    background:var(--mantle);
    border-radius:8px 8px 0 0;
    color:var(--text);font-size:12px;
    cursor:pointer;
    max-width:200px;
  }
  .tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tab-icon{font-size:13px}

  /* ─── پنل راهنما ─── */
  /* گوشی: dropdown تمام‌صفحه — از بالا پایین می‌آید */
  /* پیش‌فرض visibility:hidden تا قبل از آماده‌شدن JS فلاش نزند */
  #sidebar{
    position:fixed;top:0;left:0;right:0;bottom:0;
    width:100%;height:100%;
    background:var(--mantle);
    transform:translateY(-100%);
    transition:transform 0.25s ease,background 0.2s ease;
    z-index:1000;
    display:flex;flex-direction:column;
    overflow:hidden;
    visibility:hidden;
  }
  #sidebar.ready{visibility:visible}
  #sidebar.open{transform:translateY(0)}

  /* تبلت: push layout از راست */
  @media (min-width:768px){
    #sidebar{
      top:0;right:0;bottom:0;left:auto;
      width:320px;height:100%;
      transform:translateX(100%);
      z-index:auto;
    }
    #sidebar.open{transform:translateX(0)}
  }

  :root{--panel-w:0px}
  /* فقط روی تبلت margin-right اعمال می‌شود (push). روی گوشی full-screen است. */
  @media (min-width:768px){
    body.sidebar-open .topbar,
    body.sidebar-open #tab-bar,
    body.sidebar-open #editor,
    body.sidebar-open #output-panel{margin-right:var(--panel-w)}
  }

  /* نوار ناوبری بالا (قبلی/بعدی/گام) */
  .sidebar-nav{
    display:flex;align-items:center;gap:6px;
    padding:10px 12px;
    border-bottom:1px solid var(--surface0);
    flex-shrink:0;
  }
  .sidebar-nav-title{
    color:var(--text);font-weight:700;font-size:14px;
    flex:1;white-space:nowrap;
  }
  .nav-btn{
    background:var(--surface1);color:var(--text);border:none;
    border-radius:8px;padding:6px 10px;
    font-family:inherit;font-size:12px;font-weight:600;
    cursor:pointer;min-height:32px;min-width:32px;
    display:flex;align-items:center;gap:3px;
  }
  .nav-btn:active{background:var(--surface2)}
  .nav-btn:disabled{opacity:0.3;cursor:default}
  .nav-progress{color:var(--subtext0);font-size:11px;white-space:nowrap}

  .sidebar-close{
    background:none;border:none;color:var(--subtext0);
    font-size:20px;cursor:pointer;padding:4px 8px;
    min-width:36px;min-height:36px;
    border-radius:6px;
  }
  .sidebar-close:active{background:var(--surface0)}

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
  .help-section{border-bottom:1px solid var(--surface0)}
  .help-section-title{
    padding:14px 16px;
    color:var(--text);font-size:14px;font-weight:600;
    cursor:pointer;
    min-height:44px;display:flex;align-items:center;gap:8px;
    border-right:3px solid transparent;
    transition:background 0.15s;
  }
  .help-section-title:active{background:var(--surface0)}
  .help-section.active .help-section-title{
    background:var(--surface0);
    border-right-color:var(--mauve);
    color:var(--mauve);
  }
  .help-section-chevron{color:var(--overlay0);font-size:11px;transition:transform 0.2s;margin-right:auto}
  .help-section.active .help-section-chevron{transform:rotate(90deg)}
  .help-section-body{display:none;padding:8px 16px 14px}
  .help-section.active .help-section-body{display:block}

  .help-explanation{
    color:var(--subtext1);font-size:13px;line-height:1.7;
    margin-bottom:12px;
  }
  .help-action{
    background:var(--surface0);border-radius:8px;padding:8px 12px;
    color:var(--peach);font-size:12px;line-height:1.5;
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
    flex-shrink:0;background:var(--mantle);
    border-top:1px solid var(--surface0);
    max-height:45vh;transition:max-height 0.2s ease,margin-right 0.25s ease,background 0.2s ease;
    display:flex;flex-direction:column;
  }
  #output-panel.collapsed{max-height:44px}
  #output-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;cursor:pointer;
    border-bottom:1px solid var(--surface0);
  }
  #output-panel.collapsed #output-header{border-bottom:none}
  .output-title{color:var(--subtext0);font-size:13px;font-weight:600}
  .output-chevron{color:var(--overlay0);font-size:12px;transition:transform 0.2s}
  #output-panel.collapsed .output-chevron{transform:rotate(-90deg)}
  #output{
    padding:10px 14px;overflow-y:auto;flex:1;
    white-space:pre-wrap;direction:rtl;text-align:right;
    font-family:Vazirmatn,"SF Mono",Menlo,monospace;font-size:13px;
    color:var(--text);line-height:1.6;
  }
  #output.running{color:var(--subtext0)}
  #output.error{color:var(--red)}
</style>
</head>
<body>

  <!-- نوار بالا: دکمهٔ تم و عنوان در چپ، دکمه‌ها در راست -->
  <div class="topbar">
    <button id="theme-toggle-btn" class="btn-theme" title="تغییر تم">☀️</button>
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

  <!-- پنل راهنما (روی گوشی: تمام‌صفحه، روی تبلت: push از راست) -->
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
