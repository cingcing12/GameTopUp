import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import vue3GoogleLogin from 'vue3-google-login'

const app = createApp(App)

app.use(router)

app.use(vue3GoogleLogin, {
  clientId: '865703162705-abofmbgpggv7h8jmepjnpa0ee3qk3885.apps.googleusercontent.com'
})

app.mount('#app')
