<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, AlertCircle } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const { token } = useAuth()
const gameId = route.params.gameId

// Mock game data
const gameInfo = ref({
  name: '',
  publisher: '',
  image: '', 
  banner: ''
})

// Form state
const playerId = ref('')
const zoneId = ref('')
const selectedPackage = ref(null)
const selectedPayment = ref(null)

// Packages state
const packages = ref([])
const isLoading = ref(true)

// Computed state
const needsZoneId = computed(() => {
  if (!gameInfo.value.name) return false
  const name = gameInfo.value.name.toLowerCase()
  return name.includes('mobile legends') || name.includes('genshin')
})

// No mock fallback packages used

// Official Game Image Mappings
const officialGameImages = {
  '15145': 'https://i.pinimg.com/736x/8f/33/c8/8f33c8c2041285cb159dc23bc20d8f07.jpg',
  '6963': 'https://i.pinimg.com/736x/e4/df/eb/e4dfeb098e9bde765790c6efad37b5ba.jpg',
  '7847': 'https://i.pinimg.com/736x/11/ab/c7/11abc76ccf31b853be031bb0d3a5ce08.jpg',
  '428075': 'https://i.pinimg.com/736x/01/21/df/0121df4a7873a3df5cb4c5d33696fbcc.jpg',
  '608055': 'https://i.pinimg.com/736x/11/cb/c2/11cbc2cc3b2ff1c9b60b7d853be02081.jpg',
  '11641': 'https://i.pinimg.com/736x/85/3d/8e/853d8eddb58872f236df7a00f8da7905.jpg',
  '332': 'https://play-lh.googleusercontent.com/9nFkGjM4hHwO9O69uS_oV1L2uA5hGzW3Y9QpY4l6v7F8rK7M3W-8jL-m9aL_B9BfHw',
  '142921': 'https://i.pinimg.com/736x/2f/bc/d0/2fbcd0a158b091f0ebc5c56d11e95efd.jpg',
  '173557': 'https://i.pinimg.com/736x/5f/15/de/5f15def2e3ab476f8f533a0058ec188c.jpg',
  '560051': 'https://i.pinimg.com/736x/67/da/ea/67daeabb1da0b07b1d322ceecf7797e5.jpg'
}

const officialGameBanners = {
  '15145': 'https://static.wikia.nocookie.net/mobile-legends/images/a/a2/Mobile_Legends_Bang_Bang_Key_Art.jpg',
  '6963': 'https://w.forfun.com/fetch/f2/f2a4bc037f3747fceea0b7ccbc076d29.jpeg',
  '7847': 'https://wallpapercave.com/wp/wp10052737.jpg',
  '428075': 'https://images2.alphacoders.com/109/1090176.jpg',
  '608055': 'https://wallpapercave.com/wp/wp7858074.jpg'
}

