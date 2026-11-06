import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import TopUp from '../views/TopUp.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/topup/:gameId',
    name: 'TopUp',
    component: TopUp,
    props: true
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/signup',
    name: 'Signup',
    component: () => import('../views/Signup.vue')
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue')
  },
  {
    path: '/portal-pheak-admin-top-up',
    name: 'Admin',
    component: () => import('../views/Admin.vue')
  },
  {
    path: '/page/:slug',
    name: 'CustomPage',
    component: () => import('../views/CustomPage.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/'),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return { top: 0 }
  }
})

// Automatically recover when user navigates during/after a new deployment
router.onError((error) => {
  const isChunkError =
    error.message?.includes('Failed to fetch dynamically imported module') ||
    error.message?.includes('Importing a module script failed') ||
    error.message?.includes('text/html')

  if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
    sessionStorage.setItem('chunk_reload', 'true')
    window.location.reload()
  }
})

router.afterEach(() => {
  sessionStorage.removeItem('chunk_reload')
})

export default router
