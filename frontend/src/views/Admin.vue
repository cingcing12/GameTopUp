<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { 
  CheckCircle2, XCircle, Clock, Search, RefreshCw, 
  Activity, DollarSign, Users, Package, LayoutDashboard, 
  Settings, LogOut, ShieldAlert, ChevronRight, Gamepad2, UploadCloud, Image as ImageIcon,
  AlertCircle, LayoutTemplate, Plus, Edit, Trash2, Eye, EyeOff, Lock, Unlock, ListOrdered, FileText,
  Wallet, Star, Crop, ZoomIn, ZoomOut, RotateCcw, Move,
  Upload, Smartphone, Monitor
} from 'lucide-vue-next'

const router = useRouter()

// Native, untamperable fetch reference bound before any console scripts run
const rawFetch = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : fetch

// Authentication State
const isAdmin = ref(false)
const isServerVerified = ref(false)
const isVerifyingAuth = ref(true)
const emailInput = ref('')
const passwordInput = ref('')
const adminPinInput = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)

// Anti-tamper watchdog: if someone flips isAdmin in Console without isServerVerified, self-destruct!
watch(isAdmin, (newVal) => {
  if (newVal && !isServerVerified.value) {
    console.warn("Security Alert: Unauthorized client-side state tampering detected. Evicting session.");
    isAdmin.value = false;
    sessionStorage.clear();
    localStorage.clear();
    window.location.replace('/');
  }
})

// Authenticated fetch wrapper that sends token and handles token expiry/unauthorized
const authFetch = async (url, options = {}) => {
  const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')
  const headers = {
    ...(options.headers || {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await rawFetch(url, { ...options, headers })
    if (res.status === 401 || res.status === 403) {
      isServerVerified.value = false
      isAdmin.value = false
      sessionStorage.removeItem('adminToken')
      localStorage.removeItem('adminToken')
      showToast('Admin session expired or access denied. Please log in again.', 'error')
    }
    return res
  } catch (err) {
    throw err
  }
}

// Strictly verify the token with the server on page load
const checkAdminAuth = async () => {
  const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')
  if (!token) {
    isAdmin.value = false
    isServerVerified.value = false
    isVerifyingAuth.value = false
    return false
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await rawFetch(`${apiUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (res.ok && data.user && data.user.role === 'admin') {
      isServerVerified.value = true
      isAdmin.value = true
      isVerifyingAuth.value = false
      return true
    } else {
      logoutAdmin()
      isVerifyingAuth.value = false
      return false
    }
  } catch (e) {
    logoutAdmin()
    isVerifyingAuth.value = false
    return false
  }
}

// Confirm Dialog State
const confirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  isDanger: false,
  action: null
})

const openConfirmDialog = (title, message, confirmText, isDanger, action) => {
  confirmDialog.value = { isOpen: true, title, message, confirmText, isDanger, action }
}

const executeConfirm = async () => {
  if (confirmDialog.value.action) {
    await confirmDialog.value.action()
  }
  confirmDialog.value.isOpen = false
}

const handleAdminLogin = async () => {
  loginError.value = ''
  isLoggingIn.value = true
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await rawFetch(`${apiUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value,
        adminPin: adminPinInput.value
      })
    })
    
    const data = await res.json()
    
    if (res.ok && data.user && data.user.role === 'admin' && data.token) {
      sessionStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminToken', data.token)
      isServerVerified.value = true
      isAdmin.value = true
      fetchTransactions()
      fetchUsers()
      fetchPages()
      fetchSettings()
    } else {
      loginError.value = data.message || 'Invalid admin credentials or Master PIN'
    }
  } catch (error) {
    loginError.value = 'Server connection failed.'
  } finally {
    isLoggingIn.value = false
  }
}

const confirmLogout = () => {
  openConfirmDialog(
    'Sign Out',
    'Are you sure you want to log out of the admin panel?',
    'Yes, Logout',
    true,
    logoutAdmin
  )
}

const logoutAdmin = () => {
  isServerVerified.value = false
  isAdmin.value = false
  sessionStorage.removeItem('adminToken')
  localStorage.removeItem('adminToken')
  router.push('/')
}


// Dashboard State
const activeTab = ref('dashboard')
const transactions = ref([])
const games = ref([])
const searchQueryGames = ref('')
const filteredGamesList = computed(() => {
  if (!searchQueryGames.value) return games.value
  const q = searchQueryGames.value.toLowerCase()
  return games.value.filter(g => 
    (g.name && g.name.toLowerCase().includes(q)) || 
    (g.publisher && g.publisher.toLowerCase().includes(q))
  )
})

// MooGold Import State
const showMoogoldModal = ref(false)
const moogoldGames = ref([])
const searchMoogoldQuery = ref('')
const isFetchingMoogold = ref(false)

const filteredMoogoldGames = computed(() => {
  if (!searchMoogoldQuery.value) return moogoldGames.value
  const q = searchMoogoldQuery.value.toLowerCase()
  return moogoldGames.value.filter(g => 
    (g.name && g.name.toLowerCase().includes(q)) || 
    (g.post_title && g.post_title.toLowerCase().includes(q))
  )
})

const openMoogoldModal = async () => {
  showMoogoldModal.value = true
  if (moogoldGames.value.length === 0) {
    isFetchingMoogold.value = true
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const res = await authFetch(`${apiUrl}/api/moogold/games`)
      const data = await res.json()
      if (res.ok && data.games) {
        moogoldGames.value = data.games
      }
    } catch (error) {
      showToast('Failed to fetch MooGold games', 'error')
    } finally {
      isFetchingMoogold.value = false
    }
  }
}

const importMoogoldGame = async (mgGame) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: mgGame.name || mgGame.post_title,
        moogoldId: mgGame.ID || mgGame.moogoldId,
        publisher: 'MooGold',
        provider: 'moogold',
        image: mgGame.sampleImage || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
        rapidApiId: mgGame.rapidApiId || 'mobile-legends',
        isActive: true
      })
    })
    
    if (res.ok) {
      const newGame = await res.json()
      games.value.push(newGame)
      showToast(`${mgGame.name || mgGame.post_title} imported from MooGold!`, 'success')
      showMoogoldModal.value = false
    } else {
      showToast('Failed to import game', 'error')
    }
  } catch (error) {
    showToast('Error importing game', 'error')
  }
}

// MooGold Live Wallet State
const moogoldWalletBalance = ref(0)
const moogoldCurrency = ref('USD')
const isFetchingMoogoldBalance = ref(false)

const fetchMoogoldBalance = async () => {
  isFetchingMoogoldBalance.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/moogold/balance`)
    const data = await res.json()
    if (res.ok && data.success) {
      moogoldWalletBalance.value = data.balance_usd || data.balance || 0
      moogoldCurrency.value = data.currency || 'USD'
    }
  } catch (e) {
  } finally {
    isFetchingMoogoldBalance.value = false
  }
}

const users = ref([])
const isFetchingUsers = ref(false)
const selectedUserTransactions = ref(null)

const fetchUsers = async () => {
  isFetchingUsers.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/users`)
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (error) {
    showToast('Failed to fetch users', 'error')
  } finally {
    isFetchingUsers.value = false
  }
}

const toggleBlockUser = (user) => {
  const isBlocking = !user.isBlocked
  openConfirmDialog(
    isBlocking ? 'Block User' : 'Unblock User',
    `Are you sure you want to ${isBlocking ? 'block' : 'unblock'} user "${user.username}"?`,
    isBlocking ? 'Block User' : 'Unblock User',
    isBlocking,
    async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const res = await authFetch(`${apiUrl}/api/users/${user._id}/block`, {
          method: 'PUT'
        })
        const data = await res.json()
        if (res.ok) {
          user.isBlocked = data.isBlocked
          showToast(data.message, 'success')
        } else {
          throw new Error(data.message)
        }
      } catch (error) {
        showToast(error.message || 'Error blocking user', 'error')
      }
    }
  )
}

const deleteUser = (user) => {
  openConfirmDialog(
    'Delete User',
    `Are you sure you want to permanently delete user "${user.username}"? This action cannot be undone.`,
    'Delete User',
    true,
    async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const res = await authFetch(`${apiUrl}/api/users/${user._id}`, {
          method: 'DELETE'
        })
        if (res.ok) {
          users.value = users.value.filter(u => u._id !== user._id)
          showToast('User deleted successfully', 'success')
        } else {
          const data = await res.json()
          throw new Error(data.message)
        }
      } catch (error) {
        showToast(error.message || 'Error deleting user', 'error')
      }
    }
  )
}

const viewUserTransactions = async (userId) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/transactions?userId=${userId}`)
    if (res.ok) {
      selectedUserTransactions.value = await res.json()
    }
  } catch (error) {
    showToast('Failed to fetch user transactions', 'error')
  }
}

// Edit User State
const showEditUserModal = ref(false)
const editingUser = ref(null)
const isSavingUser = ref(false)
const userForm = ref({ username: '', email: '', balance: 0, role: 'user' })

const openEditUser = (user) => {
  editingUser.value = user
  userForm.value = {
    username: user.username,
    email: user.email,
    balance: user.balance || 0,
    role: user.role
  }
  showEditUserModal.value = true
}

const saveUser = async () => {
  isSavingUser.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/users/${editingUser.value._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userForm.value)
    })
    const data = await res.json()
    if (res.ok) {
      const index = users.value.findIndex(u => u._id === data._id)
      if (index !== -1) users.value[index] = data
      showToast('User updated successfully', 'success')
      showEditUserModal.value = false
    } else {
      throw new Error(data.message)
    }
  } catch (error) {
    showToast(error.message || 'Error updating user', 'error')
  } finally {
    isSavingUser.value = false
  }
}
const sliders = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const isUploading = ref({}) // track upload state per game id
const isUploadingBanner = ref({}) // track upload state for banner
const isUploadingSlider = ref({}) // track upload state for slider
const isUploadingPackageImage = ref({}) // track upload state per package id
const isSavingGameData = ref({}) // track save state for game data

// Slider CRUD state
const showSliderModal = ref(false)
const editingSlider = ref(null)
const isSavingSlider = ref(false)
const sliderForm = ref({
  title: '',
  subtitle: '',
  link: '',
  isActive: true,
  imageFile: null
})

// Custom Toast System
const toast = ref({ show: false, message: '', type: 'success' })
let toastTimeout = null;
// Pages CRUD state
const pages = ref([])
const showPageModal = ref(false)
const isSavingPage = ref(false)
const pageForm = ref({ slug: '', title: '', content: '' })

const fetchPages = async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/pages`)
    if (res.ok) {
      pages.value = await res.json()
    }
  } catch (error) {
    showToast('Failed to fetch pages', 'error')
  }
}

const openEditPage = (slug) => {
  const page = pages.value.find(p => p.slug === slug)
  if (page) {
    pageForm.value = { ...page }
  } else {
    pageForm.value = { slug, title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), content: '' }
  }
  showPageModal.value = true
}

const savePage = async () => {
  isSavingPage.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/pages/${pageForm.value.slug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageForm.value)
    })
    const data = await res.json()
    if (res.ok) {
      const index = pages.value.findIndex(p => p.slug === data.slug)
      if (index !== -1) pages.value[index] = data
      else pages.value.push(data)
      showToast('Page saved successfully', 'success')
      showPageModal.value = false
    } else {
      throw new Error(data.message)
    }
  } catch (error) {
    showToast(error.message || 'Error saving page', 'error')
  } finally {
    isSavingPage.value = false
  }
}

// Site Settings Management
const siteSettings = ref({
  telegramUsername: 'pheak_topup',
  telegramEnabled: true
})
const isSavingSettings = ref(false)
const isLoadingSettings = ref(false)

