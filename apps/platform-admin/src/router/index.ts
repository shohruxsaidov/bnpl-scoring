import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, titleKey: 'routeTitle.login' },
  },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      {
        path: '',
        name: 'overview',
        component: () => import('@/views/OverviewView.vue'),
        meta: { titleKey: 'routeTitle.overview', breadcrumbKeys: ['breadcrumb.overview'] },
      },
      {
        path: 'merchants',
        name: 'merchants',
        component: () => import('@/views/MerchantsView.vue'),
        meta: { titleKey: 'routeTitle.merchants', breadcrumbKeys: ['breadcrumb.merchants'] },
      },
      {
        path: 'merchants/:id',
        name: 'merchant-detail',
        component: () => import('@/views/MerchantDetailView.vue'),
        meta: { titleKey: 'routeTitle.merchant', breadcrumbKeys: ['breadcrumb.merchants', 'breadcrumb.detail'] },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/DealsView.vue'),
        meta: { titleKey: 'routeTitle.deals', breadcrumbKeys: ['breadcrumb.deals'] },
      },
      {
        path: 'employees',
        name: 'employees',
        component: () => import('@/views/EmployeesView.vue'),
        meta: { titleKey: 'routeTitle.employees', breadcrumbKeys: ['breadcrumb.employees'] },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { titleKey: 'routeTitle.settings', breadcrumbKeys: ['breadcrumb.settings'] },
      },
      {
        path: 'blacklist',
        name: 'blacklist',
        component: () => import('@/views/BlacklistView.vue'),
        meta: { titleKey: 'routeTitle.blacklist', breadcrumbKeys: ['breadcrumb.blacklist'] },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') return { name: 'overview' }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  return true
})

export default router
