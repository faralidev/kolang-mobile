// App.js — ویرایشگر کلنگ برای موبایل
// React Native → iOS و اندروید. CodeMirror داخل WebView رندر می‌شود و
// مفسر WASM هم در همان WebView اجرا می‌شود (WebView از WebAssembly پشتیبانی می‌کند).

import React, { useCallback, useRef, useState } from 'react'
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

const SEED_CODE = '«سلام دنیا!» بنویس'

const C = {
  base: '#1e1e2e', mantle: '#181825', surface0: '#313244', text: '#cdd6f4',
  subtext0: '#a6adc8', green: '#a6e3a1', red: '#f38ba8', peach: '#fab387',
}

// سند HTML میزبان CodeMirror + مفسر WASM کلنگ. TODO: باندل محلی CDN برای آفلاین.
function buildEditorHTML() {
  return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>ویرایشگر کلنگ</title>
<style>
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:flex;flex-direction:column;background:#1e1e2e;color:#cdd6f4;font-family:Vazirmatn,"Segoe UI",system-ui,sans-serif}
#editor{flex:1;min-height:0;overflow:hidden}
.cm-editor{height:100%;font-size:15px}
#output{min-height:72px;max-height:40%;overflow:auto;padding:10px 14px;border-top:1px solid #313244;background:#181825;color:#cdd6f4;white-space:pre-wrap;direction:rtl;text-align:right;font-family:Vazirmatn,"SF Mono",Menlo,monospace}
#output.running{color:#a6adc8}#output.error{color:#f38ba8}
</style>
</head>
<body>
<div id="editor"></div>
<pre id="output">(خروجی خالی)</pre>
<script type="module">
  import { EditorView, keymap } from 'https://esm.sh/@codemirror/view@6.34.0'
  import { EditorState } from 'https://esm.sh/@codemirror/state@6.4.1'
  import { basicSetup } from 'https://esm.sh/codemirror@6.0.1'
  import { HighlightStyle, syntaxHighlighting } from 'https://esm.sh/@codemirror/language@6.10.2'
  import { tags } from 'https://esm.sh/@lezer/highlight@1.2.1'
  import { kolang } from 'https://esm.sh/@kolang/grammar@0.0.1/codemirror/kolang-syntax.js'
  import { loadWasm, runKolang } from 'https://unpkg.com/@kolang/interpreter@0.0.1/index.js'

  // پل پیام به React Native (روی وب: به والد iframe)
  const post = (payload) => {
    const data = JSON.stringify(payload)
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(data)
    else if (window.parent && window.parent !== window) window.parent.postMessage(data, '*')
  }
  const outputEl = document.getElementById('output')

  // پوستهٔ تیرهٔ CodeMirror (Catppuccin Mocha)
  const editorTheme = EditorView.theme({
    '&': { height: '100%', backgroundColor: '#1e1e2e', color: '#cdd6f4' },
    '.cm-content': { caretColor: '#f5e0dc', direction: 'rtl' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
      { backgroundColor: '#585b7040' },
    '.cm-activeLine': { backgroundColor: '#31324440' },
    '.cm-gutters': { backgroundColor: '#181825', color: '#585b70', border: 'none' },
    '.cm-matchingBracket': { backgroundColor: '#585b7040', outline: '1px solid #89b4fa80' },
  }, { dark: true })

  const kolangHighlight = HighlightStyle.define([
    { tag: tags.comment, color: '#7f849c', fontStyle: 'italic' },
    { tag: tags.string, color: '#a6e3a1' }, { tag: tags.number, color: '#fab387' },
    { tag: tags.bool, color: '#fab387', fontWeight: 'bold' }, { tag: tags.null, color: '#fab387' },
    { tag: tags.controlKeyword, color: '#cba6f7', fontWeight: 'bold' },
    { tag: tags.definitionKeyword, color: '#f9e2af', fontWeight: 'bold' },
    { tag: tags.keyword, color: '#89dceb', fontStyle: 'italic' }, { tag: tags.operatorKeyword, color: '#f38ba8' },
    { tag: tags.operator, color: '#89b4fa' },
    { tag: tags.standard(tags.function(tags.variableName)), color: '#a6e3a1' },
    { tag: tags.function(tags.variableName), color: '#89b4fa' },
    { tag: tags.typeName, color: '#94e2d5', fontStyle: 'italic' }, { tag: tags.namespace, color: '#74c7ec', fontStyle: 'italic' },
    { tag: tags.self, color: '#f38ba8', fontStyle: 'italic' },
    { tag: tags.variableName, color: '#cdd6f4' }, { tag: tags.punctuation, color: '#9399b2' },
  ])

  let editor = null

  async function runKolangNow(code) {
    const src = typeof code === 'string' ? code : (editor ? editor.state.doc.toString() : '')
    outputEl.textContent = 'در حال اجرا…'
    outputEl.className = 'running'
    try {
      await loadWasm()
      const { ok, output, error } = await runKolang(src)
      outputEl.textContent = error ? error : (output || '(خروجی خالی)')
      outputEl.className = error ? 'error' : ''
      post({ type: 'output', ok, output: output || '', error: error || '' })
    } catch (err) {
      const message = String((err && err.message) || err)
      outputEl.textContent = message
      outputEl.className = 'error'
      post({ type: 'output', ok: false, output: '', error: message })
    }
  }

  // پل اجرا — React Native از طریق injectJavaScript این را صدا می‌زند
  window.runKolang = runKolangNow

  async function boot() {
    try {
      await loadWasm()
      post({ type: 'status', status: 'ready' })
    } catch (err) {
      post({ type: 'status', status: 'error', detail: String((err && err.message) || err) })
    }
    editor = new EditorView({
      parent: document.getElementById('editor'),
      state: EditorState.create({
        doc: '«سلام دنیا!» بنویس',
        direction: 'rtl',
        extensions: [
          basicSetup, kolang(), editorTheme, syntaxHighlighting(kolangHighlight),
          keymap.of([{ key: 'Mod-Enter', run: () => { runKolangNow(); return true } }]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) post({ type: 'code', text: update.state.doc.toString() })
          }),
        ],
      }),
    })
  }

  boot()