const fetchSettings = async () => {
  isLoadingSettings.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/settings`)
    if (res.ok) {
      const data = await res.json()
      siteSettings.value = {
        telegramUsername: data.telegramUsername || '',
        telegramEnabled: data.telegramEnabled !== false
      }
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    isLoadingSettings.value = false
  }
}

const saveSettings = async () => {
  isSavingSettings.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(siteSettings.value)
    })
    const data = await res.json()
    if (res.ok) {
      showToast('Settings saved successfully!', 'success')
    } else {
      throw new Error(data.message || 'Failed to save settings')
    }
  } catch (err) {
    showToast(err.message || 'Error saving settings', 'error')
  } finally {
    isSavingSettings.value = false
  }
}

// Pricing Management
const showPricingModal = ref(false)
const selectedGameForPricing = ref(null)
const gamePackages = ref([])
const isFetchingPackages = ref(false)
const isSavingPrices = ref(false)
const liveExchangeRate = ref(18050)

const applyBulkMargin = (percent) => {
  gamePackages.value.forEach(pkg => {
    const margin = pkg.originalPrice * (1 + percent / 100)
    pkg.customPrice = parseFloat(margin.toFixed(2))
  })
  showToast(`Applied +${percent}% profit margin to all items`, 'success')
}

const resetToOriginal = () => {
  gamePackages.value.forEach(pkg => {
    pkg.customPrice = pkg.originalPrice
  })
  showToast('Reset all sell prices to cost price', 'info')
}

const openPricingModal = async (game) => {
  selectedGameForPricing.value = game
  showPricingModal.value = true
  isFetchingPackages.value = true
  gamePackages.value = []
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const targetId = game.moogoldId || game._id
    const res = await authFetch(`${apiUrl}/api/moogold/products/${targetId}`)
    const data = await res.json()
    
    if (res.ok && data?.Variation) {
      const activeList = data.Variation.filter(p => p.stock_status === 'instock')
      const sortedList = (activeList.length > 0 ? activeList : data.Variation).sort((a, b) => (parseFloat(a.variation_price) || 0) - (parseFloat(b.variation_price) || 0))

      const featuredList = Array.isArray(game.featuredPackages) ? game.featuredPackages.map(String) : []

      gamePackages.value = sortedList.map(p => {
        let cleanName = p.variation_name || ''
        if (cleanName.includes(' - ')) {
          cleanName = cleanName.substring(cleanName.indexOf(' - ') + 3)
        }
        if (cleanName.includes(' (#')) {
          cleanName = cleanName.substring(0, cleanName.indexOf(' (#'))
        }
        const customP = game.customPrices && game.customPrices[p.variation_id.toString()]
        const unitPrice = parseFloat(p.variation_price || 0)
        const origPrice = parseFloat(p.original_price || unitPrice)

        return {
          id: p.variation_id.toString(),
          name: cleanName.trim(),
          originalPrice: origPrice,
          customPrice: customP !== undefined ? parseFloat(customP) : unitPrice,
          customImage: game.customImages && game.customImages[p.variation_id.toString()] ? game.customImages[p.variation_id.toString()] : null,
          isFeatured: featuredList.includes(p.variation_id.toString())
        }
      })
    }
  } catch (error) {
    showToast('Failed to fetch packages', 'error')
  } finally {
    isFetchingPackages.value = false
  }
}

const savePrices = async () => {
  if (!selectedGameForPricing.value) return
  isSavingPrices.value = true
  
  try {
    const customPrices = {}
    const featuredPackages = []

    gamePackages.value.forEach(p => {
      customPrices[p.id] = p.customPrice
      if (p.isFeatured) {
        featuredPackages.push(p.id)
      }
    })
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${selectedGameForPricing.value._id}/prices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrices, featuredPackages })
    })
    
    if (res.ok) {
      if (selectedGameForPricing.value) {
        selectedGameForPricing.value.customPrices = customPrices
        selectedGameForPricing.value.featuredPackages = featuredPackages
      }
      const gIndex = games.value.findIndex(g => g._id === selectedGameForPricing.value._id)
      if (gIndex !== -1) {
        games.value[gIndex].customPrices = customPrices
        games.value[gIndex].featuredPackages = featuredPackages
      }

      showToast('Prices & Featured packages updated successfully', 'success')
      showPricingModal.value = false
    } else {
      const data = await res.json()
      throw new Error(data.message)
    }
  } catch (error) {
    showToast(error.message || 'Failed to save prices', 'error')
  } finally {
    isSavingPrices.value = false
  }
}

const deleteGame = (game) => {
  openConfirmDialog(
    'Delete Game',
    `Are you sure you want to delete ${game.name}? This action cannot be undone.`,
    'Delete',
    true, // isDestructive
    async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const res = await authFetch(`${apiUrl}/api/games/${game._id}`, {
          method: 'DELETE'
        })
        
        if (res.ok) {
          showToast('Game deleted successfully', 'success')
          games.value = games.value.filter(g => g._id !== game._id)
        } else {
          showToast('Failed to delete game', 'error')
        }
      } catch (error) {
        showToast('Error deleting game', 'error')
      }
    }
  )
}

const showToast = (message, type = 'success') => {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.value = { show: true, message, type };
  toastTimeout = setTimeout(() => {
    toast.value.show = false;
  }, 3500);
}

const fetchTransactions = async () => {
  if (!isAdmin.value) return
  isLoading.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/transactions`)
    const data = await res.json()
    if (res.ok) {
      transactions.value = data
    } else if (res.status === 401 || res.status === 403) {
      isAdmin.value = false
      localStorage.removeItem('isAdmin')
      localStorage.removeItem('adminToken')
      showToast('Session expired. Please log in again.', 'error')
    }
    
    // Also fetch games
    const gamesRes = await fetch(`${apiUrl}/api/games`)
    const gamesData = await gamesRes.json()
    if (gamesRes.ok) {
      games.value = gamesData
    }

    // Fetch sliders
    const slidersRes = await fetch(`${apiUrl}/api/sliders`)
    const slidersData = await slidersRes.json()
    if (slidersRes.ok) {
      sliders.value = slidersData
    }
  } catch (error) {
    console.error("Error fetching admin data", error)
  } finally {
    isLoading.value = false
  }
}

const saveGameApi = async (game) => {
  isSavingGameData.value[game._id] = true
  try {
    const formData = new FormData()
    formData.append('rapidApiId', game.rapidApiId)
    formData.append('publisher', game.publisher)
    if (game.currencyImage !== undefined) formData.append('currencyImage', game.currencyImage)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${game._id}`, {
      method: 'PUT',
      body: formData
    })
    
    if (res.ok) {
      showToast('Game info updated successfully!', 'success')
    } else {
      showToast('Error updating game info', 'error')
    }
  } catch (error) {
    showToast('Error updating game info', 'error')
  } finally {
    isSavingGameData.value[game._id] = false
  }
}

const toggleGameStatus = async (game) => {
  isSavingGameData.value[game._id] = true
  const newStatus = game.isActive === false ? true : false
  
  try {
    const formData = new FormData()
    formData.append('isActive', newStatus)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${game._id}`, {
      method: 'PUT',
      body: formData
    })
    
    if (res.ok) {
      game.isActive = newStatus
      showToast(newStatus ? 'Game Published!' : 'Game Hidden!', 'success')
    } else {
      showToast('Error updating status', 'error')
    }
  } catch (error) {
    showToast('Error updating status', 'error')
  } finally {
    isSavingGameData.value[game._id] = false
  }
}

// Banner Cropper State
const showBannerCropModal = ref(false)
const bannerCropGame = ref(null)
const bannerCropRawFile = ref(null)
const bannerCropImageSrc = ref('')
const bannerCropNaturalWidth = ref(0)
const bannerCropNaturalHeight = ref(0)
const bannerZoom = ref(1) // 1x to 3x
const bannerPanX = ref(0)
const bannerPanY = ref(0)
const isCroppingBanner = ref(false)
const cropViewportRef = ref(null)
const bannerCropRatio = ref('16/9') // '16/9' (Full Wallpaper), '3/1' (Balanced), '4/1' (Desktop Wide), '2.2/1' (Mobile Focused)
const bannerPreviewMode = ref('mobile') // 'mobile' | 'desktop'

const setBannerCropRatio = (ratio) => {
  bannerCropRatio.value = ratio
  nextTick(() => {
    const clamped = clampBannerPan(bannerPanX.value, bannerPanY.value, bannerZoom.value)
    bannerPanX.value = clamped.x
    bannerPanY.value = clamped.y
  })
}

const closeBannerCropModal = () => {
  if (bannerCropImageSrc.value && bannerCropImageSrc.value.startsWith('blob:')) {
    URL.revokeObjectURL(bannerCropImageSrc.value)
  }
  bannerCropRawFile.value = null
  showBannerCropModal.value = false
}

