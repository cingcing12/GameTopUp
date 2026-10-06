<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'

const route = useRoute()
const pageData = ref(null)
const isLoading = ref(true)

const fetchPage = async (slug) => {
  isLoading.value = true
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    const res = await fetch(`${apiUrl}/api/pages/${slug}`)
    if (res.ok) {
      pageData.value = await res.json()
    } else {
      pageData.value = {
        title: 'Page Not Found',
        content: 'The page you are looking for does not exist or has been removed.'
      }
    }
  } catch (error) {
    console.error('Error fetching page:', error)
    pageData.value = {
      title: 'Error',
      content: 'Failed to load page content. Please try again later.'
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchPage(route.params.slug)
})

watch(() => route.params.slug, (newSlug) => {
  if (newSlug) fetchPage(newSlug)
})
</script>

<template>
  <!-- Removed py-12 to fix top margin since App.vue already has pt-24 -->
  <div class="max-w-7xl w-full mx-auto px-4 pb-16 relative z-10 animate-fade-in min-h-[60vh]">
    <!-- Background effects -->
    <div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 class="w-12 h-12 text-primary animate-spin" />
      <p class="text-gray-400 font-medium animate-pulse">Loading content...</p>
    </div>

    <div v-else class="glass-card p-8 md:p-14 rounded-3xl border border-white/10 shadow-2xl bg-[#16161c]/80 backdrop-blur-xl relative overflow-hidden mt-6">
      <!-- Decorative corner -->
      <div class="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 blur-[60px] rounded-full pointer-events-none"></div>
      <div class="absolute -bottom-16 -left-16 w-48 h-48 bg-accent/5 blur-[60px] rounded-full pointer-events-none"></div>
      
      <h1 class="text-4xl md:text-5xl font-black font-outfit text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 mb-10 pb-6 relative z-10 border-b border-white/10">
        {{ pageData.title }}
        <div class="absolute bottom-0 left-0 w-24 h-[3px] bg-gradient-to-r from-primary to-primaryDark rounded-full transform translate-y-1/2 shadow-[0_0_15px_rgba(255,215,0,0.5)]"></div>
      </h1>

      <!-- Custom Content Container -->
      <div 
        class="custom-content relative z-10 text-gray-300"
        v-html="pageData.content"
      ></div>
    </div>
  </div>
</template>

<style>
/* 
  Beautiful Custom CMS Content Styling 
  Works independently of Tailwind plugins
*/
.custom-content {
  font-family: 'Inter', sans-serif;
  line-height: 1.8;
  font-size: 1.125rem; /* text-lg */
}

/* Headings */
.custom-content h1,
.custom-content h2,
.custom-content h3,
.custom-content h4 {
  font-family: 'Outfit', sans-serif;
  color: #ffffff;
  font-weight: 800; /* font-black */
  margin-top: 2rem;
  margin-bottom: 1rem;
  letter-spacing: -0.025em;
}

.custom-content h2 {
  font-size: 2.25rem;
  border-left: 4px solid #FFD700;
  padding-left: 1rem;
  background: linear-gradient(90deg, rgba(255,215,0,0.05) 0%, rgba(255,215,0,0) 100%);
  border-radius: 0 8px 8px 0;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.custom-content h3 {
  font-size: 1.5rem;
  color: #FFD700;
}

/* Paragraphs */
.custom-content p {
  margin-bottom: 1.5rem;
  color: #d1d5db; /* text-gray-300 */
}

/* Lists */
.custom-content ul,
.custom-content ol {
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
  color: #d1d5db;
}

.custom-content ul li {
  list-style-type: none;
  position: relative;
  margin-bottom: 0.75rem;
}

.custom-content ul li::before {
  content: '→';
  position: absolute;
  left: -1.5rem;
  color: #FFD700;
  font-weight: bold;
}

.custom-content ol li {
  list-style-type: decimal;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.custom-content ol li::marker {
  color: #FFD700;
  font-weight: 800;
}

/* Links */
.custom-content a {
  color: #00F0FF;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  position: relative;
}

.custom-content a:hover {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255,215,0,0.5);
}

/* Strong/Bold */
.custom-content strong,
.custom-content b {
  color: #ffffff;
  font-weight: 700;
}

/* Transitions */
.custom-content * {
  transition: all 0.3s ease;
}
</style>
