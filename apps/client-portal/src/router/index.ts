import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { transitionName } from '@/composables/usePageTransition'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Sign in', depth: 0 },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { public: true, title: 'Create account', depth: 0 },
  },
  {
    path: '/myid/callback/signing_up',
    name: 'register-myid-callback',
    component: () => import('@/views/RegisterMyidCallbackView.vue'),
    meta: { public: true, depth: 0 },
  },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Home', depth: 1, tabOrder: 0 },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/DealsView.vue'),
        meta: { title: 'My deals', depth: 1, tabOrder: 1 },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/DealDetailView.vue'),
        meta: { title: 'Deal', depth: 2, tabOrder: 1 },
      },
      {
        path: 'scoring',
        name: 'scoring',
        component: () => import('@/views/ScoringView.vue'),
        meta: { title: 'Credit limit', depth: 2, tabOrder: 2 },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/NotificationsView.vue'),
        meta: { title: 'Notifications', depth: 2, tabOrder: 3 },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/ProfileView.vue'),
        meta: { title: 'Profile', depth: 2, tabOrder: 3 },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from) => {
  const auth = useAuthStore()

  const toDepth = (to.meta.depth as number) ?? 1
  const fromDepth = (from.meta.depth as number) ?? 1
  const toTab = (to.meta.tabOrder as number) ?? 0
  const fromTab = (from.meta.tabOrder as number) ?? 0
  if (toDepth !== fromDepth) {
    transitionName.value = toDepth > fromDepth ? 'slide-left' : 'slide-right'
  } else {
    transitionName.value = toTab >= fromTab ? 'slide-left' : 'slide-right'
  }

  if (to.meta.public) {
    if (auth.isAuthenticated && (to.name === 'login' || to.name === 'register')) {
      return { name: 'home' }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  return true
})

export default router
