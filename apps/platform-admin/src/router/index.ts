import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Sign in' },
  },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    children: [
      {
        path: '',
        name: 'overview',
        component: () => import('@/views/OverviewView.vue'),
        meta: { title: 'Overview', breadcrumb: ['Overview'] },
      },
      {
        path: 'tenants',
        name: 'tenants',
        component: () => import('@/views/TenantsView.vue'),
        meta: { title: 'Tenants', breadcrumb: ['Tenants'] },
      },
      {
        path: 'tenants/:id',
        name: 'tenant-detail',
        component: () => import('@/views/TenantDetailView.vue'),
        meta: { title: 'Tenant', breadcrumb: ['Tenants', 'Detail'] },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/DealsView.vue'),
        meta: { title: 'All Deals', breadcrumb: ['Deals'] },
      },
      {
        path: 'employees',
        name: 'employees',
        component: () => import('@/views/EmployeesView.vue'),
        meta: { title: 'Employees', breadcrumb: ['Employees'] },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings', breadcrumb: ['Settings'] },
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
