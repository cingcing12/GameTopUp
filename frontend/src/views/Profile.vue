<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user, token, updateUser, logout } = useAuth()

const form = ref({
  username: user.value?.username || '',
  email: user.value?.email || ''
})

const fileInput = ref(null)
const previewImage = ref(user.value?.profileImage || '')
const isUploading = ref(false)
const isSaving = ref(false)
const message = ref('')

onMounted(() => {
  if (!user.value) {
    router.push('/login')
  }
})

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Show preview immediately
  previewImage.value = URL.createObjectURL(file)
  isUploading.value = true
  message.value = ''

  const formData = new FormData()
  formData.append('profileImage', file)

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/profile/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`
      },
      body: formData
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Upload failed')

    // Update user state with new Cloudinary URL
    const updatedUser = { ...user.value, profileImage: data.profileImage }
    updateUser(updatedUser)
    previewImage.value = data.profileImage
    message.value = 'Profile image updated successfully!'
    setTimeout(() => message.value = '', 4000)
  } catch (error) {
    message.value = 'Failed to upload image'
    previewImage.value = user.value.profileImage // revert
    setTimeout(() => message.value = '', 4000)
  } finally {
    isUploading.value = false
  }
}

const triggerFileInput = () => {
  fileInput.value.click()
}

const saveProfile = async () => {
  isSaving.value = true
  message.value = ''

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify(form.value)
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Update failed')

    updateUser(data)
    message.value = 'Profile updated successfully!'
    setTimeout(() => message.value = '', 4000)
  } catch (error) {
    message.value = error.message
    setTimeout(() => message.value = '', 4000)
  } finally {
    isSaving.value = false
  }
}

const handleLogout = () => {
  logout()
  router.push('/')
}
</script>

<template>
  <div class="container mx-auto px-6 md:px-8 py-8 max-w-7xl relative" v-if="user">
    
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-3xl font-black font-outfit text-white">Your Profile</h1>
      <button @click="handleLogout" class="px-6 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all border border-red-500/20">
        Logout
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      
      <!-- Left Column: Avatar & Quick Stats -->
      <div class="space-y-6">
        <div class="glass-card p-8 rounded-3xl border border-white/5 bg-[#12121a]/80 backdrop-blur-xl text-center">
          
          <div class="relative w-40 h-40 mx-auto mb-6 group cursor-pointer" @click="triggerFileInput">
            <div class="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:bg-primary/40 transition-all"></div>
            <img :src="previewImage" alt="Profile" class="w-full h-full object-cover rounded-full relative z-10 border-4 border-darker shadow-2xl group-hover:border-primary transition-all duration-300" />
            
            <div class="absolute inset-0 bg-black/60 rounded-full z-20 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-4 border-transparent group-hover:border-primary">
              <svg class="w-8 h-8 text-white mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span class="text-xs font-bold text-white uppercase tracking-wider">Change Image</span>
            </div>
            
            <input type="file" ref="fileInput" @change="handleImageUpload" accept="image/*" class="hidden" />
          </div>
          
          <p v-if="isUploading" class="text-primary text-sm font-bold animate-pulse mb-2">Uploading to Cloudinary...</p>

          <h2 class="text-2xl font-black text-white mb-1">{{ user.username }}</h2>
          <p class="text-gray-400 text-sm">{{ user.email }}</p>
          
          <div class="mt-6 pt-6 border-t border-white/10 flex justify-center gap-6">
            <div class="text-center">
              <div class="text-2xl font-black text-primary">${{ user.balance?.toFixed(2) || '0.00' }}</div>
              <div class="text-xs text-gray-500 uppercase tracking-wider font-bold">Balance</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Settings Form -->
      <div class="md:col-span-2">
        <div class="glass-card p-8 md:p-10 rounded-3xl border border-white/5 bg-[#12121a]/80 backdrop-blur-xl">
          <h3 class="text-xl font-black font-outfit text-white mb-6">Account Settings</h3>

          <form @submit.prevent="saveProfile" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Username</label>
                <input v-model="form.username" type="text" class="w-full bg-darker/80 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Email</label>
                <input v-model="form.email" type="email" class="w-full bg-darker/80 border border-white/10 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
              </div>
            </div>

            <div class="pt-4 flex justify-end">
              <button :disabled="isSaving" type="submit" class="px-8 py-3.5 font-black rounded-xl transition-all duration-300 text-sm flex items-center justify-center gap-2 relative overflow-hidden group bg-gradient-to-r from-primary to-yellow-500 text-darker hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:scale-[1.02]">
                {{ isSaving ? 'Saving Changes...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      </div>
      
    </div>

    <!-- Custom Floating Toast -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="message" class="fixed bottom-10 right-10 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl" :class="message.includes('failed') || message.includes('error') ? 'bg-red-500/20 border-red-500/30 text-white' : 'bg-green-500/20 border-green-500/30 text-white'">
          <svg v-if="message.includes('failed') || message.includes('error')" class="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <svg v-else class="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="font-bold text-sm tracking-wide">{{ message }}</span>
        </div>
      </Transition>
    </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
</style>
