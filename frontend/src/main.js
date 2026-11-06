import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import vue3GoogleLogin from 'vue3-google-login'

// Auto-reload when a new deployment invalidates old cached Vite chunks
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

const app = createApp(App)

app.use(router)

app.use(vue3GoogleLogin, {
  clientId: '865703162705-abofmbgpggv7h8jmepjnpa0ee3qk3885.apps.googleusercontent.com'
})

app.mount('#app')
