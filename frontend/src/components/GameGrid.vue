<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'

const router = useRouter()
const games = ref([])
const searchQuery = ref('')
const isLoading = ref(true)

const filteredGames = computed(() => {
  let activeGames = games.value.filter(g => g.isActive !== false)
  if (!searchQuery.value) return activeGames
  const lowerCaseQuery = searchQuery.value.toLowerCase()
  return activeGames.filter(game => 
    game.name.toLowerCase().includes(lowerCaseQuery)
  )
})

const fetchGames = async () => {
  isLoading.value = true;
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/games`)
    const data = await res.json()
    if (res.ok && data.length > 0) {
      games.value = data;
    } else {
      // Fallback if DB is empty
      games.value = [
        { _id: '15145', name: 'Mobile Legends: Bang Bang', publisher: 'Moonton', image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80' },
        { _id: '7847', name: 'Free Fire', publisher: 'Garena', image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80' },
        { _id: '6963', name: 'PUBG Mobile', publisher: 'Tencent', image: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=600&q=80' },
        { _id: '173557', name: 'Honor of Kings', publisher: 'Tencent', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80' }
      ]
    }
  } catch (error) {
    console.error("Failed to fetch games", error)
  } finally {
    isLoading.value = false; 
  }
}

let eventSource = null;

onMounted(() => {
  fetchGames()
  
  // Connect to SSE for real-time updates
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  eventSource = new EventSource(`${apiUrl}/api/updates/stream`);
  
  eventSource.addEventListener('game_updated', (event) => {
    const updatedGame = JSON.parse(event.data);
    const index = games.value.findIndex(g => g._id === updatedGame._id);
    if (index !== -1) {
      games.value[index] = updatedGame; // Vue reactivity will auto-update the image!
    }
  });
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})

const openTopUp = (game) => {
  router.push(`/topup/${game._id || 'mlbb'}`)
}
</script>

<template>
  <section class="max-w-7xl mx-auto px-4 md:px-6 py-16 relative">
    <div class="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
      <div>
        <h2 class="text-3xl md:text-4xl font-black font-outfit text-white mb-2 tracking-tight">Trending Games</h2>
        <p class="text-gray-400 font-medium">Top up your favorite games instantly.</p>
      </div>
      
      <!-- Premium Search Bar -->
      <div class="relative w-full md:w-80 group">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary text-gray-500">
          <Search class="h-5 w-5" />
        </div>
        <input 
          v-model="searchQuery" 
          type="text" 
          class="bg-white/5 border border-white/10 text-white text-sm rounded-2xl focus:ring-2 focus:ring-primary/50 focus:border-primary block w-full pl-12 p-3.5 transition-all outline-none shadow-inner" 
          placeholder="Search games..."
        >
      </div>
    </div>

    <!-- Skeleton Loading State -->
    <div v-if="isLoading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      <div v-for="i in 8" :key="i" class="glass-card animate-pulse overflow-hidden rounded-2xl aspect-[3/4] bg-white/5 relative">
        <div class="absolute bottom-0 w-full p-6 space-y-3">
          <div class="h-3 w-1/3 bg-white/10 rounded"></div>
          <div class="h-5 w-3/4 bg-white/20 rounded"></div>
          <div class="h-10 w-full bg-white/10 rounded-xl mt-4"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredGames.length === 0" class="text-center py-32 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm">
      <Search class="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <h3 class="text-2xl text-gray-300 font-bold font-outfit mb-2">No games found</h3>
      <p class="text-gray-500 text-sm">We couldn't find any games matching your search.</p>
    </div>

    <!-- Game Grid -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      <div 
        v-for="game in filteredGames" 
        :key="game._id"
        class="glass-card group cursor-pointer overflow-hidden relative border border-white/5 bg-[#12121a]/80 rounded-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_40px_rgba(255,215,0,0.15)]"
        @click="openTopUp(game)"
      >
        <div class="aspect-[3/4] overflow-hidden relative">
          <img 
            :src="game.image" 
            :alt="game.name"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent"></div>
        </div>
        
        <div class="absolute bottom-0 left-0 w-full p-5 translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
          <p class="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 opacity-90">{{ game.publisher }}</p>
          <h3 class="text-white font-bold font-outfit text-lg md:text-xl leading-tight mb-4 group-hover:text-primary transition-colors duration-300 drop-shadow-md">{{ game.name }}</h3>
          
          <button class="w-full py-2.5 rounded-xl bg-white/10 backdrop-blur-md text-white font-bold transition-all duration-300 border border-white/10 group-hover:bg-primary group-hover:text-darker group-hover:border-primary text-sm flex items-center justify-center gap-2">
            Top Up Now
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