const formatPackages = (variationData) => {
  return variationData.map(item => {
    let rawName = item.variation_name || '';
    let cleanName = rawName;
    let bonus = '';
    let tag = '';

    if (cleanName.includes(' - ')) {
        cleanName = cleanName.substring(cleanName.indexOf(' - ') + 3);
    }
    cleanName = cleanName.replace(/\(\#\d+\)/g, '').trim();
    if (cleanName.includes('(First Top-Up Bonus)')) {
        tag = 'First Top-Up';
        cleanName = cleanName.replace('(First Top-Up Bonus)', '').trim();
    }
    if (cleanName.includes('+')) {
        const parts = cleanName.split('+');
        cleanName = parts[0].trim();
        bonus = '+' + parts[1].trim();
        if (!cleanName.toLowerCase().includes('diamond') && bonus.toLowerCase().includes('diamond')) {
             cleanName += ' Diamonds'; 
        }
    }
    
    let parsedAmount = parseInt(item.variation_name);
    if (isNaN(parsedAmount)) {
        const match = rawName.match(/\d+/);
        parsedAmount = match ? parseInt(match[0]) : 0;
    }

    return {
      id: item.variation_id,
      name: cleanName,
      amount: parsedAmount,
      bonus: bonus,
      tag: tag,
      price: parseFloat(item.variation_price) || 0,
      icon: '💎',
      stock_status: item.stock_status
    }
  })
}

onMounted(async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  try {
    
    // 1. Fetch our own game data from MongoDB to get the uploaded Cloudinary cover
    const dbRes = await fetch(`${apiUrl}/api/games/${gameId}`);
    if (dbRes.ok) {
      const dbGame = await dbRes.json();
      gameInfo.value.name = dbGame.name;
      gameInfo.value.publisher = dbGame.publisher;
      gameInfo.value.image = dbGame.image;
      gameInfo.value.banner = dbGame.banner || officialGameBanners[dbGame.moogoldId || gameId] || gameInfo.value.banner;
      
      // Use the proper MooGold ID
      const moogoldProductId = dbGame.moogoldId || gameId;

      // 2. Fetch packages from MooGold
      const res = await fetch(`${apiUrl}/api/moogold/products/${moogoldProductId}`)
      const data = await res.json()
      
      if (res.ok && data && data.Variation) {
        packages.value = formatPackages(data.Variation)
      } else {
        packages.value = [] // Remove mock data fallback
      }
    } else {
      packages.value = []
    }
  } catch (err) {
    console.error("Could not load real packages.", err)
    packages.value = []
  } finally {
    setTimeout(() => { isLoading.value = false }, 600) // Artificial delay for skeleton
    selectedPayment.value = payments[0] // Auto-select KHQR
  }
  
  // Real-time SSE updates
  const eventSource = new EventSource(`${apiUrl}/api/updates/stream`);
  eventSource.addEventListener('game_updated', (event) => {
    const updatedGame = JSON.parse(event.data);
    if (updatedGame._id === gameId) {
      gameInfo.value.name = updatedGame.name;
      gameInfo.value.publisher = updatedGame.publisher;
      gameInfo.value.image = updatedGame.image;
      if (updatedGame.banner) {
        gameInfo.value.banner = updatedGame.banner;
      }
    }
  });

  eventSource.addEventListener('prices_updated', async (event) => {
    const updatedGame = JSON.parse(event.data);
    if (updatedGame._id === gameId) {
      try {
        const moogoldProductId = updatedGame.moogoldId || gameId;
        const res = await fetch(`${apiUrl}/api/moogold/products/${moogoldProductId}?ts=${Date.now()}`)
        const data = await res.json()
        if (res.ok && data && data.Variation) {
          packages.value = formatPackages(data.Variation)
        }
      } catch (err) {
        console.error("Error refreshing prices", err)
      }
    }
  });

  onUnmounted(() => {
    eventSource.close();
  });
})

const isValidating = ref(false)
const validatedName = ref('')
const validationError = ref('')

// Payment methods with reliable working logos
const payments = [
  { 
    id: 'khqr', 
    name: 'KHQR (Bakong)', 
    subtitle: 'Pay with ABA, ACLEDA, Wing, etc.',
    logo: 'https://play-lh.googleusercontent.com/Q27JPO0Plka8m3_-h2yw3Xu22Wedt3NJcxl1NPgMlaI6VRNcmSEPArvAcmnK1_TpmMBUlTsxjS1ycy0rRDFrmA', // Temporary fallback
    color: 'text-red-500', 
    bg: 'bg-red-500/10' 
  }
]

const isProcessing = ref(false)
const transactionSuccess = ref(false)
const transactionError = ref('')
const khqrModalOpen = ref(false)
const khqrData = ref(null)
const isVerifyingPayment = ref(false)

// Toast logic
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimeout = null
const showToast = (message, type = 'success') => {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.value = { show: true, message, type };
  toastTimeout = setTimeout(() => {
    toast.value.show = false;
  }, 3000);
}

watch(khqrModalOpen, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

const isCheckingId = ref(false)
const idCheckError = ref('')

const checkPlayerId = async () => {
  if (!playerId.value) return;
  
  isCheckingId.value = true
  idCheckError.value = ''
  validatedName.value = ''
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const moogoldProductId = gameId.length === 24 ? '332' : gameId; 

    const validateRes = await fetch(`${apiUrl}/api/moogold/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: moogoldProductId,
        dbGameId: gameId.length === 24 ? gameId : null,
        playerId: playerId.value,
        zoneId: zoneId.value
      })
    })
    
    const validateData = await validateRes.json()
    
    if (!validateRes.ok || validateData.err_code) {
      throw new Error(validateData.err_message || validateData.error || validateData.message || 'Invalid Player ID')
    } else {
      validatedName.value = validateData.username || 'Valid Account'
    }
  } catch (error) {
    console.error(error)
    idCheckError.value = error.message || 'Failed to check ID'
  } finally {
    isCheckingId.value = false
  }
}

let debounceTimer = null
watch([playerId, zoneId], ([newPlayerId, newZoneId]) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  
  validatedName.value = ''
  idCheckError.value = ''
  
  if (newPlayerId && (!needsZoneId.value || newZoneId)) {
    debounceTimer = setTimeout(() => {
      checkPlayerId()
    }, 600) // 600ms debounce
  }
})

const handleCheckout = async () => {
  if (!playerId.value) {
    transactionError.value = 'Please enter your Player ID'
    return
  }
  if (!selectedPackage.value) {
    transactionError.value = 'Please select a top-up package'
    return
  }
  if (!selectedPayment.value) {
    transactionError.value = 'Please select a payment method'
    return
  }
  
  isProcessing.value = true
  transactionError.value = ''
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const moogoldProductId = gameId.length === 24 ? '332' : gameId; 

    // 0. Check MooGold Balance
    try {
      const balanceRes = await fetch(`${apiUrl}/api/moogold/balance`)
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        const currentBalance = parseFloat(balanceData.balance || 0)
        // Check if balance is enough (comparing Moogold balance with our retail price as a safe check, 
        // though Moogold cost is usually lower. If it's less than retail, it's risky).
        if (currentBalance < selectedPackage.value.price) {
          throw new Error('System error: Insufficient provider balance. Please try again later.')
        }
      }
    } catch (err) {
      if (err.message.includes('Insufficient')) throw err;
      console.warn('Failed to check balance, proceeding anyway:', err)
    }

    // 1. Validate Player ID FIRST
    const validateRes = await fetch(`${apiUrl}/api/moogold/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: moogoldProductId,
        dbGameId: gameId.length === 24 ? gameId : null,
        playerId: playerId.value,
        zoneId: zoneId.value
      })
    })
    
    const validateData = await validateRes.json()
    
    if (!validateRes.ok || validateData.err_code) {
      throw new Error(validateData.err_message || validateData.error || validateData.message || 'Invalid Player ID')
    } else {
      validatedName.value = validateData.username || 'Valid Account'
    }

    // 1. Generate KHQR Code
    const qrRes = await fetch(`${apiUrl}/api/bakong/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedPackage.value.price,
        storeLabel: 'GameTopup'
      })
    })
    
    const qrData = await qrRes.json()
    if (qrData.success) {
      khqrData.value = qrData
      khqrModalOpen.value = true
      startCountdown()
    } else {
      throw new Error(qrData.message || 'Failed to generate QR Code')
    }
  } catch (error) {
    console.error(error)
    transactionError.value = error.message || 'Network Error. Could not generate QR.'
  } finally {
    isProcessing.value = false
  }
}

// Timer and Polling Logic
const timeRemaining = ref(300) // 5 minutes in seconds
const displayTime = computed(() => {
  const m = Math.floor(timeRemaining.value / 60).toString().padStart(2, '0')
  const s = (timeRemaining.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

let countdownInterval = null
let pollingInterval = null

const checkBakongPayment = async () => {
  if (!khqrData.value || !khqrData.value.md5) return;
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const res = await fetch(`${apiUrl}/api/bakong/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ md5: khqrData.value.md5 })
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      // Payment Verified! Stop polling and trigger topup.
      stopCountdown();
      await confirmPaymentAndTopUp();
    }
  } catch (err) {
    // Silent fail for polling errors, keep trying until timeout
  }
}

