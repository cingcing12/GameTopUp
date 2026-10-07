<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'

const { user, token } = useAuth()
const transactions = ref([])
const loading = ref(true)

const fetchTransactions = async () => {
  if (!user.value || !token.value) {
    loading.value = false
    return
  }
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/transactions`, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })
    const data = await res.json()
    if (res.ok) {
      transactions.value = data
    } else if (res.status === 401) {
      logout()
      window.location.href = '/login'
    }
  } catch (error) {
    console.error('Failed to fetch history', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTransactions()
})

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  }).format(date)
}
</script>

<template>
  <div class="container mx-auto px-4 md:px-6 py-12">
    <div class="max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-black font-outfit text-white">Recent Transactions</h1>
        <button @click="fetchTransactions" class="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-primary/20 hover:text-primary transition-all group">
          <svg class="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
      </div>

      <div v-if="!user" class="text-center py-16 bg-card rounded-2xl border border-white/5 shadow-2xl">
        <div class="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        </div>
        <h2 class="text-2xl font-black text-white mb-3">Sign In Required</h2>
        <p class="text-gray-400 mb-8 max-w-sm mx-auto">Please sign in or create an account to view your recent transaction history.</p>
        <router-link to="/login" class="inline-flex items-center gap-2 bg-primary text-darker font-bold py-3 px-8 rounded-xl hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:scale-105 active:scale-95">
          Sign In Now
        </router-link>
      </div>

      <div v-else-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="glass-card h-24 animate-pulse rounded-2xl bg-white/5 border border-white/5"></div>
      </div>

      <div v-else-if="transactions.length === 0" class="text-center py-12 bg-card rounded-2xl border border-gray-800">
        <div class="text-6xl mb-4">📭</div>
        <h2 class="text-xl font-bold text-white mb-2">No Transactions Yet</h2>
        <p class="text-gray-400">Your recent top-ups will appear here.</p>
      </div>

      <div v-else class="space-y-4">
        <div v-for="tx in transactions" :key="tx._id" class="glass-card bg-[#12121a]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/30 transition-all hover:shadow-[0_8px_30px_rgba(255,215,0,0.1)] hover:-translate-y-1">
          
          <div class="flex items-center gap-4">
            <img v-if="tx.gameId?.image" :src="tx.gameId.image" class="w-12 h-12 rounded-xl object-cover shadow-inner border border-white/5" />
            <div v-else class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-white/5 bg-white/5 text-gray-400">
              🎮
            </div>
            <div>
              <h3 class="font-bold text-white text-lg">{{ tx.gameId?.name || 'Unknown Game' }}</h3>
              <p class="text-sm text-gray-300 font-semibold mb-0.5">ID: {{ tx.playerId }} <span v-if="tx.serverId">({{ tx.serverId }})</span></p>
              <p class="text-xs text-gray-500">{{ formatDate(tx.createdAt) }}</p>
            </div>
          </div>

          <div class="flex items-center gap-8">
            <div class="text-right">
              <p class="text-sm text-gray-400">Item</p>
              <p class="font-bold text-white">{{ tx.amount }} 💎</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-400">Price</p>
              <p class="font-bold text-primary">${{ tx.price.toFixed(2) }}</p>
            </div>
            <div class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                 :class="tx.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                         tx.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                         'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'">
              {{ tx.status }}
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
