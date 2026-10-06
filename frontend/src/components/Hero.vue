<script setup>
import { Gamepad2, Zap, ShieldCheck } from 'lucide-vue-next'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination, EffectFade } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/effect-fade'

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const modules = [Autoplay, Pagination, EffectFade]
const router = useRouter()

const banners = ref([])
let eventSource = null

const fetchSliders = async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/sliders`)
    let data = await res.json()
    if (res.ok && data.length > 0) {
      banners.value = data.filter(s => s.isActive !== false)
    }
  } catch (error) {
    console.error("Failed to fetch sliders", error)
  }
}

onMounted(() => {
  fetchSliders()
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  eventSource = new EventSource(`${apiUrl}/api/updates/stream`)
  
  eventSource.addEventListener('slider_updated', (event) => {
    const { type, data, id } = JSON.parse(event.data)
    
    if (type === 'created') {
      if (data.isActive !== false) {
        banners.value.push(data)
        banners.value.sort((a, b) => a.order - b.order)
      }
    } else if (type === 'updated') {
      const index = banners.value.findIndex(b => b._id === data._id)
      if (data.isActive === false) {
        if (index !== -1) banners.value.splice(index, 1)
      } else {
        if (index !== -1) {
          banners.value[index] = data
        } else {
          banners.value.push(data)
        }
        banners.value.sort((a, b) => a.order - b.order)
      }
    } else if (type === 'deleted') {
      banners.value = banners.value.filter(b => b._id !== id)
    }
  })
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})

const handleTopUp = (link) => {
  if (link) {
    router.push(link)
  }
}
</script>

<template>
  <section class="relative w-full max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-10 pb-12">
    <div class="rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 group min-h-[400px] md:min-h-[500px]">
      <swiper
        v-if="banners.length > 0"
        :modules="modules"
        :slides-per-view="1"
        :loop="true"
        :effect="'fade'"
        :pagination="{ clickable: true }"
        :autoplay="{ delay: 5000, disableOnInteraction: false }"
        class="w-full h-[400px] md:h-[500px]"
      >
        <swiper-slide v-for="banner in banners" :key="banner._id || banner.id">
          <div class="relative w-full h-full flex items-center">
            <!-- Background Image -->
            <img :src="banner.image" :alt="banner.title" class="absolute inset-0 w-full h-full object-cover" />
            
            <!-- Dark Gradient Overlay -->
            <div class="absolute inset-0 bg-gradient-to-r from-darker/90 via-darker/50 to-transparent"></div>
            
            <!-- Content -->
            <div class="relative z-10 px-8 md:px-16 max-w-3xl">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6 animate-fade-in">
                <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span class="text-[10px] font-bold text-white uppercase tracking-wider">Lightning Fast Delivery</span>
              </div>
              
              <h1 class="text-4xl md:text-6xl font-outfit font-black text-white mb-4 leading-tight drop-shadow-lg">
                {{ banner.title }}
              </h1>
              
              <p class="text-gray-300 text-base md:text-lg mb-8 max-w-xl font-sans drop-shadow-md">
                {{ banner.subtitle }}
              </p>
              
              <button @click="handleTopUp(banner.link)" class="px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary to-yellow-500 text-darker font-bold hover:scale-105 transition-transform duration-300 shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center gap-2">
                <Gamepad2 class="w-5 h-5" />
                Top Up Now
              </button>
            </div>
          </div>
        </swiper-slide>
      </swiper>
    </div>
    
    <!-- Quick Features -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      <div class="glass-card p-4 flex items-center gap-4 border border-white/5 bg-white/5 rounded-2xl">
        <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <Zap class="w-6 h-6" />
        </div>
        <div>
          <h4 class="text-white font-bold font-outfit">Instant Delivery</h4>
          <p class="text-xs text-gray-400">Receive your top-up in seconds</p>
        </div>
      </div>
      <div class="glass-card p-4 flex items-center gap-4 border border-white/5 bg-white/5 rounded-2xl">
        <div class="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
          <ShieldCheck class="w-6 h-6" />
        </div>
        <div>
          <h4 class="text-white font-bold font-outfit">Secure Payment</h4>
          <p class="text-xs text-gray-400">100% safe & encrypted checkout</p>
        </div>
      </div>
      <div class="glass-card p-4 flex items-center gap-4 border border-white/5 bg-white/5 rounded-2xl">
        <div class="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        </div>
        <div>
          <h4 class="text-white font-bold font-outfit">24/7 Support</h4>
          <p class="text-xs text-gray-400">We are always here to help you</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style>
.swiper-pagination-bullet {
  background: rgba(255, 255, 255, 0.3) !important;
  width: 10px !important;
  height: 10px !important;
  transition: all 0.3s ease !important;
  opacity: 1 !important;
}
.swiper-pagination-bullet-active {
  background: #eab308 !important; /* Tailwind yellow-500 */
  width: 24px !important;
  border-radius: 5px !important;
  box-shadow: 0 0 10px rgba(234, 179, 8, 0.5) !important;
}
</style>
