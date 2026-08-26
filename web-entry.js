// web-entry.js — ورودی وب (react-native-web + Vite)
import { AppRegistry } from 'react-native'
import App from './App'
import { name as appName } from './app.json'

AppRegistry.registerComponent(appName, () => App)
AppRegistry.runApplication(appName, {
  rootTag: document.getElementById('root'),
})