const startCountdown = () => {
  timeRemaining.value = 300
  if (countdownInterval) clearInterval(countdownInterval)
  if (pollingInterval) clearInterval(pollingInterval)
  
  // Timer
  countdownInterval = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--
    } else {
      stopCountdown()
      khqrModalOpen.value = false
      transactionError.value = 'Payment QR Code Expired.'
    }
  }, 1000)

  // Polling every 4 seconds
  pollingInterval = setInterval(() => {
    checkBakongPayment();
  }, 4000)
}

const stopCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval)
  if (pollingInterval) clearInterval(pollingInterval)
}

onUnmounted(() => {
  stopCountdown()
})

const confirmPaymentAndTopUp = async () => {
  isVerifyingPayment.value = true
  transactionError.value = ''
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    // 2. Actually execute the MooGold transaction
    const res = await fetch(`${apiUrl}/api/transactions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token.value ? { 'Authorization': `Bearer ${token.value}` } : {})
      },
      body: JSON.stringify({
        gameId: gameId.length === 24 ? gameId : '60a7d5c5f3b7b83d1c9f41a0', 
        playerId: playerId.value,
        serverId: zoneId.value,
        amount: selectedPackage.value.amount,
        productId: selectedPackage.value.id, 
        price: selectedPackage.value.price,
        paymentMethod: selectedPayment.value.id
      })
    })
    
    const data = await res.json()
    
    if (res.ok) {
      setTimeout(() => {
        isVerifyingPayment.value = false
        khqrModalOpen.value = false
        transactionSuccess.value = true
        showToast('Payment Verified! Top-Up Successful.', 'success')
      }, 1500)
    } else {
      throw new Error(data.message || data.error || 'Failed to create transaction')
    }
  } catch (error) {
    console.error(error)
    transactionError.value = error.message || 'Payment verified, but Top-Up failed.'
    isVerifyingPayment.value = false
    khqrModalOpen.value = false
  }
}

</script>

<template>
  <div class="container mx-auto px-4 md:px-6 py-12 relative z-10 max-w-7xl">
    
    <!-- Game Header Banner Skeleton -->
    <div v-if="isLoading" class="relative w-full h-56 md:h-72 rounded-[2rem] overflow-hidden mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 bg-white/5 animate-pulse">
      <div class="absolute bottom-0 left-0 p-5 md:p-8 flex items-end gap-4 md:gap-6 w-full">
        <div class="w-16 h-16 md:w-24 md:h-24 shrink-0 bg-white/10 rounded-xl md:rounded-2xl border-[2px] md:border-[3px] border-white/20"></div>
        <div class="w-full">
          <div class="w-24 h-6 md:h-8 bg-white/10 rounded-full mb-2 md:mb-3"></div>
          <div class="w-3/4 md:w-1/2 h-8 sm:h-10 md:h-12 bg-white/10 rounded-lg mb-2"></div>
          <div class="w-1/3 h-5 md:h-6 bg-white/10 rounded-lg"></div>
        </div>
      </div>
    </div>

    <!-- Game Header Banner -->
    <div v-else class="relative w-full h-56 md:h-72 rounded-[2rem] overflow-hidden mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 group">
      <img v-if="gameInfo.banner" :src="gameInfo.banner" class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
      <div v-else class="w-full h-full bg-gradient-to-r from-primary/20 to-purple-900/40"></div>
      
      <div class="absolute inset-0 bg-gradient-to-t from-darker via-darker/60 to-transparent"></div>
      
      <div class="absolute bottom-0 left-0 p-5 md:p-8 flex items-end gap-4 md:gap-6 w-full bg-gradient-to-t from-darker via-darker/80 to-transparent">
        <div class="w-16 h-16 md:w-24 md:h-24 shrink-0 bg-card rounded-xl md:rounded-2xl border-[2px] md:border-[3px] border-primary overflow-hidden shadow-[0_0_20px_rgba(255,215,0,0.3)]">
           <img v-if="gameInfo.image" :src="gameInfo.image" class="w-full h-full object-cover" />
           <div v-else class="w-full h-full bg-white/10"></div>
        </div>
        <div>
          <div class="inline-flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 rounded-full bg-white/10 border border-white/20 mb-2 md:mb-3 backdrop-blur-md">
            <span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span class="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider">Official Partner</span>
          </div>
          <h1 class="text-2xl sm:text-3xl md:text-5xl font-black font-outfit text-white mb-1 md:mb-2 tracking-tight drop-shadow-lg leading-tight">{{ gameInfo.name }}</h1>
          <p class="text-gray-300 font-medium text-sm md:text-lg drop-shadow-md">{{ gameInfo.publisher }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Main Content (Left) -->
      <div class="lg:col-span-2 space-y-8">
        
        <!-- Step 1: Account Info -->
        <div class="glass-card p-6 relative overflow-hidden group border border-white/10 bg-[#161622]/60 backdrop-blur-md rounded-2xl shadow-xl hover:border-white/20 transition-all duration-300">
          <h2 class="text-lg font-semibold text-white mb-5 flex items-center gap-3">
            <span class="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Account Details
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div :class="{'md:col-span-2': !needsZoneId}">
              <label class="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Player ID</label>
              <input v-model="playerId" type="text" placeholder="Enter Player ID" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all placeholder:text-gray-600">
            </div>
            <div v-if="needsZoneId">
              <label class="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Zone ID</label>
              <input v-model="zoneId" type="text" placeholder="Enter Zone ID" class="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all placeholder:text-gray-600">
            </div>
          </div>
          
          <div class="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center h-9">
            <!-- Loading Indicator -->
            <div v-if="isCheckingId" class="text-gray-400 text-sm font-medium flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <span class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              Verifying...
            </div>
            
            <div v-else-if="validatedName" class="text-emerald-400 text-sm font-medium flex items-center gap-1.5 bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              {{ validatedName }}
            </div>
            <div v-else-if="idCheckError" class="text-red-400 text-sm font-medium flex items-center gap-1.5 bg-red-400/10 px-3 py-1.5 rounded-lg border border-red-400/20">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              {{ idCheckError }}
            </div>
          </div>
        </div>

        <!-- Step 2: Select Package -->
        <div class="glass-card p-6 relative overflow-hidden group border border-white/10 bg-[#161622]/60 backdrop-blur-md rounded-2xl shadow-xl hover:border-white/20 transition-all duration-300">
          <h2 class="text-lg font-semibold text-white mb-5 flex items-center gap-3">
            <span class="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Select Top-Up
          </h2>
          
          <div v-if="isLoading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div v-for="i in 6" :key="i" class="bg-white/5 border border-white/5 rounded-xl p-4 h-28 animate-pulse"></div>
          </div>
          <div v-else-if="packages.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button 
              v-for="pkg in packages" 
              :key="pkg.id"
              @click="pkg.stock_status !== 'outofstock' && (selectedPackage = pkg)"
              class="relative border rounded-xl p-4 text-left transition-all duration-300 overflow-hidden flex flex-col justify-between h-full group"
              :class="[
                pkg.stock_status === 'outofstock' ? 'bg-black/40 border-white/5 cursor-not-allowed opacity-60' : 'bg-white/5 hover:bg-white/10 cursor-pointer',
                selectedPackage?.id === pkg.id ? 'border-primary shadow-[0_0_15px_rgba(255,215,0,0.1)] bg-primary/5 -translate-y-0.5' : 'border-white/5'
              ]"
              :disabled="pkg.stock_status === 'outofstock'"
            >
              <!-- Selected Badge -->
              <div v-if="selectedPackage?.id === pkg.id" class="absolute top-2 right-2 text-primary">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
              </div>

              <!-- Tag (First Top Up) -->
              <div v-if="pkg.tag && pkg.stock_status !== 'outofstock'" class="absolute top-0 left-0 bg-red-500/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br text-center">
                {{ pkg.tag }}
              </div>
              
              <!-- Out of Stock Badge -->
              <div v-if="pkg.stock_status === 'outofstock'" class="absolute top-0 left-0 bg-gray-600/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br text-center">
                OUT OF STOCK
              </div>

              <!-- Icon & Amount -->
              <div class="mt-1">
                <div class="text-xl mb-1 transform transition-transform group-hover:scale-110 origin-left inline-block">{{ pkg.icon }}</div>
                <div class="font-semibold text-white text-sm leading-tight">{{ pkg.name }}</div>
                <div v-if="pkg.bonus" class="text-[10px] text-primary font-medium mt-0.5">{{ pkg.bonus }}</div>
              </div>
              
              <!-- Price Footer -->
              <div class="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                <div class="text-xs font-semibold text-gray-400">Price</div>
                <div class="text-sm font-bold text-white">${{ pkg.price.toFixed(2) }}</div>
              </div>
            </button>
          </div>
          <div v-else class="text-center py-10 bg-white/5 rounded-xl border border-white/10">
            <svg class="w-12 h-12 mx-auto text-gray-500 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="text-gray-300 font-semibold mb-1">No packages available</p>
            <p class="text-xs text-gray-500 max-w-xs mx-auto">We are unable to fetch the top-up items right now. Please try again later.</p>
          </div>
        </div>

      </div>

      <!-- Sidebar (Right) -->
      <div class="space-y-8 lg:sticky lg:top-28 self-start">
        
        <!-- Step 3: Payment Method -->
        <div class="glass-card p-6 relative overflow-hidden group border border-white/10 bg-[#161622]/60 backdrop-blur-md rounded-2xl shadow-xl hover:border-white/20 transition-all duration-300">
          <h2 class="text-lg font-semibold text-white mb-5 flex items-center gap-3">
            <span class="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Payment
          </h2>
          
          <div class="space-y-4">
            <button 
              v-for="pay in payments" 
              :key="pay.id"
              @click="selectedPayment = pay"
              class="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 transition-all duration-300 overflow-hidden relative group"
              :class="selectedPayment?.id === pay.id ? 'border-primary ring-1 ring-primary/50 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-primary/10 scale-[1.02]' : 'hover:bg-white/10 hover:border-white/20'"
            >
              <!-- Background Glow Effect for Selected -->
              <div v-if="selectedPayment?.id === pay.id" class="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none"></div>
              
              <div class="flex items-center gap-4 relative z-10">
                <!-- KHQR Custom Logo Badge -->
                <div class="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden border-2 border-white/20">
                   <img src="/bakong-logo.png" alt="Bakong Logo" class="w-full h-full object-cover">
                </div>
                
                <div class="text-left">
                  <div class="font-bold text-base text-white mb-0.5">{{ pay.name }}</div>
                  <div class="text-[11px] font-medium text-gray-400">{{ pay.subtitle }}</div>
                </div>
              </div>
              
              <!-- Checkmark / Radio indicator -->
              <div class="relative z-10 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all duration-300"
                   :class="selectedPayment?.id === pay.id ? 'border-primary bg-primary text-black' : 'border-gray-500/50 bg-transparent'">
                <svg v-if="selectedPayment?.id === pay.id" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </button>
          </div>
        </div>

        <!-- Checkout Summary -->
        <div v-if="transactionSuccess" class="glass-card p-8 border border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.15)] text-center animate-fade-in relative overflow-hidden">
          <div class="absolute inset-0 bg-green-500/5"></div>
          <div class="relative z-10">
            <div class="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 class="text-2xl font-black text-white mb-2">Order Successful!</h3>
            <p class="text-gray-400 mb-8 font-medium">Your premium currency is on its way.</p>
            <button @click="transactionSuccess = false" class="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all font-bold">Make Another Top-Up</button>
          </div>
        </div>

        <div v-else class="glass-card p-6 border border-white/10 bg-[#161622]/60 backdrop-blur-md rounded-2xl shadow-xl hover:border-white/20 transition-all duration-300">
          <h3 class="text-base font-semibold text-white mb-4 flex items-center gap-2">
            Summary
          </h3>
          
          <div class="space-y-3 text-xs mb-6">
            <div class="flex justify-between items-center text-gray-400">
              <span>Game</span>
              <span class="text-white font-medium max-w-[140px] truncate">{{ gameInfo.name }}</span>
            </div>
            <div class="flex justify-between items-center text-gray-400">
              <span>Item</span>
              <span class="text-white font-medium">{{ selectedPackage ? selectedPackage.name : 'None Selected' }}</span>
            </div>
            <div class="flex justify-between items-center pt-3 border-t border-white/10 mt-3">
              <span class="text-gray-300 font-semibold text-sm">Total</span>
              <span class="text-white font-bold text-lg">${{ selectedPackage ? selectedPackage.price.toFixed(2) : '0.00' }}</span>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="transactionError" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <svg class="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-red-400/90 text-xs">{{ transactionError }}</p>
          </div>

          <button 
            @click="handleCheckout"
            :disabled="isProcessing"
            class="w-full py-3 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden"
            :class="isProcessing ? 'bg-white/10 text-gray-400 cursor-not-allowed' : 'bg-primary text-darker hover:bg-yellow-400 shadow-lg hover:shadow-primary/30 active:scale-[0.98]'"
          >
            <span>{{ isProcessing ? 'Processing...' : 'Pay Now' }}</span>
          </button>
        </div>

      </div>
    </div>

    <!-- KHQR Payment Modal -->
    <Teleport to="body">
      <div v-if="khqrModalOpen" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="khqrModalOpen = false"></div>
        
        <div class="relative bg-darker border-2 border-primary/50 rounded-2xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(255,215,0,0.2)] animate-fade-in flex flex-col items-center">
          <button @click="khqrModalOpen = false" class="absolute top-4 right-4 text-gray-400 hover:text-white">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          
          <div class="text-primary font-black text-2xl mb-1">Scan to Pay</div>
          <p class="text-gray-400 text-sm mb-6 text-center">Use ABA, Acleda, or any KHQR supported app to scan.</p>
          
          <div class="bg-white p-4 rounded-xl shadow-inner mb-6 relative group flex items-center justify-center">
            <img :src="khqrData?.qrImage" class="w-64 h-64 object-contain" />
            
            <!-- Logo overlay in the center of QR code -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="bg-white p-1 rounded-xl shadow-md border-2 border-primary">
                <img src="/logo.jpg" class="w-12 h-12 rounded-lg object-cover" />
              </div>
            </div>

            <div class="absolute inset-0 border-4 border-dashed border-primary/50 rounded-xl pointer-events-none group-hover:border-primary transition-colors"></div>
          </div>
          
          <div class="flex flex-col items-center mb-8 w-full px-4">
            <!-- Show the validated game username -->
            <div v-if="validatedName" class="text-white text-sm font-bold bg-white/5 border border-white/10 px-4 py-2 rounded-lg mb-4 text-center w-full truncate shadow-inner">
              Account: <span class="text-primary">{{ validatedName }}</span>
            </div>

            <div class="text-3xl font-black text-white bg-darker/80 px-8 py-3 rounded-2xl border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              ${{ selectedPackage?.price.toFixed(2) }}
            </div>
          </div>
          
          <!-- Auto Check Status -->
          <div class="w-full bg-white/5 border border-white/10 rounded-xl p-4 mb-4 flex items-center justify-between">
             <div class="flex items-center gap-3">
               <div class="relative flex h-4 w-4">
                 <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                 <span class="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
               </div>
               <span class="text-gray-300 font-semibold text-sm">Awaiting Payment...</span>
             </div>
             <div class="text-primary font-mono font-bold text-lg bg-primary/10 px-2 py-0.5 rounded">{{ displayTime }}</div>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- Cool Custom Toast Alert -->
    <div 
      class="fixed bottom-6 right-6 z-[200] transition-all duration-500 transform"
      :class="toast.show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'"
    >
      <div 
        class="glass-card bg-[#161622]/90 backdrop-blur-xl border flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl"
        :class="toast.type === 'success' ? 'border-emerald-500/50 shadow-[0_10px_40px_rgba(16,185,129,0.2)]' : 'border-red-500/50 shadow-[0_10px_40px_rgba(239,68,68,0.2)]'"
      >
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'"
        >
          <CheckCircle2 v-if="toast.type === 'success'" class="w-6 h-6" />
          <AlertCircle v-else class="w-6 h-6" />
        </div>
        <p class="text-white font-bold text-sm pr-4">{{ toast.message }}</p>
      </div>
    </div>

  </div>
</template>
