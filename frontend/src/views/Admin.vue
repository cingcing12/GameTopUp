<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { 
  CheckCircle2, XCircle, Clock, Search, RefreshCw, 
  Activity, DollarSign, Users, Package, LayoutDashboard, 
  Settings, LogOut, ShieldAlert, ChevronRight, Gamepad2, UploadCloud, Image as ImageIcon,
  AlertCircle, LayoutTemplate, Plus, Edit, Trash2, Eye, EyeOff, Lock, Unlock, ListOrdered, FileText
} from 'lucide-vue-next'

const router = useRouter()

// Authentication State
const isAdmin = ref(localStorage.getItem('isAdmin') === 'true')
const emailInput = ref('')
const passwordInput = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)
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
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    })
    
    const data = await res.json()
    
    if (res.ok && data.user && data.user.role === 'admin') {
      isAdmin.value = true
      localStorage.setItem('isAdmin', 'true')
      localStorage.setItem('adminToken', data.token) // Optionally store token for secure backend calls later
      fetchTransactions()
      fetchUsers()
      fetchPages()
    } else if (res.ok) {
      loginError.value = 'Access Denied: You are not an admin.'
    } else {
      loginError.value = data.message || 'Invalid email or password'
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
  isAdmin.value = false
  localStorage.removeItem('isAdmin')
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
  return moogoldGames.value.filter(g => g.post_title && g.post_title.toLowerCase().includes(q))
})

const openMoogoldModal = async () => {
  showMoogoldModal.value = true
  if (moogoldGames.value.length === 0) {
    isFetchingMoogold.value = true
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const res = await fetch(`${apiUrl}/api/moogold/games`)
      if (res.ok) {
        moogoldGames.value = await res.json()
      }
    } catch (error) {
      showToast('Failed to fetch MooGold games', 'error')
    } finally {
      isFetchingMoogold.value = false
    }
  }
}

