<template>
  <div class="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0d0d12]">
    
    <!-- Background Animated Effects -->
    <div class="absolute inset-0 z-0">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" style="animation-delay: 2s;"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full blur-sm"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full blur-sm"></div>
    </div>

    <div class="relative z-10 text-center px-4 w-full max-w-3xl">
      <!-- 404 Text -->
      <div class="relative inline-block mb-4 group cursor-default">
        <h1 class="text-[120px] md:text-[200px] font-black font-outfit text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 leading-none filter drop-shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-transform duration-500 hover:scale-105">
          404
        </h1>
        <div class="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      </div>

      <!-- Gamer Message -->
      <div class="glass-card bg-[#12121a]/80 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl shadow-2xl relative overflow-hidden">
        
        <!-- Decoration lines -->
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
        <div class="absolute bottom-0 left-0 w-full h-[1px] bg-white/5"></div>
        
        <h2 class="text-3xl md:text-5xl font-bold text-white font-outfit mb-4">
          <span class="text-primary">Game Over:</span> Page Not Found
        </h2>
        
        <p class="text-gray-400 text-lg md:text-xl mb-10 max-w-lg mx-auto leading-relaxed">
          Looks like this level hasn't been unlocked yet, or the page got lost in the void. Let's get you back to the safe zone!
        </p>

        <!-- CTA Button -->
        <router-link to="/" class="group relative inline-flex items-center justify-center">
          <div class="absolute -inset-1 bg-gradient-to-r from-primary to-yellow-600 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-500 group-hover:duration-200"></div>
          <button class="relative bg-primary hover:bg-yellow-500 text-black font-bold py-4 px-10 rounded-xl transition-all duration-300 transform group-hover:-translate-y-1 shadow-[0_0_20px_rgba(255,215,0,0.4)] flex items-center gap-3">
            <svg class="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span class="text-lg">Return to Base</span>
          </button>
        </router-link>

      </div>
      
      <!-- Logo at bottom -->
      <div class="mt-16 flex justify-center opacity-50 hover:opacity-100 transition-opacity">
        <img src="/logo.jpg" alt="GameTopup" class="w-12 h-12 rounded-full border border-white/20 object-cover" />
      </div>

    </div>
  </div>
</template>

<script>
export default {
  name: 'NotFound'
}
</script>

<style scoped>
.glass-card {
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
</style>