const uploadOriginalBanner = async () => {
  if (!bannerCropGame.value) return
  
  if (!bannerCropRawFile.value) {
    saveCroppedBanner()
    return
  }

  isCroppingBanner.value = true
  try {
    const formData = new FormData()
    formData.append('banner', bannerCropRawFile.value)

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${bannerCropGame.value._id}`, {
      method: 'PUT',
      body: formData
    })

    const updatedGame = await res.json()
    if (res.ok) {
      const idx = games.value.findIndex(g => g._id === bannerCropGame.value._id)
      if (idx !== -1) {
        games.value[idx] = updatedGame
      }
      showToast('Full original banner uploaded successfully!', 'success')
      closeBannerCropModal()
    } else {
      throw new Error(updatedGame.message || 'Failed to upload banner')
    }
  } catch (err) {
    console.error("Error uploading original banner", err)
    showToast(err.message || 'Error uploading banner', 'error')
  } finally {
    isCroppingBanner.value = false
  }
}

const openCropForCurrentBanner = async (game) => {
  if (!game || !game.banner) return
  bannerCropGame.value = game
  bannerCropRawFile.value = null
  bannerCropRatio.value = '16/9'
  bannerPreviewMode.value = 'mobile'

  const bannerUrl = game.banner.includes('?') 
    ? `${game.banner}&t=${Date.now()}` 
    : `${game.banner}?t=${Date.now()}`

  try {
    const res = await fetch(bannerUrl)
    if (!res.ok) throw new Error('Fetch status ' + res.status)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      bannerCropImageSrc.value = objectUrl
      bannerCropNaturalWidth.value = img.naturalWidth
      bannerCropNaturalHeight.value = img.naturalHeight
      bannerZoom.value = 1
      bannerPanX.value = 0
      bannerPanY.value = 0
      showBannerCropModal.value = true
      nextTick(() => {
        const clamped = clampBannerPan(0, 0, 1)
        bannerPanX.value = clamped.x
        bannerPanY.value = clamped.y
      })
    }
    img.onerror = () => {
      throw new Error('Image load error')
    }
    img.src = objectUrl
  } catch (err) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      bannerCropImageSrc.value = bannerUrl
      bannerCropNaturalWidth.value = img.naturalWidth
      bannerCropNaturalHeight.value = img.naturalHeight
      bannerZoom.value = 1
      bannerPanX.value = 0
      bannerPanY.value = 0
      showBannerCropModal.value = true
      nextTick(() => {
        const clamped = clampBannerPan(0, 0, 1)
        bannerPanX.value = clamped.x
        bannerPanY.value = clamped.y
      })
    }
    img.onerror = () => {
      showToast('Could not load current banner image for editing', 'error')
    }
    img.src = bannerUrl
  }
}

const isDraggingBanner = ref(false)
const dragStartBanner = { x: 0, y: 0 }
const panStartBanner = { x: 0, y: 0 }

const clampBannerPan = (panX, panY, zoom) => {
  if (!cropViewportRef.value || !bannerCropNaturalWidth.value || !bannerCropNaturalHeight.value) {
    return { x: panX, y: panY }
  }
  const boxW = cropViewportRef.value.clientWidth || 800
  const boxH = cropViewportRef.value.clientHeight || 200
  const imgW = bannerCropNaturalWidth.value
  const imgH = bannerCropNaturalHeight.value

  const baseScale = Math.max(boxW / imgW, boxH / imgH)
  const currentScale = baseScale * zoom
  const renderW = imgW * currentScale
  const renderH = imgH * currentScale

  const maxPanX = Math.max(0, (renderW - boxW) / 2)
  const maxPanY = Math.max(0, (renderH - boxH) / 2)

  return {
    x: Math.min(maxPanX, Math.max(-maxPanX, panX)),
    y: Math.min(maxPanY, Math.max(-maxPanY, panY))
  }
}

watch(bannerZoom, (newZoom) => {
  const clamped = clampBannerPan(bannerPanX.value, bannerPanY.value, newZoom)
  bannerPanX.value = clamped.x
  bannerPanY.value = clamped.y
})

const onBannerPanStart = (e) => {
  isDraggingBanner.value = true
  dragStartBanner.x = e.clientX
  dragStartBanner.y = e.clientY
  panStartBanner.x = bannerPanX.value
  panStartBanner.y = bannerPanY.value
}

const onBannerPanMove = (e) => {
  if (!isDraggingBanner.value) return
  const dx = e.clientX - dragStartBanner.x
  const dy = e.clientY - dragStartBanner.y
  const clamped = clampBannerPan(panStartBanner.x + dx, panStartBanner.y + dy, bannerZoom.value)
  bannerPanX.value = clamped.x
  bannerPanY.value = clamped.y
}

const onBannerPanEnd = () => {
  isDraggingBanner.value = false
}

const onBannerTouchStart = (e) => {
  if (e.touches && e.touches.length === 1) {
    isDraggingBanner.value = true
    dragStartBanner.x = e.touches[0].clientX
    dragStartBanner.y = e.touches[0].clientY
    panStartBanner.x = bannerPanX.value
    panStartBanner.y = bannerPanY.value
  }
}

const onBannerTouchMove = (e) => {
  if (!isDraggingBanner.value || !e.touches || e.touches.length !== 1) return
  const dx = e.touches[0].clientX - dragStartBanner.x
  const dy = e.touches[0].clientY - dragStartBanner.y
  const clamped = clampBannerPan(panStartBanner.x + dx, panStartBanner.y + dy, bannerZoom.value)
  bannerPanX.value = clamped.x
  bannerPanY.value = clamped.y
}

const onBannerTouchEnd = () => {
  isDraggingBanner.value = false
}

const onBannerWheel = (e) => {
  const delta = e.deltaY < 0 ? 0.08 : -0.08
  bannerZoom.value = Math.min(3, Math.max(1, parseFloat((bannerZoom.value + delta).toFixed(2))))
}

const resetBannerCrop = () => {
  bannerZoom.value = 1
  bannerPanX.value = 0
  bannerPanY.value = 0
}

const cropImageStyle = computed(() => {
  if (!bannerCropNaturalWidth.value) return {}
  const boxW = (cropViewportRef.value && cropViewportRef.value.clientWidth) || 800
  const boxH = (cropViewportRef.value && cropViewportRef.value.clientHeight) || 200
  const imgW = bannerCropNaturalWidth.value
  const imgH = bannerCropNaturalHeight.value

  const baseScale = Math.max(boxW / imgW, boxH / imgH)
  const currentScale = baseScale * bannerZoom.value
  const renderW = imgW * currentScale
  const renderH = imgH * currentScale

  const left = (boxW - renderW) / 2 + bannerPanX.value
  const top = (boxH - renderH) / 2 + bannerPanY.value

  return {
    width: `${renderW}px`,
    height: `${renderH}px`,
    left: `${left}px`,
    top: `${top}px`
  }
})

const saveCroppedBanner = async () => {
  if (!bannerCropGame.value || !bannerCropImageSrc.value) return
  isCroppingBanner.value = true

  try {
    const canvas = document.createElement('canvas')
    let targetWidth = 1920
    let targetHeight = 1080
    if (bannerCropRatio.value === '16/9') {
      targetWidth = 1920
      targetHeight = 1080
    } else if (bannerCropRatio.value === '4/1') {
      targetWidth = 1600
      targetHeight = 400
    } else if (bannerCropRatio.value === '2.2/1') {
      targetWidth = 1540
      targetHeight = 700
    } else {
      targetWidth = 1500
      targetHeight = 500
    }
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = bannerCropImageSrc.value
    })

    const box = cropViewportRef.value ? cropViewportRef.value.getBoundingClientRect() : { width: targetWidth, height: targetHeight }
    const boxW = box.width
    const boxH = box.height
    const imgW = img.naturalWidth
    const imgH = img.naturalHeight

    const baseScale = Math.max(boxW / imgW, boxH / imgH)
    const currentScale = baseScale * bannerZoom.value

    const cropW = boxW / currentScale
    const cropH = boxH / currentScale
    const cropCenterX = imgW / 2 - (bannerPanX.value / currentScale)
    const cropCenterY = imgH / 2 - (bannerPanY.value / currentScale)

    const srcX = Math.max(0, Math.min(imgW - cropW, cropCenterX - cropW / 2))
    const srcY = Math.max(0, Math.min(imgH - cropH, cropCenterY - cropH / 2))

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, srcX, srcY, cropW, cropH, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    const croppedFile = new File([blob], `banner_${bannerCropGame.value._id}.jpg`, { type: 'image/jpeg' })

    const formData = new FormData()
    formData.append('banner', croppedFile)

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${bannerCropGame.value._id}`, {
      method: 'PUT',
      body: formData
    })

    const updatedGame = await res.json()
    if (res.ok) {
      const idx = games.value.findIndex(g => g._id === bannerCropGame.value._id)
      if (idx !== -1) {
        games.value[idx] = updatedGame
      }
      showToast('Banner saved and applied successfully!', 'success')
      closeBannerCropModal()
    } else {
      throw new Error(updatedGame.message || 'Failed to upload cropped banner')
    }
  } catch (error) {
    console.error("Error cropping banner", error)
    showToast(error.message || 'Error uploading cropped banner', 'error')
  } finally {
    isCroppingBanner.value = false
  }
}

const handleImageUpload = async (event, game, type = 'image') => {
  const file = event.target.files[0]
  if (!file) return

  if (type === 'banner') {
    bannerCropRawFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        bannerCropGame.value = game
        bannerCropImageSrc.value = e.target.result
        bannerCropNaturalWidth.value = img.naturalWidth
        bannerCropNaturalHeight.value = img.naturalHeight
        bannerCropRatio.value = '16/9'
        bannerPreviewMode.value = 'mobile'
        bannerZoom.value = 1
        bannerPanX.value = 0
        bannerPanY.value = 0
        showBannerCropModal.value = true
        nextTick(() => {
          if (cropViewportRef.value) {
            bannerPanX.value = 0
            bannerPanY.value = 0
          }
        })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
    event.target.value = ''
    return
  }
  
  isUploading.value[game._id] = true
  
  try {
    const formData = new FormData()
    formData.append(type, file)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${game._id}`, {
      method: 'PUT',
      body: formData
    })
    
    const updatedGame = await res.json()
    if (res.ok) {
      // Update local state
      const index = games.value.findIndex(g => g._id === game._id)
      if (index !== -1) {
        games.value[index] = updatedGame
      }
      showToast(`${type === 'banner' ? 'Banner' : 'Cover image'} uploaded successfully!`, 'success');
    } else {
      showToast(`Error uploading ${type}`, 'error');
    }
  } catch (error) {
    console.error("Error uploading image", error)
  } finally {
    if (type === 'banner') isUploadingBanner.value[game._id] = false
    else isUploading.value[game._id] = false
  }
}

const handlePackageImageUpload = async (event, pkg) => {
  const file = event.target.files[0]
  if (!file || !selectedGameForPricing.value) return
  
  isUploadingPackageImage.value[pkg.id] = true
  
  try {
    const formData = new FormData()
    formData.append('image', file)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/games/${selectedGameForPricing.value._id}/packages/${pkg.id}/image`, {
      method: 'POST',
      body: formData
    })
    
    if (res.ok) {
      const updatedGame = await res.json()
      const index = games.value.findIndex(g => g._id === updatedGame._id)
      if (index !== -1) {
        games.value[index] = updatedGame
      }
      if (updatedGame.customImages && updatedGame.customImages[pkg.id]) {
        pkg.customImage = updatedGame.customImages[pkg.id]
      }
      showToast('Package image uploaded successfully!', 'success');
    } else {
      showToast('Error uploading package image', 'error');
    }
  } catch (error) {
    console.error("Error uploading package image", error)
    showToast('Error uploading package image', 'error')
  } finally {
    isUploadingPackageImage.value[pkg.id] = false
  }
}

const handleSliderUpload = async (event, slider) => {
  const file = event.target.files[0]
  if (!file) return
  
  isUploadingSlider.value[slider._id] = true
  
  try {
    const formData = new FormData()
    formData.append('image', file)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/sliders/${slider._id}`, {
      method: 'PUT',
      body: formData
    })
    
    const updatedSlider = await res.json()
    if (res.ok) {
      const index = sliders.value.findIndex(s => s._id === slider._id)
      if (index !== -1) {
        sliders.value[index] = updatedSlider
      }
      showToast('Slider background uploaded successfully!', 'success');
    } else {
      showToast('Error uploading slider background', 'error');
    }
  } catch (error) {
    console.error("Error uploading slider image", error)
  } finally {
    isUploadingSlider.value[slider._id] = false
  }
}

const openCreateSlider = () => {
  editingSlider.value = null
  sliderForm.value = { title: '', subtitle: '', link: '', isActive: true, imageFile: null }
  showSliderModal.value = true
}

const openEditSlider = (slider) => {
  editingSlider.value = slider
  sliderForm.value = { 
    title: slider.title, 
    subtitle: slider.subtitle, 
    link: slider.link, 
    isActive: slider.isActive !== false,
    imageFile: null
  }
  showSliderModal.value = true
}

const handleSliderFormImage = (e) => {
  if (e.target.files.length > 0) {
    sliderForm.value.imageFile = e.target.files[0]
  }
}

const saveSlider = async () => {
  isSavingSlider.value = true
  try {
    const formData = new FormData()
    formData.append('title', sliderForm.value.title)
    formData.append('subtitle', sliderForm.value.subtitle)
    formData.append('link', sliderForm.value.link)
    formData.append('isActive', sliderForm.value.isActive)
    if (sliderForm.value.imageFile) {
      formData.append('image', sliderForm.value.imageFile)
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const url = editingSlider.value 
      ? `${apiUrl}/api/sliders/${editingSlider.value._id}`
      : `${apiUrl}/api/sliders`
    const method = editingSlider.value ? 'PUT' : 'POST'

    const res = await authFetch(url, { method, body: formData })
    const data = await res.json()

    if (res.ok) {
      if (editingSlider.value) {
        const index = sliders.value.findIndex(s => s._id === data._id)
        if (index !== -1) sliders.value[index] = data
      } else {
        sliders.value.push(data)
      }
      showToast(`Slider ${editingSlider.value ? 'updated' : 'created'} successfully!`, 'success')
      showSliderModal.value = false
    } else {
      showToast(data.error || 'Failed to save slider', 'error')
    }
  } catch (error) {
    showToast('Network error while saving slider', 'error')
  } finally {
    isSavingSlider.value = false
  }
}

const deleteSlider = (slider) => {
  openConfirmDialog(
    'Delete Slider',
    `Are you sure you want to permanently delete slider "${slider.title}"?`,
    'Delete Slider',
    true,
    async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const res = await authFetch(`${apiUrl}/api/sliders/${slider._id}`, { method: 'DELETE' })
        if (res.ok) {
          sliders.value = sliders.value.filter(s => s._id !== slider._id)
          showToast('Slider deleted successfully!', 'success')
        } else {
          showToast('Failed to delete slider', 'error')
        }
      } catch (err) {
        showToast('Network error while deleting slider', 'error')
      }
    }
  )
}

const toggleSliderStatus = async (slider) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const newStatus = slider.isActive === false ? true : false
    const formData = new FormData()
    formData.append('isActive', newStatus)
    
    const res = await authFetch(`${apiUrl}/api/sliders/${slider._id}`, {
      method: 'PUT',
      body: formData
    })
    
    if (res.ok) {
      slider.isActive = newStatus
      showToast(`Slider is now ${newStatus ? 'Published' : 'Hidden'}`, 'success')
    } else {
      showToast('Failed to update status', 'error')
    }
  } catch (err) {
    showToast('Network error while updating status', 'error')
  }
}

onMounted(async () => {
  const isAuth = await checkAdminAuth()
  if (isAuth) {
    fetchTransactions()
    fetchUsers()
    fetchPages()
    fetchMoogoldBalance()
    fetchSettings()
  }
})

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)

const searchedTransactions = computed(() => {
  if (!searchQuery.value) return transactions.value
  const query = searchQuery.value.toLowerCase()
  return transactions.value.filter(t => 
    t.playerId?.toLowerCase().includes(query) ||
    t.paymentMethod?.toLowerCase().includes(query) ||
    t.status?.toLowerCase().includes(query) ||
    t.paymentStatus?.toLowerCase().includes(query) ||
    t.deliveryStatus?.toLowerCase().includes(query) ||
    t.providerReference?.toLowerCase().includes(query) ||
    t._id?.toLowerCase().includes(query)
  )
})

const totalPages = computed(() => Math.ceil(searchedTransactions.value.length / itemsPerPage.value))

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return searchedTransactions.value.slice(start, end)
})

watch(searchQuery, () => {
  currentPage.value = 1
})

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const totalRevenue = computed(() => {
  return transactions.value
    .filter(t => t.status === 'completed' || t.deliveryStatus === 'delivered')
    .reduce((sum, t) => sum + Number(t.price), 0)
    .toFixed(2)
})

const totalOrders = computed(() => transactions.value.length)

const successfulOrders = computed(() => {
  return transactions.value.filter(t => t.status === 'completed' || t.deliveryStatus === 'delivered').length
})

// UI Helpers
const getStatusColor = (status) => {
  if (status === 'completed') return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (status === 'failed') return 'text-red-400 bg-red-400/10 border-red-400/20'
  return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
}

const getStatusIcon = (status) => {
  if (status === 'completed') return CheckCircle2
  if (status === 'failed') return XCircle
  if (status === 'processing') return RefreshCw
  return Clock
}

// Dual Status Helpers (Payment & Delivery)
const getPaymentBadgeClass = (tx) => {
  const p = tx.paymentStatus || ((tx.status === 'completed' || tx.status === 'processing' || tx.status === 'failed') ? 'paid' : 'unpaid')
  if (p === 'paid') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  if (p === 'refunded') return 'text-purple-400 bg-purple-500/10 border-purple-500/30'
  if (p === 'failed') return 'text-red-400 bg-red-500/10 border-red-500/30'
  return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
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
  if (p === 'failed') return 'Failed'
  return 'Unpaid'
}

const getDeliveryBadgeClass = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  if (d === 'sending' || tx.status === 'processing') return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  if (d === 'failed' || tx.status === 'failed') return 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
}

const getDeliveryIcon = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return CheckCircle2
  if (d === 'sending' || tx.status === 'processing') return RefreshCw
  if (d === 'failed' || tx.status === 'failed') return XCircle
  return Clock
}

const isDeliverySpinning = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  return d === 'sending' || tx.status === 'processing'
}

const getDeliveryLabel = (tx) => {
  const d = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  if (d === 'delivered' || tx.status === 'completed') return 'Delivered'
  if (d === 'sending' || tx.status === 'processing') return 'Sending'
  if (d === 'failed' || tx.status === 'failed') return 'Delivery Failed'
  return 'Pending'
}

// Quick action to re-check order status with MooGold
const syncingTxId = ref(null)
const recheckTxStatus = async (tx) => {
  if (syncingTxId.value) return
  syncingTxId.value = tx._id
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/transactions/${tx._id}/status`)
    const data = await res.json()
    if (res.ok && data.transaction) {
      const idx = transactions.value.findIndex(t => t._id === tx._id)
      if (idx !== -1) {
        transactions.value[idx] = data.transaction
      }
      showToast(`Updated: Delivery is ${data.transaction.deliveryStatus || data.transaction.status}`, 'success')
    } else {
      showToast('Could not fetch status update', 'error')
    }
  } catch (err) {
    showToast('Failed to check status: ' + err.message, 'error')
  } finally {
    syncingTxId.value = null
  }
}

