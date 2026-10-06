<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { ShoppingCart, User, Menu, Gamepad2, X } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

const isMenuOpen = ref(false)
const { user } = useAuth()

// Lock body scroll when mobile menu is open
watch(isMenuOpen, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// Clean up just in case component is destroyed
onUnmounted(() => {
  document.body.style.overflow = ''
})

const closeMenu = () => {
  isMenuOpen.value = false
}
</script>

<template>
  <div class="fixed top-0 left-0 w-full z-[100] flex justify-center pt-6 px-4 pointer-events-none">
    <nav class="glass w-full max-w-7xl rounded-full px-6 md:px-8 py-3 flex items-center justify-between border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] pointer-events-auto relative z-50">
      <!-- Logo -->
      <div class="flex items-center gap-3 relative z-50 cursor-pointer group" @click="$router.push('/')">
        <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,215,0,0.4)]">
          <img src="/logo.jpg" alt="GameTopup Logo" class="w-full h-full object-cover" />
        </div>
        <span class="text-xl font-black font-outfit tracking-widest text-white hidden sm:block">GAME<span class="text-primary">TOPUP</span></span>
      </div>
      
      <!-- Desktop Links -->
      <div class="hidden md:flex items-center gap-1 bg-white/5 rounded-full px-2 py-1">
        <router-link to="/" class="text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-all text-sm font-semibold tracking-wide">Home</router-link>
        <router-link to="/" class="text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-all text-sm font-semibold tracking-wide">Games</router-link>
        <router-link to="/history" class="text-gray-300 hover:text-white hover:bg-white/10 px-4 py-2 rounded-full transition-all text-sm font-semibold tracking-wide">Transactions</router-link>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 relative z-50">
        <button class="p-2.5 rounded-full bg-white/5 text-gray-300 hover:text-primary hover:bg-white/10 transition-all hidden md:block">
          <ShoppingCart class="w-4 h-4" />
        </button>
        
        <router-link v-if="user" to="/profile" class="flex items-center gap-3 bg-white/5 pl-2 pr-4 py-1.5 rounded-full hover:bg-white/10 transition-all border border-white/10 hover:border-primary/50 group">
          <img :src="user.profileImage" class="w-8 h-8 rounded-full border border-white/20 group-hover:border-primary transition-colors object-cover" />
          <span class="text-sm font-bold text-white hidden sm:block">{{ user.username }}</span>
        </router-link>

        <router-link v-else to="/login" class="flex items-center gap-2 bg-gradient-to-r from-primary to-yellow-500 text-darker px-5 py-2.5 rounded-full hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:scale-105 transition-all duration-300 font-bold text-sm tracking-wide">
          <User class="w-4 h-4" />
          <span class="hidden sm:block">Sign In</span>
        </router-link>
        <button @click="isMenuOpen = !isMenuOpen" class="md:hidden p-2 text-gray-300 hover:text-primary transition-colors">
          <Menu v-if="!isMenuOpen" class="w-6 h-6" />
          <X v-else class="w-6 h-6" />
        </button>
      </div>
    </nav>

    <!-- Mobile Menu Overlay -->
    <div 
      v-if="isMenuOpen" 
      class="fixed inset-0 z-40 bg-darker/95 backdrop-blur-lg flex flex-col items-center justify-center pt-20 animate-fade-in md:hidden pointer-events-auto"
    >
      <div class="flex flex-col items-center gap-6 w-full px-8">
        <router-link @click="closeMenu" to="/" class="text-2xl font-black font-outfit text-white hover:text-primary transition-colors">Home</router-link>
        <router-link @click="closeMenu" to="/" class="text-2xl font-black font-outfit text-white hover:text-primary transition-colors">Games</router-link>
        <router-link @click="closeMenu" to="/history" class="text-2xl font-black font-outfit text-white hover:text-primary transition-colors">Transactions</router-link>
        
        <div class="w-full h-px bg-white/10 my-4"></div>
        
        <button class="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-white/5 text-white font-bold text-lg hover:bg-white/10 transition-all border border-white/10">
          <ShoppingCart class="w-5 h-5" />
          View Cart
        </button>
      </div>
    </div>
  </div>
</template>
