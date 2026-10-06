<script setup>
import { Twitter, Instagram, Facebook, Gamepad2 } from 'lucide-vue-next'
</script>

<template>
  <footer class="mt-20 border-t border-white/10 bg-darker/80 backdrop-blur-md pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
      <div class="col-span-1 md:col-span-2">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full overflow-hidden border border-primary/50 shadow-[0_0_10px_rgba(255,215,0,0.2)]">
            <img src="/logo.jpg" alt="GameTopup Logo" class="w-full h-full object-cover" />
          </div>
          <span class="text-xl font-black font-outfit tracking-wider text-white">GAME<span class="text-primary">TOPUP</span></span>
        </div>
        <p class="text-gray-400 text-sm leading-relaxed max-w-sm mb-6">
          The most trusted, fastest, and secure platform for all your gaming top-up needs. We provide instant delivery 24/7.
        </p>
        <div class="flex gap-4 text-gray-400">
          <a href="#" class="hover:text-primary transition-colors"><Twitter class="w-5 h-5" /></a>
          <a href="#" class="hover:text-primary transition-colors"><Instagram class="w-5 h-5" /></a>
          <a href="#" class="hover:text-primary transition-colors"><Facebook class="w-5 h-5" /></a>
        </div>
      </div>
      
      <div>
        <h4 class="text-white font-bold mb-4 uppercase tracking-wider text-sm">Quick Links</h4>
        <ul class="space-y-3">
          <li><router-link to="/page/about-us" class="text-gray-400 hover:text-primary text-sm transition-colors">About Us</router-link></li>
          <li><router-link to="/page/terms-of-service" class="text-gray-400 hover:text-primary text-sm transition-colors">Terms of Service</router-link></li>
          <li><router-link to="/page/privacy-policy" class="text-gray-400 hover:text-primary text-sm transition-colors">Privacy Policy</router-link></li>
          <li><router-link to="/page/contact-support" class="text-gray-400 hover:text-primary text-sm transition-colors">Contact Support</router-link></li>
        </ul>
      </div>

      <div>
        <h4 class="text-white font-bold mb-4 uppercase tracking-wider text-sm">Help</h4>
        <ul class="space-y-3">
          <li><router-link to="/page/faq" class="text-gray-400 hover:text-primary text-sm transition-colors">FAQ</router-link></li>
          <li><router-link to="/page/how-to-top-up" class="text-gray-400 hover:text-primary text-sm transition-colors">How to Top Up</router-link></li>
          <li><router-link to="/page/payment-methods" class="text-gray-400 hover:text-primary text-sm transition-colors">Payment Methods</router-link></li>
        </ul>
      </div>
    </div>
    
    <div class="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
      <p>&copy; 2026 GameTopup. All rights reserved.</p>
      <div class="flex gap-4">
        <span>Made with 💛 for gamers.</span>
      </div>
    </div>
  </footer>
</template>