// Transaction Status Edit Modal State
const showTxStatusModal = ref(false)
const editingTx = ref(null)
const editPaymentStatus = ref('paid')
const editDeliveryStatus = ref('delivered')
const editErrorDetails = ref('')
const isSavingTxStatus = ref(false)

const openTxStatusModal = (tx) => {
  editingTx.value = tx
  editPaymentStatus.value = tx.paymentStatus || ((tx.status === 'completed' || tx.status === 'processing' || tx.status === 'failed') ? 'paid' : 'unpaid')
  editDeliveryStatus.value = tx.deliveryStatus || (tx.status === 'completed' ? 'delivered' : tx.status === 'processing' ? 'sending' : tx.status === 'failed' ? 'failed' : 'pending')
  editErrorDetails.value = tx.errorDetails || ''
  showTxStatusModal.value = true
}

const saveTxStatus = async () => {
  if (!editingTx.value) return
  isSavingTxStatus.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await authFetch(`${apiUrl}/api/transactions/${editingTx.value._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: editPaymentStatus.value,
        deliveryStatus: editDeliveryStatus.value,
        errorDetails: editErrorDetails.value
      })
    })
    const data = await res.json()
    if (res.ok && data.transaction) {
      const idx = transactions.value.findIndex(t => t._id === editingTx.value._id)
      if (idx !== -1) {
        transactions.value[idx] = data.transaction
      }
      showToast('Transaction status updated successfully!', 'success')
      showTxStatusModal.value = false
    } else {
      showToast(data.message || 'Failed to update transaction', 'error')
    }
  } catch (err) {
    showToast('Error updating transaction: ' + err.message, 'error')
  } finally {
    isSavingTxStatus.value = false
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <!-- Verifying Auth Screen -->
  <div v-if="isVerifyingAuth" class="min-h-screen flex items-center justify-center p-4 bg-[#0d0f12]">
    <div class="flex flex-col items-center gap-3">
      <RefreshCw class="w-8 h-8 text-primary animate-spin" />
      <p class="text-sm text-gray-400 font-medium">Verifying secure authorization...</p>
    </div>
  </div>

  <!-- Admin Login Screen -->
  <div v-else-if="!isAdmin" class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-card max-w-md w-full p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
      <div class="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 blur-3xl rounded-full"></div>
      <div class="absolute -bottom-20 -left-20 w-40 h-40 bg-red-500/20 blur-3xl rounded-full"></div>
      
      <div class="relative z-10">
        <div class="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert class="w-8 h-8 text-primary" />
        </div>
        <h2 class="text-3xl font-black font-outfit text-center text-white mb-2">Admin Access</h2>
        <p class="text-gray-400 text-center mb-8 text-sm">Enter your administrator credentials to access the control panel.</p>
        
        <form @submit.prevent="handleAdminLogin" class="space-y-4">
          <div>
            <input 
              v-model="emailInput" 
              type="email" 
              placeholder="Admin Email"
              required
              class="w-full bg-white/5 border border-white/10 text-white p-4 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all mb-4"
            />
            <input 
              v-model="passwordInput" 
              type="password" 
              placeholder="Admin Password"
              required
              class="w-full bg-white/5 border border-white/10 text-white p-4 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all mb-4"
            />
            <input 
              v-model="adminPinInput" 
              type="password" 
              placeholder="Security Master PIN"
              required
              class="w-full bg-white/5 border border-primary/40 text-primary font-mono tracking-widest p-4 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
            />
          </div>
          <p v-if="loginError" class="text-red-400 text-sm text-center font-semibold">{{ loginError }}</p>
          <button type="submit" :disabled="isLoggingIn" class="w-full py-4 bg-primary text-darker font-black rounded-xl hover:bg-yellow-400 transition-colors shadow-lg shadow-primary/20 flex justify-center items-center gap-2 disabled:opacity-70">
            <RefreshCw v-if="isLoggingIn" class="w-5 h-5 animate-spin" />
            {{ isLoggingIn ? 'Authenticating...' : 'Unlock Dashboard' }}
          </button>
        </form>
        <div class="mt-6 text-center">
          <router-link to="/" class="text-sm text-gray-500 hover:text-white transition-colors">Return to public site</router-link>
        </div>
      </div>
    </div>
  </div>

  <!-- Admin Dashboard Layout (Strictly requires both isAdmin and isServerVerified) -->
  <div v-else-if="isAdmin && isServerVerified" class="flex h-screen overflow-hidden text-gray-200">
    <!-- Sidebar -->
    <aside class="w-64 flex-shrink-0 border-r border-white/5 bg-[#12121a]/95 backdrop-blur-xl flex flex-col relative z-20">
      <div class="p-6 border-b border-white/5">
        <h2 class="text-xl font-black font-outfit tracking-widest text-white flex items-center gap-2 cursor-pointer" @click="router.push('/')">
          <img src="/logo.jpg" alt="Logo" class="w-8 h-8 rounded-full border border-primary object-cover shadow-[0_0_10px_rgba(255,215,0,0.3)]" />
          ADMIN<span class="text-primary">PANEL</span>
        </h2>
      </div>
      
      <nav class="flex-1 p-4 space-y-2">
        <button 
          @click="activeTab = 'dashboard'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'dashboard' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <LayoutDashboard class="w-4 h-4" />
          Dashboard
        </button>
        <button 
          @click="activeTab = 'games'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'games' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <Gamepad2 class="w-4 h-4" />
          Games Manager
        </button>
        <button 
          @click="activeTab = 'sliders'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'sliders' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <LayoutTemplate class="w-4 h-4" />
          Slider Manager
        </button>
        <button 
          @click="activeTab = 'users'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'users' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <Users class="w-4 h-4" />
          User Management
        </button>
        <button 
          @click="activeTab = 'pages'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'pages' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <FileText class="w-4 h-4" />
          Pages Manager
        </button>
        <button 
          @click="activeTab = 'settings'"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold"
          :class="activeTab === 'settings' ? 'bg-primary text-darker shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'"
        >
          <Settings class="w-4 h-4" />
          Site Settings
        </button>
      </nav>

      <div class="p-4 border-t border-white/5">
        <button @click="confirmLogout" class="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-semibold group">
          <div class="flex items-center gap-3">
            <LogOut class="w-4 h-4" />
            Logout
          </div>
          <ChevronRight class="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto bg-darker relative">
      <!-- Background effects for main area -->
      <div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div class="p-6 md:p-10 max-w-7xl mx-auto relative z-10">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <h1 class="text-3xl md:text-4xl font-black font-outfit tracking-tight text-white mb-2 flex items-center gap-3">
              Overview
            </h1>
            <p class="text-gray-400 font-medium">Monitor real-time top-ups and revenue.</p>
          </div>
          
          <button @click="fetchTransactions(); fetchMoogoldBalance()" class="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-white/10 font-semibold transition-all flex items-center gap-2 group">
            <RefreshCw class="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Refresh Data
          </button>
        </div>

        <!-- Dashboard Overview Section -->
        <div v-if="activeTab === 'dashboard'" class="animate-fade-in">
          <!-- Stats Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div class="glass-card p-6 border border-white/10 bg-white/[0.02] backdrop-blur-md rounded-2xl relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
            <div class="absolute -right-4 -bottom-4 p-4 opacity-10 text-primary group-hover:scale-110 transition-transform"><DollarSign class="w-24 h-24" /></div>
            <h3 class="text-gray-400 font-semibold text-xs mb-1 uppercase tracking-wider">Total Revenue</h3>
            <p class="text-4xl font-black text-white font-outfit">${{ totalRevenue }}</p>
          </div>
          
          <div class="glass-card p-6 border border-white/10 bg-white/[0.02] backdrop-blur-md rounded-2xl relative overflow-hidden group hover:border-white/30 transition-all duration-300">
            <div class="absolute -right-4 -bottom-4 p-4 opacity-10 text-blue-400 group-hover:scale-110 transition-transform"><Package class="w-24 h-24" /></div>
            <h3 class="text-gray-400 font-semibold text-xs mb-1 uppercase tracking-wider">Total Orders</h3>
            <p class="text-4xl font-black text-white font-outfit">{{ totalOrders }}</p>
          </div>
          
          <div class="glass-card p-6 border border-white/10 bg-white/[0.02] backdrop-blur-md rounded-2xl relative overflow-hidden group hover:border-green-500/50 transition-all duration-300">
            <div class="absolute -right-4 -bottom-4 p-4 opacity-10 text-green-400 group-hover:scale-110 transition-transform"><CheckCircle2 class="w-24 h-24" /></div>
            <h3 class="text-gray-400 font-semibold text-xs mb-1 uppercase tracking-wider">Success Rate</h3>
            <p class="text-4xl font-black text-white font-outfit">
              {{ totalOrders > 0 ? Math.round((successfulOrders / totalOrders) * 100) : 0 }}%
            </p>
          </div>

          <div class="glass-card p-6 border border-amber-500/30 bg-amber-500/[0.03] backdrop-blur-md rounded-2xl relative overflow-hidden group hover:border-amber-500/60 transition-all duration-300">
            <div class="absolute -right-4 -bottom-4 p-4 opacity-10 text-amber-400 group-hover:scale-110 transition-transform"><Wallet class="w-24 h-24" /></div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-gray-400 font-semibold text-xs uppercase tracking-wider">MooGold Wallet</h3>
              <span :class="moogoldWalletBalance > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border">
                {{ moogoldWalletBalance > 0 ? 'Funded' : 'Empty' }}
              </span>
            </div>
            <p class="text-2xl font-black text-white font-outfit">${{ Number(moogoldWalletBalance).toFixed(2) }} {{ moogoldCurrency }}</p>
            <p class="text-xs text-amber-300 font-mono mt-1">Live MooGold Partner Balance</p>
          </div>
        </div>

        <!-- Transactions Section -->
        <div class="glass-card border border-white/10 bg-white/[0.02] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl">
          <div class="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/[0.01]">
            <h2 class="text-xl font-bold text-white">Recent Transactions</h2>
            
            <div class="relative w-full sm:w-72 group">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                <Search class="h-4 w-4" />
              </div>
              <input 
                v-model="searchQuery" 
                type="text" 
                class="bg-darker border border-white/10 text-white text-sm rounded-xl focus:ring-1 focus:ring-primary focus:border-primary block w-full pl-10 p-2.5 transition-all outline-none" 
                placeholder="Search Player ID or Status..."
              >
            </div>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left text-gray-400">
              <thead class="text-xs text-gray-300 uppercase bg-white/5 border-b border-white/5">
                <tr>
                  <th scope="col" class="px-6 py-4 font-semibold">Date</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Game / Account</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Item & Price</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Payment Status</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Diamond Delivery</th>
                  <th scope="col" class="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                    <RefreshCw class="w-8 h-8 animate-spin mx-auto mb-3 text-primary/50" />
                    Loading transactions...
                  </td>
                </tr>
                <tr v-else-if="paginatedTransactions.length === 0">
                  <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                    No transactions found.
                  </td>
                </tr>
                <tr 
                  v-for="tx in paginatedTransactions" 
                  :key="tx._id"
                  class="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td class="px-6 py-4 font-medium text-white whitespace-nowrap">
                    {{ formatDate(tx.createdAt) }}
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-bold text-white mb-1 flex items-center gap-2">
                      <span>{{ tx.gameId?.name || 'Unknown Game' }}</span>
                      <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                        Order #{{ tx.providerReference || (tx._id ? tx._id.slice(-8).toUpperCase() : 'N/A') }}
                      </span>
                    </div>
                    <div class="text-sm font-semibold text-gray-300">ID: {{ tx.playerId }}</div>
                    <div class="text-xs text-gray-500 mt-0.5" v-if="tx.serverId">Zone: {{ tx.serverId }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-bold text-white">{{ tx.amount }} 💎</div>
                    <div class="text-xs font-bold text-primary mt-0.5">${{ Number(tx.price).toFixed(2) }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col gap-1">
                      <span class="px-2.5 py-1 text-xs font-bold border rounded-full flex items-center gap-1.5 w-fit uppercase tracking-wider shadow-sm" :class="getPaymentBadgeClass(tx)">
                        <span class="w-1.5 h-1.5 rounded-full" :class="getPaymentDotClass(tx)"></span>
                        {{ getPaymentLabel(tx) }}
                      </span>
                      <span class="text-[11px] text-gray-500 uppercase font-mono">{{ tx.paymentMethod || 'KHQR' }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col gap-1">
                      <span class="px-2.5 py-1 text-xs font-bold border rounded-full flex items-center gap-1.5 w-fit uppercase tracking-wider shadow-sm" :class="getDeliveryBadgeClass(tx)">
                        <component :is="getDeliveryIcon(tx)" class="w-3.5 h-3.5" :class="isDeliverySpinning(tx) ? 'animate-spin' : ''" />
                        {{ getDeliveryLabel(tx) }}
                      </span>
                      <span v-if="tx.providerReference" class="text-[11px] text-gray-400 font-mono">
                        Ref #{{ tx.providerReference }}
                      </span>
                      <span v-if="tx.errorDetails && (tx.deliveryStatus === 'failed' || tx.status === 'failed')" class="text-[11px] text-rose-400 font-medium max-w-xs truncate" :title="tx.errorDetails">
                        {{ tx.errorDetails }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button 
                        @click="openTxStatusModal(tx)" 
                        class="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                        title="Update Payment or Delivery Status"
                      >
                        <Edit class="w-3 h-3" />
                        Update
                      </button>
                      <button 
                        @click="recheckTxStatus(tx)" 
                        :disabled="syncingTxId === tx._id" 
                        class="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                        title="Sync live status with MooGold"
                      >
                        <RefreshCw class="w-3 h-3" :class="syncingTxId === tx._id ? 'animate-spin text-primary' : ''" />
                        Sync
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination UI -->
          <div v-if="totalPages > 1" class="p-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.01]">
            <div class="text-sm text-gray-400">
              Showing <span class="font-bold text-white">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to <span class="font-bold text-white">{{ Math.min(currentPage * itemsPerPage, searchedTransactions.length) }}</span> of <span class="font-bold text-white">{{ searchedTransactions.length }}</span> results
            </div>
            <div class="flex items-center gap-2">
              <button 
                @click="prevPage" 
                :disabled="currentPage === 1"
                class="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1"
              >
                <ChevronRight class="w-4 h-4 rotate-180" /> Prev
              </button>
              
              <div class="flex items-center gap-1 px-2">
                <span class="text-sm font-bold text-white">{{ currentPage }}</span>
                <span class="text-sm text-gray-500">/</span>
                <span class="text-sm text-gray-500">{{ totalPages }}</span>
              </div>
              
              <button 
                @click="nextPage" 
                :disabled="currentPage === totalPages"
                class="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1"
              >
                Next <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>
          
        </div>
        </div>
        <!-- End Dashboard Tab Content -->

        <!-- Games Manager Section -->
        <div v-if="activeTab === 'games'" class="animate-fade-in">
          <div class="glass-card border border-white/10 bg-white/[0.02] backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <ImageIcon class="w-6 h-6 text-primary" />
                Game Cover Photos
              </h2>
              
              <div class="flex items-center gap-4 w-full md:w-auto">
                <div class="relative w-full md:w-64">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    v-model="searchQueryGames" 
                    placeholder="Search local games..." 
                    class="w-full bg-darker/50 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                
                <button @click="openMoogoldModal" class="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-darker font-bold py-2 px-4 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 shadow-lg shadow-amber-500/20">
                  <Plus class="w-4 h-4" /> Import from MooGold
                </button>
              </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div v-for="game in filteredGamesList" :key="game._id" class="bg-darker/90 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-all">
                
                <!-- Banner Background Preview -->
                <div v-if="game.banner" class="absolute inset-0 z-0 opacity-30">
                  <img :src="game.banner" class="w-full h-full object-cover blur-sm" />
                  <div class="absolute inset-0 bg-gradient-to-t from-darker to-transparent"></div>
                </div>

                <!-- Content Wrapper -->
                <div class="relative z-10 flex flex-col h-full">
                  <div class="aspect-[3/4] rounded-xl overflow-hidden mb-4 relative bg-black shadow-lg">
                  <img :src="game.image" :alt="game.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70 group-hover:opacity-100" />
                  
                  <div class="absolute inset-0 bg-gradient-to-t from-darker via-transparent to-transparent"></div>
                  
                  <!-- Upload Button Overlay -->
                  <div class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label :for="'upload-' + game._id" class="cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl hover:bg-white/10 transition-colors">
                      <UploadCloud v-if="!isUploading[game._id]" class="w-8 h-8 text-primary mb-2" />
                      <RefreshCw v-else class="w-8 h-8 text-primary mb-2 animate-spin" />
                      <span class="text-white font-bold text-sm">{{ isUploading[game._id] ? 'Uploading to Cloudinary...' : 'Upload New Photo' }}</span>
                    </label>
                    <input 
                      :id="'upload-' + game._id" 
                      type="file" 
                      accept="image/*" 
                      class="hidden" 
                      @change="(e) => handleImageUpload(e, game)"
                      :disabled="isUploading[game._id]"
                    />
                  </div>
                </div>
                
                <div class="flex items-center justify-between gap-2 mb-1">
                  <h3 class="text-lg font-bold text-white font-outfit truncate">{{ game.name }}</h3>
                  <span class="bg-amber-500/20 text-amber-400 border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0">
                    MooGold
                  </span>
                </div>
                <input 
                  v-model="game.publisher"
                  @change="saveGameApi(game)"
                  class="bg-transparent border-b border-transparent hover:border-white/20 focus:border-primary focus:bg-white/5 rounded px-1 -mx-1 text-sm text-gray-400 font-semibold mb-4 outline-none transition-all w-full"
                  placeholder="Publisher name"
                />
                <!-- Banner Upload -->
                <div class="mt-auto pt-4 border-t border-white/10 flex flex-col gap-3">
                  <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span class="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      API Slug
                      <RefreshCw v-if="isSavingGameData[game._id]" class="w-3 h-3 animate-spin text-primary" />
                    </span>
                    <input 
                      v-model="game.rapidApiId" 
                      @change="saveGameApi(game)"
                      type="text" 
                      placeholder="e.g. mobile-legends"
                      class="w-32 bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:border-primary outline-none" 
                    />
                  </div>

                  <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span class="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      Status
                      <RefreshCw v-if="isSavingGameData[game._id]" class="w-3 h-3 animate-spin text-primary" />
                    </span>
                    <button 
                      @click="toggleGameStatus(game)"
                      :class="game.isActive !== false ? 'bg-primary/20 text-primary border-primary/50' : 'bg-red-500/20 text-red-500 border-red-500/50'"
                      class="border rounded-lg px-3 py-1 text-xs font-bold transition-all"
                    >
                      {{ game.isActive !== false ? 'Published' : 'Hidden' }}
                    </button>
                  </div>

                  <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">Cover Banner</span>
                    <div class="flex items-center gap-1.5">
                      <button 
                        v-if="game.banner" 
                        type="button" 
                        @click="openCropForCurrentBanner(game)" 
                        class="bg-primary/15 border border-primary/40 hover:bg-primary/25 text-primary transition-all px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                        title="Edit and crop current banner"
                      >
                        <Crop class="w-3.5 h-3.5" />
                        Edit Banner
                      </button>
                      <label :for="'banner-' + game._id" class="cursor-pointer bg-black/50 backdrop-blur border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300 hover:text-white transition-all px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                        <RefreshCw v-if="isUploadingBanner[game._id]" class="w-3.5 h-3.5 animate-spin" />
                        <Upload v-else class="w-3.5 h-3.5" />
                        {{ isUploadingBanner[game._id] ? 'Uploading...' : (game.banner ? 'Replace' : 'Upload Banner') }}
                      </label>
                      <input 
                        :id="'banner-' + game._id" 
                        type="file" 
                        accept="image/*" 
                        class="hidden" 
                        @change="(e) => handleImageUpload(e, game, 'banner')"
                        :disabled="isUploadingBanner[game._id]"
                      />
                    </div>
                  </div>
                  <button @click="openPricingModal(game)" class="w-full bg-white/5 border border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50 text-gray-300 transition-all px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    <DollarSign class="w-4 h-4" />
                    Manage Prices
                  </button>
                  <button @click="deleteGame(game)" class="w-full mt-2 bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 text-gray-300 transition-all px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    <Trash2 class="w-4 h-4" />
                    Delete Game
                  </button>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Sliders Tab -->
        <div v-if="activeTab === 'sliders'" class="animate-fade-in">
          <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 class="text-2xl font-black font-outfit text-white flex items-center gap-3">
                <LayoutTemplate class="w-8 h-8 text-primary" />
                Hero Sliders
              </h2>
              <button @click="openCreateSlider" class="px-5 py-2.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 hover:scale-105 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                <Plus class="w-5 h-5" />
                Add New Slider
              </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div v-for="slider in sliders" :key="slider._id" class="bg-darker/90 border border-white/10 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-primary/50 transition-all">
                
                <div class="aspect-video rounded-xl overflow-hidden mb-4 relative bg-black shadow-lg">
                  <img :src="slider.image" :alt="slider.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100" />
                  
                  <div class="absolute inset-0 bg-gradient-to-t from-darker via-transparent to-transparent"></div>
                  
                  <div class="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur border border-white/10 text-xs font-bold" :class="slider.isActive !== false ? 'text-green-400' : 'text-red-400'">
                    {{ slider.isActive !== false ? 'Active' : 'Hidden' }}
                  </div>
                  
                  <label :for="'slider-' + slider._id" class="absolute top-2 right-2 bg-black/60 hover:bg-primary/20 hover:text-primary backdrop-blur cursor-pointer text-white p-2 rounded-lg transition-all border border-white/10 group-hover:border-primary/50 shadow-xl z-20">
                    <RefreshCw v-if="isUploadingSlider[slider._id]" class="w-4 h-4 animate-spin" />
                    <UploadCloud v-else class="w-4 h-4" />
                  </label>
                  <input 
                    :id="'slider-' + slider._id" 
                    type="file" 
                    accept="image/*" 
                    class="hidden" 
                    @change="(e) => handleSliderUpload(e, slider)"
                    :disabled="isUploadingSlider[slider._id]"
                  />
                </div>
                
                <h3 class="text-lg font-bold text-white font-outfit truncate">{{ slider.title }}</h3>
                <p class="text-sm text-gray-400 font-semibold mb-2 truncate">{{ slider.subtitle }}</p>
                
                <div class="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
                  <div class="flex gap-2">
                    <button @click="openEditSlider(slider)" class="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20" title="Edit">
                      <Edit class="w-4 h-4" />
                    </button>
                    <button @click="toggleSliderStatus(slider)" class="p-2 rounded-lg transition-colors border" :class="slider.isActive !== false ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'" :title="slider.isActive !== false ? 'Hide Slider' : 'Publish Slider'">
                      <EyeOff v-if="slider.isActive !== false" class="w-4 h-4" />
                      <Eye v-else class="w-4 h-4" />
                    </button>
                  </div>
                  <button @click="deleteSlider(slider)" class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20" title="Delete">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Users Management Section -->
        <div v-if="activeTab === 'users'" class="animate-fade-in">
          <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 class="text-2xl font-black font-outfit text-white flex items-center gap-3">
                <Users class="w-8 h-8 text-primary" />
                User Management
              </h2>
            </div>
            
            <div v-if="isFetchingUsers" class="flex justify-center py-10">
              <RefreshCw class="w-8 h-8 text-primary animate-spin" />
            </div>
            
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 text-gray-400 text-sm font-bold tracking-wider">
                    <th class="py-4 px-4 font-outfit">USER</th>
                    <th class="py-4 px-4 font-outfit">EMAIL</th>
                    <th class="py-4 px-4 font-outfit">BALANCE</th>
                    <th class="py-4 px-4 font-outfit">ROLE</th>
                    <th class="py-4 px-4 font-outfit">STATUS</th>
                    <th class="py-4 px-4 font-outfit text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr v-for="u in users" :key="u._id" class="hover:bg-white/[0.02] transition-colors group">
                    <td class="py-4 px-4">
                      <div class="flex items-center gap-3">
                        <img :src="u.profileImage" class="w-10 h-10 rounded-full border border-white/10 object-cover shadow-lg" />
                        <span class="font-bold text-white">{{ u.username }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-4 text-gray-300 font-medium">{{ u.email }}</td>
                    <td class="py-4 px-4 text-primary font-black">${{ Number(u.balance || 0).toFixed(2) }}</td>
                    <td class="py-4 px-4">
                      <span class="px-2.5 py-1 text-xs font-bold rounded-lg border uppercase shadow-sm"
                            :class="u.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'">
                        {{ u.role }}
                      </span>
                    </td>
                    <td class="py-4 px-4">
                      <span class="px-2.5 py-1 text-xs font-bold rounded-lg border uppercase shadow-sm"
                            :class="!u.isBlocked ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'">
                        {{ !u.isBlocked ? 'Active' : 'Blocked' }}
                      </span>
                    </td>
                    <td class="py-4 px-4">
                      <div class="flex justify-end gap-2">
                        <button @click="viewUserTransactions(u._id)" class="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 hover:scale-110" title="View Transactions">
                          <ListOrdered class="w-4 h-4" />
                        </button>
                        <button @click="openEditUser(u)" class="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 hover:scale-110" title="Edit User">
                          <Edit class="w-4 h-4" />
                        </button>
                        <button @click="toggleBlockUser(u)" class="p-2 rounded-lg transition-all border hover:scale-110"
                                :class="!u.isBlocked ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20'"
                                :title="!u.isBlocked ? 'Block User' : 'Unblock User'">
                          <Lock v-if="!u.isBlocked" class="w-4 h-4" />
                          <Unlock v-else class="w-4 h-4" />
                        </button>
                        <button @click="deleteUser(u)" class="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20 hover:scale-110" title="Delete User">
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="users.length === 0">
                    <td colspan="6" class="px-6 py-12 text-center text-gray-500 font-bold">
                      No users found.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Pages Management Section -->
        <div v-if="activeTab === 'pages'" class="animate-fade-in">
          <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <h2 class="text-2xl font-black font-outfit text-white flex items-center gap-3">
                <FileText class="w-8 h-8 text-primary" />
                CMS Pages Manager
              </h2>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div v-for="slug in ['about-us', 'terms-of-service', 'privacy-policy', 'contact-support', 'faq', 'how-to-top-up', 'payment-methods']" :key="slug" class="bg-[#12121a]/80 p-5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all flex justify-between items-center group">
                <div>
                  <h3 class="text-white font-bold capitalize">{{ slug.replace(/-/g, ' ') }}</h3>
                  <p class="text-xs text-gray-500 mt-1">/page/{{ slug }}</p>
                </div>
                <button @click="openEditPage(slug)" class="p-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-primary hover:text-darker hover:shadow-lg hover:shadow-primary/20 transition-all group-hover:scale-110" title="Edit Page Content">
                  <Edit class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Management Section -->
        <div v-if="activeTab === 'settings'" class="animate-fade-in">
          <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 class="text-2xl font-black font-outfit text-white flex items-center gap-3">
                  <Settings class="w-8 h-8 text-primary" />
                  Site Settings & Contact Channels
                </h2>
                <p class="text-xs text-gray-400 mt-1">Manage Telegram support button and live customer communication channels</p>
              </div>

              <button 
                @click="saveSettings" 
                :disabled="isSavingSettings"
                class="px-6 py-3 bg-primary text-darker font-bold rounded-xl hover:bg-yellow-400 transition-all text-sm flex items-center gap-2 shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw v-if="isSavingSettings" class="w-4 h-4 animate-spin" />
                <CheckCircle2 v-else class="w-4 h-4" />
                <span>{{ isSavingSettings ? 'Saving...' : 'Save Changes' }}</span>
              </button>
            </div>

            <!-- Settings Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <!-- Telegram Support Card -->
              <div class="bg-[#12121a]/80 p-6 md:p-7 rounded-2xl border border-white/5 space-y-6">
                <div class="flex items-center justify-between pb-4 border-b border-white/5">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#229ED9] to-[#2BAAE2] flex items-center justify-center text-white shadow-lg shadow-[#229ED9]/20">
                      <svg class="w-6 h-6 fill-current -translate-x-0.5 translate-y-0.5" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-white font-bold text-base">Telegram Customer Support</h3>
                      <p class="text-xs text-gray-400">Floating contact button on bottom-right of website</p>
                    </div>
                  </div>

                  <!-- Toggle Enable/Disable -->
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="siteSettings.telegramEnabled" class="sr-only peer">
                    <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#229ED9]"></div>
                  </label>
                </div>

                <!-- Telegram Username Input -->
                <div class="space-y-2">
                  <label class="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
                    Telegram Username
                  </label>
                  <div class="relative flex items-center">
                    <span class="absolute left-4 text-gray-500 font-bold text-sm">@</span>
                    <input 
                      type="text" 
                      v-model="siteSettings.telegramUsername" 
                      placeholder="username (e.g. pheak_topup)"
                      class="w-full pl-9 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#229ED9] transition-colors"
                    />
                  </div>
                  <p class="text-[11px] text-gray-500">
                    Customers who click the floating button will open a direct chat with this Telegram username.
                  </p>
                </div>

                <!-- Preview Link Box -->
                <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Direct Chat Link:</span>
                    <a 
                      :href="`https://t.me/${(siteSettings.telegramUsername || '').replace(/^@/, '').trim()}`" 
                      target="_blank" 
                      class="text-xs font-mono text-[#2BAAE2] hover:underline flex items-center gap-1.5 mt-0.5"
                    >
                      <span>https://t.me/{{ (siteSettings.telegramUsername || '').replace(/^@/, '').trim() || 'your_username' }}</span>
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <a 
                    :href="`https://t.me/${(siteSettings.telegramUsername || '').replace(/^@/, '').trim()}`" 
                    target="_blank" 
                    class="px-4 py-2 bg-[#229ED9]/10 text-[#2BAAE2] hover:bg-[#229ED9]/20 font-semibold rounded-lg text-xs transition-colors self-start sm:self-center"
                  >
                    Test Open Link
                  </a>
                </div>
              </div>

              <!-- Information / Helper Card -->
              <div class="bg-[#12121a]/80 p-6 md:p-7 rounded-2xl border border-white/5 flex flex-col justify-between">
                <div>
                  <h3 class="text-white font-bold text-base mb-3 flex items-center gap-2">
                    <CheckCircle2 class="w-5 h-5 text-emerald-400" />
                    How the Telegram Support Button Works
                  </h3>
                  <ul class="space-y-3 text-xs text-gray-400 leading-relaxed">
                    <li class="flex items-start gap-2">
                      <span class="text-primary font-bold">•</span>
                      <span>The floating button appears on the <strong>bottom-right corner</strong> of all store pages.</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary font-bold">•</span>
                      <span>When a customer needs help with an order, payment, or top-up, they click the button and immediately start chatting with you on Telegram.</span>
                    </li>
                    <li class="flex items-start gap-2">
                      <span class="text-primary font-bold">•</span>
                      <span>You can change your Telegram username anytime right here, and the website updates in real-time.</span>
                    </li>
                  </ul>
                </div>

                <div class="pt-6 border-t border-white/5 mt-6">
                  <button 
                    @click="saveSettings" 
                    :disabled="isSavingSettings"
                    class="w-full py-3 bg-primary text-darker font-bold rounded-xl hover:bg-yellow-400 transition-all text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/20 active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw v-if="isSavingSettings" class="w-4 h-4 animate-spin" />
                    <CheckCircle2 v-else class="w-4 h-4" />
                    <span>{{ isSavingSettings ? 'Saving...' : 'Save Settings Now' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- Pricing Modal -->
    <div v-if="showPricingModal" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-3xl relative my-auto">
        <button @click="showPricingModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-1">Manage Prices & Profit</h3>
        <p class="text-gray-400 text-sm mb-5">Edit sell prices and monitor live profit margins for {{ selectedGameForPricing?.name }}</p>

        <!-- MooGold Pricing & Quick Markup Toolbar -->
        <div class="mb-5 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-transparent border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0">
              💎
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MooGold Direct Top-Up</span>
                <span class="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Official Catalog</span>
              </div>
              <p class="text-white font-extrabold text-sm sm:text-base">
                Direct USD Pricing & Live Margins
              </p>
            </div>
          </div>
          
          <!-- Bulk Markup Quick Actions -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span v-if="gamePackages.some(p => p.isFeatured)" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 mr-1 shadow-sm">
              <Star class="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {{ gamePackages.filter(p => p.isFeatured).length }} Featured
            </span>
            <span class="text-[11px] text-gray-400 font-semibold mr-1">Quick Profit:</span>
            <button @click="applyBulkMargin(5)" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all">+5%</button>
            <button @click="applyBulkMargin(10)" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition-all">+10%</button>
            <button @click="applyBulkMargin(15)" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all">+15%</button>
            <button @click="applyBulkMargin(20)" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all">+20%</button>
            <button @click="resetToOriginal" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all">Reset</button>
          </div>
        </div>
        
        <div v-if="isFetchingPackages" class="flex justify-center py-10">
          <RefreshCw class="w-8 h-8 text-primary animate-spin" />
        </div>
        
        <div v-else class="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          <div 
            v-for="pkg in gamePackages" 
            :key="pkg.id" 
            class="rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
            :class="[
              pkg.isFeatured 
                ? 'bg-amber-500/[0.06] border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.08)]' 
                : 'bg-white/5 border border-white/10 hover:border-white/20'
            ]"
          >
            <!-- Left: Icon & Name -->
            <div class="font-bold text-white text-sm md:w-5/12 flex items-center gap-3">
              <div class="relative w-16 h-16 shrink-0 bg-black/50 border border-white/10 rounded-2xl overflow-hidden group p-1 shadow-md">
                <img v-if="pkg.customImage" :src="pkg.customImage" class="w-full h-full object-contain filter drop-shadow" />
                <div v-else class="w-full h-full flex items-center justify-center text-xl">💎</div>
                
                <label :for="'pkg-img-' + pkg.id" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-sm">
                  <RefreshCw v-if="isUploadingPackageImage[pkg.id]" class="w-4 h-4 text-primary animate-spin" />
                  <UploadCloud v-else class="w-4 h-4 text-white" />
                </label>
                <input 
                  :id="'pkg-img-' + pkg.id" 
                  type="file" 
                  accept="image/*" 
                  class="hidden" 
                  @change="(e) => handlePackageImageUpload(e, pkg)"
                  :disabled="isUploadingPackageImage[pkg.id]"
                />
              </div>
              <div class="truncate">
                <div class="flex items-center gap-2">
                  <p class="text-white font-semibold text-sm leading-tight truncate">{{ pkg.name }}</p>
                  <span v-if="pkg.isFeatured" class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    Featured
                  </span>
                </div>
                <p class="text-[11px] text-gray-500 mt-0.5 font-mono">SKU: <span class="text-gray-400">{{ pkg.id }}</span></p>
              </div>
            </div>
            
            <!-- Right: Cost in USD, Featured Toggle, Sell For, and Profit badge -->
            <div class="flex items-center justify-between md:justify-end gap-3 sm:gap-6 w-full md:w-7/12 flex-wrap sm:flex-nowrap">
              <!-- MooGold Cost (USD) -->
              <div class="flex flex-col text-left md:text-right shrink-0">
                <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider">MooGold Cost</span>
                <span class="text-gray-200 font-extrabold text-sm">${{ pkg.originalPrice.toFixed(2) }}</span>
              </div>

              <!-- Featured Toggle Button -->
              <div class="flex flex-col items-center shrink-0">
                <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Badge</span>
                <button 
                  type="button"
                  @click="pkg.isFeatured = !pkg.isFeatured"
                  class="px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none"
                  :class="pkg.isFeatured 
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/40' 
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'"
                  :title="pkg.isFeatured ? 'Featured: shown at top on frontend' : 'Click to feature at top on frontend'"
                >
                  <Star class="w-3.5 h-3.5" :class="pkg.isFeatured ? 'fill-amber-400 text-amber-400' : 'text-gray-400'" />
                  <span>{{ pkg.isFeatured ? 'Featured' : 'Feature' }}</span>
                </button>
              </div>
              
              <!-- Sell Price Input + Profit Badge -->
              <div class="flex flex-col items-end">
                <span class="text-primary text-[10px] uppercase font-bold tracking-wider mb-1">Sell Price (USD)</span>
                <div class="relative w-28">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                  <input 
                    v-model.number="pkg.customPrice" 
                    type="number" 
                    step="0.01" 
                    class="w-full bg-[#12121a] border border-white/10 rounded-xl pl-7 pr-3 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-bold text-right"
                  />
                </div>
                <!-- Real-time Profit Badge -->
                <div class="mt-1 text-[11px] font-bold">
                  <span v-if="pkg.customPrice > pkg.originalPrice" class="text-emerald-400 flex items-center gap-0.5">
                    +${{ (pkg.customPrice - pkg.originalPrice).toFixed(2) }} 
                    <span class="text-emerald-500/80">({{ Math.round(((pkg.customPrice - pkg.originalPrice) / pkg.originalPrice) * 100) }}%)</span>
                  </span>
                  <span v-else-if="pkg.customPrice < pkg.originalPrice" class="text-red-400">
                    -${{ (pkg.originalPrice - pkg.customPrice).toFixed(2) }} loss
                  </span>
                  <span v-else class="text-gray-500">
                    0% margin (at cost)
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="gamePackages.length === 0" class="text-center text-gray-400 font-bold py-6 bg-white/5 rounded-xl border border-white/10">
            No items found for this game.
          </div>
        </div>
        
        <div class="mt-6 flex gap-3">
          <button @click="showPricingModal = false" class="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
            Cancel
          </button>
          <button @click="savePrices" :disabled="isSavingPrices" class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20" :class="{'opacity-50 cursor-not-allowed': isSavingPrices}">
            <RefreshCw v-if="isSavingPrices" class="w-5 h-5 animate-spin" />
            {{ isSavingPrices ? 'Saving...' : 'Save Prices' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Page Modal -->
    <div v-if="showPageModal" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-4xl relative my-auto">
        <button @click="showPageModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-6">Edit Page: <span class="text-primary">{{ pageForm.slug }}</span></h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Page Title</label>
            <input v-model="pageForm.title" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Page Content (HTML/Markdown supported via prose)</label>
            <textarea v-model="pageForm.content" rows="12" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm"></textarea>
          </div>
        </div>
        
        <div class="mt-8 flex gap-3">
          <button @click="showPageModal = false" class="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
            Cancel
          </button>
          <button @click="savePage" :disabled="isSavingPage" class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2" :class="{'opacity-50 cursor-not-allowed': isSavingPage}">
            <RefreshCw v-if="isSavingPage" class="w-5 h-5 animate-spin" />
            {{ isSavingPage ? 'Saving...' : 'Save Content' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Crop Banner Modal -->
    <div v-if="showBannerCropModal" class="fixed inset-0 z-[160] flex items-center justify-center bg-darker/85 backdrop-blur-md animate-fade-in p-3 sm:p-6 overflow-y-auto">
      <div class="glass-card p-5 sm:p-7 rounded-3xl border border-white/10 shadow-2xl w-full max-w-4xl relative my-auto">
        <!-- Close Button -->
        <button @click="closeBannerCropModal" class="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>

        <!-- Header -->
        <div class="flex items-center gap-3 mb-2">
          <div class="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Crop class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-xl sm:text-2xl font-black font-outfit text-white">Crop Cover Banner</h3>
            <p class="text-xs sm:text-sm text-gray-400">Position and frame the banner for <span class="text-primary font-bold">{{ bannerCropGame?.name }}</span></p>
          </div>
        </div>

        <!-- Aspect Ratio Selection Tabs -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 bg-white/5 border border-white/10 p-2 rounded-2xl">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs text-gray-400 font-bold px-2 uppercase tracking-wider">Aspect Ratio:</span>
            <button 
              type="button" 
              @click="setBannerCropRatio('16/9')"
              :class="bannerCropRatio === '16/9' ? 'bg-primary text-darker font-bold shadow-md shadow-primary/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5"
            >
              <Smartphone class="w-3.5 h-3.5" />
              <span>16:9</span>
              <span class="text-[10px] opacity-80">(Full Wallpaper / Mobile)</span>
            </button>
            <button 
              type="button" 
              @click="setBannerCropRatio('3/1')"
              :class="bannerCropRatio === '3/1' ? 'bg-primary text-darker font-bold shadow-md shadow-primary/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1"
            >
              <span>3:1</span>
              <span class="text-[10px] opacity-80">(Balanced)</span>
            </button>
            <button 
              type="button" 
              @click="setBannerCropRatio('4/1')"
              :class="bannerCropRatio === '4/1' ? 'bg-primary text-darker font-bold shadow-md shadow-primary/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'"
              class="px-3 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5"
            >
              <Monitor class="w-3.5 h-3.5" />
              <span>4:1</span>
              <span class="text-[10px] opacity-80">(Desktop Wide)</span>
            </button>
          </div>
        </div>

        <!-- Crop Viewport Window -->
        <div class="mt-4">
          <div class="flex items-center justify-between text-xs text-gray-400 mb-1.5 px-1">
            <span class="flex items-center gap-1 font-semibold text-gray-300">
              <Move class="w-3.5 h-3.5 text-primary" /> Drag image to position
            </span>
            <span class="text-[11px] font-mono text-gray-400">Ratio: {{ bannerCropRatio }}</span>
          </div>

          <div 
            ref="cropViewportRef"
            :class="bannerCropRatio === '16/9' ? 'aspect-video' : bannerCropRatio === '4/1' ? 'aspect-[4/1]' : bannerCropRatio === '2.2/1' ? 'aspect-[2.2/1]' : 'aspect-[3/1]'"
            class="relative w-full max-h-[380px] overflow-hidden rounded-2xl bg-black border-2 border-primary/50 cursor-grab active:cursor-grabbing select-none shadow-[0_0_30px_rgba(0,0,0,0.8)] touch-none transition-[aspect-ratio] duration-200"
            @mousedown="onBannerPanStart"
            @mousemove="onBannerPanMove"
            @mouseup="onBannerPanEnd"
            @mouseleave="onBannerPanEnd"
            @touchstart="onBannerTouchStart"
            @touchmove="onBannerTouchMove"
            @touchend="onBannerTouchEnd"
            @wheel.prevent="onBannerWheel"
          >
            <!-- Image to be cropped -->
            <img 
              :src="bannerCropImageSrc"
              class="absolute pointer-events-none select-none max-w-none transition-none"
              :style="cropImageStyle"
            />

            <!-- Rule of Thirds Grid Overlay -->
            <div class="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-25">
              <div class="border-r border-b border-white"></div>
              <div class="border-r border-b border-white"></div>
              <div class="border-b border-white"></div>
              <div class="border-r border-b border-white"></div>
              <div class="border-r border-b border-white"></div>
              <div class="border-b border-white"></div>
              <div class="border-r border-b border-white"></div>
              <div class="border-r border-b border-white"></div>
              <div></div>
            </div>

            <!-- Hint pill -->
            <div class="absolute top-2.5 left-1/2 -translate-x-1/2 pointer-events-none bg-black/70 backdrop-blur border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-gray-300 shadow">
              🖱️ Drag to pan · Scroll to zoom
            </div>
          </div>
        </div>

        <!-- Zoom & Viewport Controls -->
        <div class="mt-4 bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <!-- Zoom Slider -->
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Zoom:</span>
            <button 
              type="button" 
              @click="bannerZoom = Math.max(1, parseFloat((bannerZoom - 0.1).toFixed(2)))" 
              class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10"
              title="Zoom Out"
            >
              <ZoomOut class="w-4 h-4" />
            </button>
            <input 
              type="range" 
              min="1" 
              max="3" 
              step="0.01" 
              v-model.number="bannerZoom" 
              class="w-full sm:w-44 accent-primary cursor-pointer" 
            />
            <button 
              type="button" 
              @click="bannerZoom = Math.min(3, parseFloat((bannerZoom + 0.1).toFixed(2)))" 
              class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10"
              title="Zoom In"
            >
              <ZoomIn class="w-4 h-4" />
            </button>
            <span class="text-xs font-mono font-bold text-primary min-w-[3rem] text-right">
              {{ Math.round(bannerZoom * 100) }}%
            </span>
          </div>

          <!-- Reset Button -->
          <button 
            type="button" 
            @click="resetBannerCrop" 
            class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Framing</span>
          </button>
        </div>

        <!-- Live Frontend Storefront Preview (Mirrors TopUp.vue banner) -->
        <div class="mt-4 pt-4 border-t border-white/10">
          <div class="flex items-center justify-between mb-2 px-1">
            <span class="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye class="w-3.5 h-3.5 text-primary" /> Live Storefront Preview
            </span>
            <!-- Desktop vs Mobile Preview Switcher -->
            <div class="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
              <button 
                type="button" 
                @click="bannerPreviewMode = 'mobile'"
                :class="bannerPreviewMode === 'mobile' ? 'bg-primary text-darker font-bold' : 'text-gray-400 hover:text-white'"
                class="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all"
              >
                <Smartphone class="w-3.5 h-3.5" />
                Mobile (Phone)
              </button>
              <button 
                type="button" 
                @click="bannerPreviewMode = 'desktop'"
                :class="bannerPreviewMode === 'desktop' ? 'bg-primary text-darker font-bold' : 'text-gray-400 hover:text-white'"
                class="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all"
              >
                <Monitor class="w-3.5 h-3.5" />
                Desktop
              </button>
            </div>
          </div>

          <!-- Preview Container -->
          <div 
            :class="bannerPreviewMode === 'mobile' ? 'max-w-[340px] aspect-video mx-auto rounded-2xl' : (bannerCropRatio === '16/9' ? 'aspect-video' : bannerCropRatio === '4/1' ? 'aspect-[4/1]' : bannerCropRatio === '2.2/1' ? 'aspect-[2.2/1]' : 'aspect-[3/1]') + ' w-full rounded-2xl'"
            class="relative overflow-hidden border border-white/10 shadow-xl bg-black transition-all duration-300"
          >
            <!-- Mirrored Cropped Image -->
            <img 
              :src="bannerCropImageSrc"
              class="absolute pointer-events-none select-none max-w-none"
              :style="cropImageStyle"
            />
            
            <!-- Exact overlay gradient from TopUp.vue -->
            <div class="absolute inset-0 bg-gradient-to-t from-darker/90 via-darker/30 to-transparent"></div>

            <!-- Exact game avatar & title layout from TopUp.vue -->
            <div 
              :class="bannerPreviewMode === 'mobile' ? 'p-3 flex items-end gap-2.5' : 'p-3 sm:p-5 flex items-end gap-3 sm:gap-4'"
              class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-darker via-darker/80 to-transparent"
            >
              <div 
                :class="bannerPreviewMode === 'mobile' ? 'w-10 h-10 rounded-lg' : 'w-10 h-10 sm:w-16 sm:h-16 rounded-xl'"
                class="shrink-0 bg-[#161622] border-2 border-primary overflow-hidden shadow-lg"
              >
                <img v-if="bannerCropGame?.image" :src="bannerCropGame.image" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full bg-white/10"></div>
              </div>
              <div class="min-w-0">
                <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/20 mb-0.5 backdrop-blur-md">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  <span class="text-[8px] sm:text-[9px] font-bold text-white uppercase tracking-wider">Official Partner</span>
                </div>
                <h4 
                  :class="bannerPreviewMode === 'mobile' ? 'text-xs leading-tight' : 'text-sm sm:text-xl leading-tight'"
                  class="font-black font-outfit text-white drop-shadow-md truncate"
                >
                  {{ bannerCropGame?.name }}
                </h4>
                <p class="text-gray-300 text-[9px] sm:text-xs drop-shadow truncate">{{ bannerCropGame?.publisher }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="mt-6 flex flex-col sm:flex-row gap-3">
          <button 
            type="button" 
            @click="closeBannerCropModal" 
            class="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10"
          >
            Cancel
          </button>
          <button 
            v-if="bannerCropRawFile"
            type="button" 
            @click="uploadOriginalBanner" 
            :disabled="isCroppingBanner" 
            class="flex-1 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all flex items-center justify-center gap-2 border border-white/20 shadow-md" 
            :class="{'opacity-50 cursor-not-allowed': isCroppingBanner}"
            title="Upload the full original image file without cropping"
          >
            <Upload class="w-4 h-4 text-primary" />
            <span>Upload Full Original (No Crop)</span>
          </button>
          <button 
            type="button" 
            @click="saveCroppedBanner" 
            :disabled="isCroppingBanner" 
            class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20" 
            :class="{'opacity-50 cursor-not-allowed': isCroppingBanner}"
          >
            <RefreshCw v-if="isCroppingBanner" class="w-5 h-5 animate-spin" />
            <Crop v-else class="w-5 h-5" />
            {{ isCroppingBanner ? 'Saving...' : 'Apply & Save Banner' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditUserModal" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg relative my-auto">
        <button @click="showEditUserModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-6">Edit User</h3>
        
        <form @submit.prevent="saveUser" class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Username</label>
            <input v-model="userForm.username" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" required />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Email</label>
            <input v-model="userForm.email" type="email" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" required />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-bold text-gray-400 mb-1">Balance ($)</label>
              <input v-model.number="userForm.balance" type="number" step="0.01" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" required />
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-400 mb-1">Role</label>
              <select v-model="userForm.role" class="w-full bg-[#12121a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          
          <div class="mt-8 flex gap-3 pt-4">
            <button type="button" @click="showEditUserModal = false" class="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
              Cancel
            </button>
            <button type="submit" :disabled="isSavingUser" class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2" :class="{'opacity-50 cursor-not-allowed': isSavingUser}">
              <RefreshCw v-if="isSavingUser" class="w-5 h-5 animate-spin" />
              {{ isSavingUser ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- User Transactions Modal -->
    <div v-if="selectedUserTransactions" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-3xl relative my-auto">
        <button @click="selectedUserTransactions = null" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-6 flex items-center gap-2">
          <ListOrdered class="w-6 h-6 text-primary" />
          User Transactions
        </h3>
        
        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div v-if="selectedUserTransactions.length === 0" class="text-center text-gray-400 py-12 bg-white/5 rounded-2xl border border-white/10 font-bold">
            No transactions found for this user.
          </div>
          
          <div v-for="t in selectedUserTransactions" :key="t._id" class="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center hover:bg-white/10 transition-all hover:scale-[1.01] group">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl bg-darker flex items-center justify-center border border-white/5 overflow-hidden group-hover:border-primary/30 transition-colors">
                 <Gamepad2 class="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 class="font-bold text-white">{{ t.gameName || 'Game Topup' }}</h4>
                <div class="text-sm font-semibold text-gray-400 flex items-center gap-2 mt-1">
                  <span class="bg-black/30 px-2 py-0.5 rounded text-xs border border-white/5">{{ t.playerId }}</span>
                  <span class="text-xs">{{ new Date(t.createdAt).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-black font-outfit text-white text-lg">${{ Number(t.price).toFixed(2) }}</div>
              <div class="text-xs font-bold uppercase tracking-wide mt-1 px-2 py-0.5 rounded-full inline-block border"
                :class="{
                  'bg-green-500/10 text-green-400 border-green-500/20': t.status === 'completed',
                  'bg-amber-500/10 text-amber-400 border-amber-500/20': t.status === 'pending' || t.status === 'processing',
                  'bg-red-500/10 text-red-400 border-red-500/20': t.status === 'failed'
                }">
                {{ t.status === 'processing' ? 'Sending' : t.status }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Slider Modal -->
    <div v-if="showSliderModal" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl relative my-auto">
        <button @click="showSliderModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-6">{{ editingSlider ? 'Edit Slider' : 'Add New Slider' }}</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Title</label>
            <input v-model="sliderForm.title" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g., Mobile Legends: Bang Bang" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Subtitle</label>
            <input v-model="sliderForm.subtitle" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g., Get your diamonds instantly" />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Route Link</label>
            <input v-model="sliderForm.link" type="text" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-mono text-sm" placeholder="e.g., /game/6ac33dd..." />
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-400 mb-1">Image (Upload new to replace)</label>
            <input type="file" @change="handleSliderFormImage" accept="image/*" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
          </div>
          <div class="flex items-center gap-3 pt-2">
            <input v-model="sliderForm.isActive" type="checkbox" id="isActive" class="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-white/10" />
            <label for="isActive" class="text-sm font-bold text-white cursor-pointer">Published (Active)</label>
          </div>
        </div>
        
        <div class="mt-8 flex gap-3">
          <button @click="showSliderModal = false" class="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
            Cancel
          </button>
          <button @click="saveSlider" :disabled="isSavingSlider" class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2" :class="{'opacity-50 cursor-not-allowed': isSavingSlider}">
            <RefreshCw v-if="isSavingSlider" class="w-5 h-5 animate-spin" />
            {{ isSavingSlider ? 'Saving...' : 'Save Slider' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Generic Confirm Modal -->
    <div v-if="confirmDialog.isOpen" class="fixed inset-0 z-[160] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full mx-auto text-center relative overflow-hidden transform transition-all scale-100 my-auto">
        <div class="absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full" :class="confirmDialog.isDanger ? 'bg-red-500/20' : 'bg-primary/20'"></div>
        <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border relative z-10" :class="confirmDialog.isDanger ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-primary/10 text-primary border-primary/20'">
          <AlertCircle class="w-8 h-8" />
        </div>
        <h3 class="text-2xl font-black font-outfit text-white mb-2 relative z-10">{{ confirmDialog.title }}</h3>
        <p class="text-gray-400 mb-8 text-sm relative z-10">{{ confirmDialog.message }}</p>
        
        <div class="flex gap-3 relative z-10">
          <button @click="confirmDialog.isOpen = false" class="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
            Cancel
          </button>
          <button @click="executeConfirm" class="flex-1 py-3 px-4 rounded-xl text-darker font-bold shadow-lg transition-all" :class="confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white' : 'bg-primary hover:bg-primary/90 shadow-primary/20 text-darker'">
            {{ confirmDialog.confirmText }}
          </button>
        </div>
      </div>
    </div>
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
    <!-- Update Transaction Status Modal -->
    <div v-if="showTxStatusModal" class="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showTxStatusModal = false"></div>
      <div class="glass-card max-w-lg w-full p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10 bg-[#0d0f14] overflow-hidden">
        <!-- Close Button -->
        <button @click="showTxStatusModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>

        <h3 class="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Edit class="w-5 h-5 text-primary" />
          Update Transaction Status
        </h3>
        <p class="text-xs text-gray-400 mb-6">Manually adjust payment and diamond delivery statuses for this order.</p>

        <!-- Order Summary Card -->
        <div v-if="editingTx" class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-400">Game & Player:</span>
            <span class="text-white font-semibold">{{ editingTx.gameId?.name || 'Unknown' }} ({{ editingTx.playerId }})</span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span class="text-gray-400">Item & Price:</span>
            <span class="text-primary font-bold">{{ editingTx.amount }} 💎 (${{ Number(editingTx.price).toFixed(2) }})</span>
          </div>
          <div class="flex justify-between items-center text-sm" v-if="editingTx.providerReference">
            <span class="text-gray-400">Order Reference:</span>
            <span class="text-amber-400 font-mono text-xs">#{{ editingTx.providerReference }}</span>
          </div>
        </div>

        <form @submit.prevent="saveTxStatus" class="space-y-4">
          <!-- 1. Payment Status -->
          <div>
            <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Payment Status (User Money)
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button" 
                @click="editPaymentStatus = 'paid'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editPaymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                Paid
              </button>
              <button 
                type="button" 
                @click="editPaymentStatus = 'unpaid'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editPaymentStatus === 'unpaid' ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <Clock class="w-3.5 h-3.5" />
                Unpaid
              </button>
              <button 
                type="button" 
                @click="editPaymentStatus = 'refunded'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editPaymentStatus === 'refunded' ? 'bg-purple-500/20 text-purple-400 border-purple-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <Wallet class="w-3.5 h-3.5" />
                Refunded
              </button>
            </div>
          </div>

          <!-- 2. Diamond Delivery Status -->
          <div>
            <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Diamond Delivery Status (In-Game Delivery)
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button" 
                @click="editDeliveryStatus = 'delivered'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editDeliveryStatus === 'delivered' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                Delivered
              </button>
              <button 
                type="button" 
                @click="editDeliveryStatus = 'sending'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editDeliveryStatus === 'sending' ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <RefreshCw class="w-3.5 h-3.5" />
                Sending
              </button>
              <button 
                type="button" 
                @click="editDeliveryStatus = 'failed'"
                class="py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                :class="editDeliveryStatus === 'failed' ? 'bg-rose-500/20 text-rose-400 border-rose-500 shadow-sm' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'"
              >
                <XCircle class="w-3.5 h-3.5" />
                Failed
              </button>
            </div>
          </div>

          <!-- 3. Notes / Error Details -->
          <div>
            <label class="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Admin Note / Reason
            </label>
            <input 
              v-model="editErrorDetails" 
              type="text" 
              placeholder="e.g. Manually delivered in game, or Refunded to customer"
              class="w-full bg-darker/60 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <!-- Buttons -->
          <div class="flex items-center gap-3 pt-4">
            <button 
              type="button" 
              @click="showTxStatusModal = false"
              class="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              :disabled="isSavingTxStatus"
              class="flex-1 py-3 rounded-xl bg-primary hover:bg-yellow-400 text-darker font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              <RefreshCw v-if="isSavingTxStatus" class="w-4 h-4 animate-spin" />
              Save Status
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MooGold Import Modal -->
    <div v-if="showMoogoldModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showMoogoldModal = false"></div>
      
      <div class="relative bg-darker border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div class="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-amber-900/30 to-yellow-900/30">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <Plus class="w-5 h-5 text-amber-400" />
            Import Game from MooGold
          </h3>
          <button @click="showMoogoldModal = false" class="text-gray-400 hover:text-white transition-colors">
            <XCircle class="w-6 h-6" />
          </button>
        </div>
        
        <div class="p-6 border-b border-white/10">
          <div class="relative w-full">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              v-model="searchMoogoldQuery" 
              placeholder="Search MooGold games (e.g. Mobile Legends, Free Fire, PUBG)..." 
              class="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1">
          <div v-if="isFetchingMoogold" class="flex flex-col items-center justify-center py-12 text-gray-400">
            <RefreshCw class="w-8 h-8 animate-spin mb-4 text-amber-400" />
            <p>Fetching active games from MooGold API...</p>
          </div>
          <div v-else-if="filteredMoogoldGames.length === 0" class="text-center py-8 text-gray-500">
            No games found.
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="mgGame in filteredMoogoldGames" :key="mgGame.ID || mgGame.moogoldId" class="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-amber-500/50 transition-all">
              <div class="flex items-center gap-3 flex-1 truncate pr-3">
                <img :src="mgGame.sampleImage" class="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
                <div class="truncate">
                  <p class="text-white font-semibold truncate">{{ mgGame.name || mgGame.post_title }}</p>
                  <p class="text-xs text-amber-400 font-medium font-mono">ID: {{ mgGame.ID || mgGame.moogoldId }}</p>
                </div>
              </div>
              <button @click="importMoogoldGame(mgGame)" class="bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/50 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap">
                Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