const importGame = async (mgGame) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/games`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({
        name: mgGame.post_title,
        moogoldId: mgGame.ID,
        publisher: 'MooGold',
        image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=600&q=80', // Default placeholder
        isActive: false
      })
    })
    
    if (res.ok) {
      const newGame = await res.json()
      games.value.push(newGame)
      showToast(`${mgGame.post_title} imported!`, 'success')
      showMoogoldModal.value = false
    } else {
      showToast('Failed to import game', 'error')
    }
  } catch (error) {
    showToast('Error importing game', 'error')
  }
}

const users = ref([])
const isFetchingUsers = ref(false)
const selectedUserTransactions = ref(null)

const fetchUsers = async () => {
  isFetchingUsers.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/users`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
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
        const res = await fetch(`${apiUrl}/api/users/${user._id}/block`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
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
        const res = await fetch(`${apiUrl}/api/users/${user._id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
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
    const res = await fetch(`${apiUrl}/api/transactions?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
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
    const res = await fetch(`${apiUrl}/api/users/${editingUser.value._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
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
    const res = await fetch(`${apiUrl}/api/pages`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
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
    const res = await fetch(`${apiUrl}/api/pages/${pageForm.value.slug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
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

// Pricing Management
const showPricingModal = ref(false)
const selectedGameForPricing = ref(null)
const gamePackages = ref([])
const isFetchingPackages = ref(false)
const isSavingPrices = ref(false)

const openPricingModal = async (game) => {
  selectedGameForPricing.value = game
  showPricingModal.value = true
  isFetchingPackages.value = true
  gamePackages.value = []
  
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const moogoldId = game.moogoldId || game._id
    const res = await fetch(`${apiUrl}/api/moogold/products/${moogoldId}`)
    const data = await res.json()
    
    if (res.ok && data && data.Variation) {
      gamePackages.value = data.Variation.map(v => {
          let cleanName = v.variation_name || '';
          if (cleanName.includes(' - ')) {
              cleanName = cleanName.substring(cleanName.indexOf(' - ') + 3);
          }
          cleanName = cleanName.replace(/\(\#\d+\)/g, '').trim();
          return {
            id: v.variation_id,
            name: cleanName,
            originalPrice: parseFloat(v.original_price || v.variation_price),
            customPrice: parseFloat(v.variation_price)
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
    gamePackages.value.forEach(p => {
      customPrices[p.id] = p.customPrice
    })
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/games/${selectedGameForPricing.value._id}/prices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
      body: JSON.stringify({ customPrices })
    })
    
    if (res.ok) {
      showToast('Prices updated successfully', 'success')
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
    const res = await fetch(`${apiUrl}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
    const data = await res.json()
    if (res.ok) {
      transactions.value = data
    } else if (res.status === 401) {
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
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/games/${game._id}`, {
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
    const res = await fetch(`${apiUrl}/api/games/${game._id}`, {
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

const handleImageUpload = async (event, game, type = 'image') => {
  const file = event.target.files[0]
  if (!file) return
  
  if (type === 'banner') isUploadingBanner.value[game._id] = true
  else isUploading.value[game._id] = true
  
  try {
    const formData = new FormData()
    formData.append(type, file)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/games/${game._id}`, {
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

const handleSliderUpload = async (event, slider) => {
  const file = event.target.files[0]
  if (!file) return
  
  isUploadingSlider.value[slider._id] = true
  
  try {
    const formData = new FormData()
    formData.append('image', file)
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/sliders/${slider._id}`, {
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

    const res = await fetch(url, { method, body: formData })
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
        const res = await fetch(`${apiUrl}/api/sliders/${slider._id}`, { method: 'DELETE' })
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
    
    const res = await fetch(`${apiUrl}/api/sliders/${slider._id}`, {
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

onMounted(() => {
  if (isAdmin.value) {
    fetchTransactions()
    fetchUsers()
    fetchPages()
  }
})

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)

const searchedTransactions = computed(() => {
  if (!searchQuery.value) return transactions.value
  const query = searchQuery.value.toLowerCase()
  return transactions.value.filter(t => 
    t.playerId.toLowerCase().includes(query) ||
    t.paymentMethod.toLowerCase().includes(query) ||
    t.status.toLowerCase().includes(query)
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
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.price), 0)
    .toFixed(2)
})

const totalOrders = computed(() => transactions.value.length)

const successfulOrders = computed(() => {
  return transactions.value.filter(t => t.status === 'completed').length
})

// UI Helpers
const getStatusColor = (status) => {
  if (status === 'completed') return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (status === 'failed') return 'text-red-400 bg-red-400/10 border-red-400/20'
  return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
}

const getStatusIcon = (status) => {
  if (status === 'completed') return CheckCircle2
  if (status === 'failed') return XCircle
  return Clock
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <!-- Admin Login Screen -->
  <div v-if="!isAdmin" class="min-h-screen flex items-center justify-center p-4">
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
              class="w-full bg-white/5 border border-white/10 text-white p-4 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
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

  <!-- Admin Dashboard Layout -->
  <div v-else class="flex h-screen overflow-hidden text-gray-200">
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
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5"
        >
          <Settings class="w-4 h-4" />
          Settings (Coming Soon)
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
          
          <button @click="fetchTransactions" class="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl border border-white/10 font-semibold transition-all flex items-center gap-2 group">
            <RefreshCw class="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Refresh Data
          </button>
        </div>

        <!-- Dashboard Overview Section -->
        <div v-if="activeTab === 'dashboard'" class="animate-fade-in">
          <!-- Stats Row -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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
                  <th scope="col" class="px-6 py-4 font-semibold">Item</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Amount</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Payment</th>
                  <th scope="col" class="px-6 py-4 font-semibold">Status</th>
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
                    <div class="font-bold text-white mb-1">{{ tx.gameId?.name || 'Unknown Game' }}</div>
                    <div class="text-sm font-semibold text-gray-300">ID: {{ tx.playerId }}</div>
                    <div class="text-xs text-gray-500 mt-0.5" v-if="tx.serverId">Zone: {{ tx.serverId }}</div>
                  </td>
                  <td class="px-6 py-4 text-white font-medium">
                    {{ tx.amount }} Diamonds
                  </td>
                  <td class="px-6 py-4 font-bold text-white">
                    ${{ Number(tx.price).toFixed(2) }}
                  </td>
                  <td class="px-6 py-4 uppercase text-xs font-bold tracking-wider">
                    {{ tx.paymentMethod }}
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-3 py-1 text-xs font-bold border rounded-full flex items-center gap-1.5 w-fit uppercase tracking-wider shadow-sm" :class="getStatusColor(tx.status)">
                      <component :is="getStatusIcon(tx.status)" class="w-3.5 h-3.5" />
                      {{ tx.status }}
                    </span>
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
                
                <button @click="openMoogoldModal" class="bg-primary hover:bg-primary/90 text-darker font-bold py-2 px-4 rounded-xl transition-all whitespace-nowrap flex items-center gap-2">
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
                
                <h3 class="text-lg font-bold text-white font-outfit">{{ game.name }}</h3>
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
                    <label :for="'banner-' + game._id" class="cursor-pointer bg-black/50 backdrop-blur border border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50 text-gray-300 transition-all px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                      <RefreshCw v-if="isUploadingBanner[game._id]" class="w-3.5 h-3.5 animate-spin" />
                      <ImageIcon v-else class="w-3.5 h-3.5" />
                      {{ isUploadingBanner[game._id] ? 'Uploading...' : 'Upload Banner' }}
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
                  <button @click="openPricingModal(game)" class="w-full bg-white/5 border border-white/10 hover:bg-primary/20 hover:text-primary hover:border-primary/50 text-gray-300 transition-all px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                    <DollarSign class="w-4 h-4" />
                    Manage Prices
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

      </div>
    </main>

    <!-- Pricing Modal -->
    <div v-if="showPricingModal" class="fixed inset-0 z-[150] flex items-center justify-center bg-darker/80 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div class="glass-card p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl relative my-auto">
        <button @click="showPricingModal = false" class="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XCircle class="w-6 h-6" />
        </button>
        
        <h3 class="text-2xl font-black font-outfit text-white mb-2">Manage Prices</h3>
        <p class="text-gray-400 text-sm mb-6">Edit sell prices for {{ selectedGameForPricing?.name }}</p>
        
        <div v-if="isFetchingPackages" class="flex justify-center py-10">
          <RefreshCw class="w-8 h-8 text-primary animate-spin" />
        </div>
        
        <div v-else class="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          <div v-for="pkg in gamePackages" :key="pkg.id" class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="font-bold text-white text-sm md:w-1/3">{{ pkg.name }}</div>
            
            <div class="flex items-center justify-between md:justify-end gap-6 w-full md:w-2/3">
              <div class="flex flex-col text-left md:text-right">
                <span class="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Cost Price</span>
                <span class="text-gray-300 font-bold text-sm">${{ pkg.originalPrice.toFixed(2) }}</span>
              </div>
              
              <div class="flex items-center gap-3">
                <span class="text-primary text-[10px] uppercase font-bold tracking-wider text-right">Sell For</span>
                <div class="relative w-28">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                  <input 
                    v-model.number="pkg.customPrice" 
                    type="number" 
                    step="0.01" 
                    class="w-full bg-[#12121a] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-if="gamePackages.length === 0" class="text-center text-gray-400 font-bold py-6 bg-white/5 rounded-xl border border-white/10">
            No items found for this game.
          </div>
        </div>
        
        <div class="mt-8 flex gap-3">
          <button @click="showPricingModal = false" class="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all border border-white/10">
            Cancel
          </button>
          <button @click="savePrices" :disabled="isSavingPrices" class="flex-1 py-3.5 rounded-xl bg-primary text-darker font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2" :class="{'opacity-50 cursor-not-allowed': isSavingPrices}">
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
                  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20': t.status === 'pending',
                  'bg-red-500/10 text-red-400 border-red-500/20': t.status === 'failed'
                }">
                {{ t.status }}
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
    <!-- MooGold Import Modal -->
    <div v-if="showMoogoldModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showMoogoldModal = false"></div>
      
      <div class="relative bg-darker border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        <div class="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <Plus class="w-5 h-5 text-primary" />
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
              placeholder="Search MooGold games..." 
              class="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1">
          <div v-if="isFetchingMoogold" class="flex flex-col items-center justify-center py-12 text-gray-400">
            <RefreshCw class="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Fetching games from MooGold API...</p>
          </div>
          <div v-else-if="filteredMoogoldGames.length === 0" class="text-center py-8 text-gray-500">
            No games found.
          </div>
          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div v-for="mgGame in filteredMoogoldGames" :key="mgGame.ID" class="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between group hover:border-primary/50 transition-all">
              <div class="flex-1 truncate pr-4">
                <p class="text-white font-semibold truncate">{{ mgGame.post_title }}</p>
                <p class="text-xs text-gray-500">ID: {{ mgGame.ID }}</p>
              </div>
              <button @click="importGame(mgGame)" class="bg-primary/20 text-primary hover:bg-primary hover:text-darker border border-primary/50 px-3 py-1.5 rounded-lg text-sm font-bold transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