</script>
</body>
</html>`
}

export default function App() {
  const webViewRef = useRef(null)
  const [editorCode, setEditorCode] = useState(SEED_CODE)
  const [output, setOutput] = useState({ text: '(خروجی خالی)', error: false })
  const [status, setStatus] = useState('loading')

  const statusLabel =
    status === 'ready' ? 'مفسر آماده است' : status === 'error' ? 'خطا در بارگذاری مفسر' : 'در حال بارگذاری مفسر…'
  const statusColor = status === 'ready' ? C.green : status === 'error' ? C.red : C.peach

  const onMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data)
      if (message.type === 'code') {
        setEditorCode(message.text)
      } else if (message.type === 'output') {
        setOutput({
          text: message.error ? message.error : (message.output || '(خروجی خالی)'),
          error: Boolean(message.error),
        })
      } else if (message.type === 'status') {
        setStatus(message.status === 'ready' ? 'ready' : 'error')
      }
    } catch (_) {
      // پیام ناخوانا را نادیده بگیر
    }
  }, [])

  const runCode = useCallback(() => {
    setOutput({ text: 'در حال اجرا…', error: false })
    webViewRef.current?.injectJavaScript(`window.runKolang(${JSON.stringify(editorCode)}); true;`)
  }, [editorCode])

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.base} />
      <View style={styles.header}>
        <Text style={styles.title}>ویرایشگر کلنگ</Text>
        <View style={styles.headerRight}>
          <View style={styles.statusWrap}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <Pressable style={({ pressed }) => [styles.runBtn, pressed && styles.runBtnPressed]} onPress={runCode}>
            <Text style={styles.runBtnText}>▶ اجرا</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.body}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: buildEditorHTML() }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={styles.webview}
        />
      </View>
      <View style={styles.outputPanel}>
        <Text style={styles.outputLabel}>خروجی</Text>
        <Text style={[styles.outputText, output.error && styles.outputError]}>{output.text}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.mantle, paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surface0,
  },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.subtext0, fontSize: 12 },
  runBtn: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  runBtnPressed: { opacity: 0.7 },
  runBtnText: { color: C.base, fontWeight: '700', fontSize: 14 },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: C.base },
  outputPanel: {
    minHeight: 84, maxHeight: 200, backgroundColor: C.mantle, padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.surface0,
  },
  outputLabel: { color: C.subtext0, fontSize: 12, marginBottom: 4 },
  outputText: { color: C.text, fontSize: 13, direction: 'rtl', textAlign: 'right' },
  outputError: { color: C.red },
})