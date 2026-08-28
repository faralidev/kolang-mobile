// App.js — ویرایشگر کلنگ برای موبایل
// React Native → iOS و اندروید. CodeMirror داخل WebView رندر می‌شود و
// مفسر WASM هم در همان WebView اجرا می‌شود. همهٔ وابستگی‌ها به‌صورت محلی
// باندل شده‌اند (dist/webview-bundle.js) — هیچ درخواست CDN وجود ندارد.

import React, { useCallback, useRef, useState } from 'react'
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

// باندل JS ویرایشگر وب‌‌ویو — در زمان build (scripts/build-webview.cjs) تولید
// می‌شود. به‌صورت رشته import می‌شود تا در محیط React Native (metro) کار کند.
// اگر فایل موجود نباشد (مثلاً قبل از اجرای build)، رشتهٔ خالی استفاده می‌شود.
let WEBVIEW_BUNDLE = ''
try {
  WEBVIEW_BUNDLE = require('./dist/webview-bundle-string.js')
} catch (_) {
  // قبل از اولین build — HTML بدون باندل لود می‌شود (ویرایشگر خالی)
}

// تابع ساخت HTML از ماژول مشترک (همان منبعی که build-pages.cjs استفاده می‌کند)
const { buildEditorHTML } = require('./scripts/editor-html.cjs')

const SEED_CODE = '«سلام دنیا!» بنویس'

const C = {
  base: '#1e1e2e', mantle: '#181825', surface0: '#313244', surface1: '#45475a',
  text: '#cdd6f4', subtext0: '#a6adc8', subtext1: '#bac2de',
  green: '#a6e3a1', red: '#f38ba8', peach: '#fab387', mauve: '#cba6f7',
  blue: '#89b4fa', yellow: '#f9e2af', teal: '#94e2d5',
}

// ─── خواندن باندل JS ──────────────────────────────────────────────────────

function getBundleJS() {
  if (WEBVIEW_BUNDLE) return WEBVIEW_BUNDLE
  // در محیط Node/تست: تلاش برای خواندن مستقیم از فایل
  try {
    if (typeof require !== 'undefined') {
      const path = require('path')
      const fsMod = require('fs')
      return fsMod.readFileSync(path.resolve(__dirname, 'dist', 'webview-bundle.js'), 'utf8')
    }
  } catch (_) {}
  return ''
}

export default function App() {
  const webViewRef = useRef(null)
  const [editorCode, setEditorCode] = useState(SEED_CODE)
  const [output, setOutput] = useState({ text: '(خروجی خالی)', error: false })
  const [status, setStatus] = useState('loading')
  const [html, setHtml] = useState(null)

  // باندل JS را بخوان و HTML را بساز
  React.useEffect(() => {
    const bundle = getBundleJS()
    setHtml(buildEditorHTML(bundle))
  }, [])

  const statusLabel =
    status === 'ready' ? 'مفسر آماده' : status === 'error' ? 'خطای مفسر' : 'بارگذاری…'
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
      } else if (message.type === 'running') {
        setOutput({ text: 'در حال اجرا…', error: false })
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
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.base} />
      <View style={styles.rnHeader}>
        <View style={styles.statusWrap}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.rnRunBtn, pressed && styles.rnRunBtnPressed]}
          onPress={runCode}
        >
          <Text style={styles.rnRunBtnText}>▶ اجرا</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        {html ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html }}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            style={styles.webview}
          />
        ) : (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>در حال بارگذاری…</Text>
          </View>
        )}
      </View>
      <View style={styles.outputPanel}>
        <Text style={styles.outputLabel}>خروجی</Text>
        <Text style={[styles.outputText, output.error && styles.outputError]}>{output.text}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.base },
  rnHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.mantle, paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.surface0,
  },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: C.subtext0, fontSize: 12 },
  rnRunBtn: { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, minHeight: 40 },
  rnRunBtnPressed: { opacity: 0.7 },
  rnRunBtnText: { color: C.base, fontWeight: '700', fontSize: 14 },
  body: { flex: 1 },
  webview: { flex: 1, backgroundColor: C.base },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: C.subtext0, fontSize: 14 },
  outputPanel: {
    minHeight: 80, maxHeight: 180, backgroundColor: C.mantle, padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.surface0,
  },
  outputLabel: { color: C.subtext0, fontSize: 12, marginBottom: 4 },
  outputText: { color: C.text, fontSize: 13, direction: 'rtl', textAlign: 'right' },
  outputError: { color: C.red },
})
