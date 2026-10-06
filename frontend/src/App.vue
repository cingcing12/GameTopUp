<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Navbar from './components/Navbar.vue'
import Footer from './components/Footer.vue'

const route = useRoute()

const showLayout = computed(() => {
  return !['/login', '/signup'].includes(route.path) && !route.path.startsWith('/admin')
})
</script>

<template>
  <div class="min-h-screen flex flex-col relative bg-darker font-sans text-gray-200">
    <!-- Premium Animated Background -->
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] mix-blend-screen animate-blob"></div>
      <div class="absolute top-[20%] right-[-10%] w-[35%] h-[35%] rounded-full bg-accent/10 blur-[100px] mix-blend-screen animate-blob" style="animation-delay: 2s"></div>
      <div class="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-primaryDark/10 blur-[150px] mix-blend-screen animate-blob" style="animation-delay: 4s"></div>
      
      <!-- Subtle noise texture overlay -->
      <div class="absolute inset-0 bg-[url('data:image/svg+xml;utf8,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')] opacity-20 mix-blend-overlay"></div>
    </div>
    
    <Navbar v-if="showLayout" class="z-50" />
    
    <main class="flex-grow z-10" :class="showLayout ? 'pt-24 pb-12' : ''">
      <router-view />
    </main>

    <Footer v-if="showLayout" class="z-10" />
  </div>
</template>
