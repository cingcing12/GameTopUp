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

const formatErrorDetails = (details) => {
  if (!details) return 'Delivery issue'
  let str = details.toString()
  str = str.replace(/moogold\s*callback:\s*/gi, '')
  str = str.replace(/moogold:\s*/gi, '')
  str = str.replace(/moogold\s*/gi, '')
  str = str.replace(/rapidapi\s*/gi, '')
  if (str.toLowerCase().includes('refunded')) {
    return 'Delivery could not be completed (Refunded)'
  }
  if (str.toLowerCase().includes('incorrect-details') || str.toLowerCase().includes('invalid player')) {
    return 'Incorrect Player ID or Zone ID'
  }
  return str.trim() || 'Delivery issue'
}

// 2-Part Status Helpers: Payment & Diamond Delivery
const getPaymentBadgeClass = (tx) => {
  const p = tx.paymentStatus || ((tx.status === 'completed' || tx.status === 'processing' || tx.status === 'failed') ? 'paid' : 'unpaid')
  if (p === 'paid') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  if (p === 'refunded') return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
  if (p === 'failed') return 'bg-red-500/10 text-red-400 border-red-500/30'
  return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
}

const getPaymentDotClass = (tx) => {
  const p = tx.paymentStatus || ((tx.status === 'completed' || tx.status === 'processing' || tx.status === 'failed') ? 'paid' : 'unpaid')
  if (p === 'paid') return 'bg-emerald-400'
  if (p === 'refunded') return 'bg-purple-400'
  if (p === 'failed') return 'bg-red-400'
  return 'bg-amber-400'
}

const getPaymentLabel = (tx) => {
  const p = tx.paymentStatus || ((tx.status === 'completed' || tx.status === 'processing' || tx.status === 'failed') ? 'paid' : 'unpaid')
  if (p === 'paid') return 'Paid'
  if (p === 'refunded') return 'Refunded'
  if (p === 'failed') return 'Payment Failed'
  return 'Unpaid'
}

const getDeliveryBadgeClass = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  if (d === 'sending' || tx.status === 'processing') return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  if (d === 'failed' || tx.status === 'failed') return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
}

const getDeliveryDotClass = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return 'bg-emerald-400'
  if (d === 'failed' || tx.status === 'failed') return 'bg-rose-400'
  return 'bg-gray-400'
}

const getDeliveryLabel = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return 'Delivered'
  if (d === 'sending' || tx.status === 'processing') return 'Sending Diamonds'
  if (d === 'failed' || tx.status === 'failed') return 'Delivery Failed'
  return 'Pending'
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
              <p v-if="(tx.deliveryStatus === 'failed' || tx.status === 'failed') && tx.errorDetails" class="text-xs text-rose-400 mt-1 flex items-center gap-1 font-medium">
                ⚠️ {{ formatErrorDetails(tx.errorDetails) }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-4 sm:gap-6">
            <div class="text-right">
              <p class="text-xs text-gray-400 font-medium">Item</p>
              <p class="font-bold text-white">{{ tx.amount }} 💎</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-400 font-medium">Price</p>
              <p class="font-bold text-primary">${{ tx.price.toFixed(2) }}</p>
            </div>

            <!-- 2-Part Status Badges -->
            <div class="flex items-center gap-2">
              <!-- Part 1: Payment Status -->
              <div class="flex flex-col items-end">
                <span 
                  class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shadow-sm"
                  :class="getPaymentBadgeClass(tx)"
                  :title="'Payment: ' + getPaymentLabel(tx)"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="getPaymentDotClass(tx)"></span>
                  {{ getPaymentLabel(tx) }}
                </span>
              </div>

              <!-- Part 2: Delivery Status -->
              <div class="flex flex-col items-end">
                <span 
                  class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 shadow-sm"
                  :class="getDeliveryBadgeClass(tx)"
                  :title="'Delivery: ' + getDeliveryLabel(tx)"
                >
                  <span v-if="(tx.deliveryStatus === 'sending' || tx.status === 'processing')" class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  <span v-else class="w-1.5 h-1.5 rounded-full" :class="getDeliveryDotClass(tx)"></span>
                  {{ getDeliveryLabel(tx) }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
