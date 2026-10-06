<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { setAuth } = useAuth()

const form = ref({
  email: '',
  password: ''
})
const isLoading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  isLoading.value = true
  errorMsg.value = ''
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Login failed')
    
    setAuth(data.user, data.token)
    router.push('/')
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    isLoading.value = false
  }
}

const handleGoogleLogin = async (response) => {
  isLoading.value = true
  errorMsg.value = ''
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Google Login failed')
    
    setAuth(data.user, data.token)
    router.push('/')
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-20 relative">
    <!-- Cool background blobs -->
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
    <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none"></div>

    <!-- Back Button -->
    <button @click="$router.push('/')" class="absolute top-6 left-6 md:top-10 md:left-10 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
      <span class="font-bold text-sm">Back to Home</span>
    </button>

    <div class="glass-card w-full max-w-md p-8 md:p-10 rounded-3xl border border-white/10 relative z-10 bg-[#12121a]/80 backdrop-blur-xl shadow-2xl">
      <div class="text-center mb-8">
        <img src="/logo.jpg" alt="GameTopup Logo" class="w-20 h-20 object-cover rounded-full mx-auto mb-4 border-2 border-primary/50 shadow-[0_0_15px_rgba(255,215,0,0.3)]" />
        <h1 class="text-4xl font-black font-outfit text-white mb-2">Welcome Back!</h1>
        <p class="text-gray-400">Login to top-up instantly</p>
      </div>

      <div class="flex justify-center mb-6 w-full overflow-hidden rounded-xl">
        <GoogleLogin :callback="handleGoogleLogin" />
      </div>

      <div class="flex items-center gap-4 mb-6">
        <div class="h-px bg-white/10 flex-1"></div>
        <span class="text-gray-500 text-sm font-medium">OR</span>
        <div class="h-px bg-white/10 flex-1"></div>
      </div>

      <div v-if="errorMsg" class="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
        {{ errorMsg }}
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Email Address</label>
          <input v-model="form.email" type="email" required placeholder="hello@gametopup.com" class="w-full bg-darker/80 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
        </div>
        <div>
          <label class="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Password</label>
          <input v-model="form.password" type="password" required placeholder="••••••••" class="w-full bg-darker/80 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
        </div>

        <button :disabled="isLoading" type="submit" class="w-full py-4 mt-4 font-black rounded-xl transition-all duration-300 text-lg flex items-center justify-center gap-2 relative overflow-hidden group bg-gradient-to-r from-primary to-yellow-500 text-darker hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:scale-[1.02]">
          {{ isLoading ? 'Logging in...' : 'Login' }}
        </button>
      </form>

      <p class="text-center text-gray-400 mt-8 font-medium">
        Don't have an account? 
        <router-link to="/signup" class="text-primary hover:text-yellow-300 transition-colors">Sign Up</router-link>
      </p>
    </div>
  </div>
</template>
