<script setup>
import { ref, computed, onMounted } from 'vue'

const telegramUsername = ref('pheak_topup')
const telegramEnabled = ref(true)
const isHovered = ref(false)

const cleanUsername = computed(() => {
  if (!telegramUsername.value) return 'pheak_topup'
  return telegramUsername.value.replace(/^@/, '').trim()
})

const telegramUrl = computed(() => {
  return `https://t.me/${cleanUsername.value}`
})

const fetchSettings = async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/settings`)
    if (res.ok) {
      const data = await res.json()
      if (data.telegramUsername !== undefined) {
        telegramUsername.value = data.telegramUsername
      }
      if (data.telegramEnabled !== undefined) {
        telegramEnabled.value = data.telegramEnabled
      }
    }
  } catch (err) {
    // Graceful fallback to default if backend is waking up or offline
    console.debug('Failed to load telegram settings, using default:', err)
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div 
    v-if="telegramEnabled && cleanUsername" 
    class="fixed bottom-6 right-6 z-50 flex items-center group select-none"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Tooltip Bubble on Hover -->
    <a
      :href="telegramUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="hidden sm:flex items-center gap-2 mr-3 px-3.5 py-2 rounded-xl bg-darker/95 border border-[#229ED9]/40 text-white text-xs font-medium shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 transform"
      :class="isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'"
    >
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      <span>Need help? <strong class="text-[#2BAAE2]">Chat on Telegram</strong></span>
    </a>

    <!-- Main Telegram Floating Action Button -->
    <a
      :href="telegramUrl"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact us on Telegram"
      class="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[#229ED9] to-[#2BAAE2] text-white flex items-center justify-center shadow-[0_8px_25px_rgba(34,158,217,0.45)] hover:shadow-[0_12px_30px_rgba(34,158,217,0.7)] hover:scale-110 active:scale-95 transition-all duration-300 group-hover:rotate-6"
    >
      <!-- Pulsing Glow Ring -->
      <span class="absolute inset-0 rounded-full bg-[#2BAAE2] opacity-40 animate-ping pointer-events-none"></span>

      <!-- Official Telegram Icon (SVG) -->
      <svg 
        class="w-7 h-7 fill-current transform -translate-x-0.5 translate-y-0.5 drop-shadow" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
      </svg>

      <!-- Online Indicator Dot -->
      <span class="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-darker rounded-full shadow"></span>
    </a>
  </div>
</template>
