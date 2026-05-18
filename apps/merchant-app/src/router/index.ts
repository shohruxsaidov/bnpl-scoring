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
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard', breadcrumb: ['Dashboard'] },
      },
      {
        path: 'wizard',
        name: 'wizard',
        component: () => import('@/views/wizard/WizardView.vue'),
        meta: { title: 'New Deal', breadcrumb: ['Deals', 'New Deal'], agentOnly: true },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/deals/DealDetailView.vue'),
        meta: { title: 'Deal', breadcrumb: ['Deals', 'Detail'] },
      },
      {
        path: 'admin/products',
        name: 'admin-products',
        component: () => import('@/views/admin/ProductsView.vue'),
        meta: { title: 'Products', breadcrumb: ['Admin', 'Products'], adminOnly: true },
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
        meta: { title: 'Categories', breadcrumb: ['Admin', 'Categories'], adminOnly: true },
      },
      {
        path: 'admin/tariffs',
        name: 'admin-tariffs',
        component: () => import('@/views/admin/TariffsView.vue'),
        meta: { title: 'Tariffs', breadcrumb: ['Admin', 'Tariffs'], adminOnly: true },
      },
      {
        path: 'admin/employees',
        name: 'admin-employees',
        component: () => import('@/views/admin/EmployeesView.vue'),
        meta: { title: 'Employees', breadcrumb: ['Admin', 'Employees'], adminOnly: true },
      },
      {
        path: 'admin/collection-board',
        name: 'admin-collection-board',
        component: () => import('@/views/admin/CollectionBoardView.vue'),
        meta: { title: 'Collection Board', breadcrumb: ['Admin', 'Collection Board'], adminOnly: true },
      },
      {
        path: 'admin/scoring-history',
        name: 'admin-scoring-history',
        component: () => import('@/views/admin/ScoringHistoryView.vue'),
        meta: { title: 'Scoring History', breadcrumb: ['Admin', 'Scoring History'], adminOnly: true },
      },
      {
        path: 'admin/payments',
        name: 'admin-payments',
        component: () => import('@/views/admin/PaymentsView.vue'),
        meta: { title: 'Payments', breadcrumb: ['Admin', 'Payments'], adminOnly: true },
      },
      {
        path: 'admin/buyout',
        name: 'admin-buyout',
        component: () => import('@/views/admin/BuyoutView.vue'),
        meta: { title: 'Buyout', breadcrumb: ['Admin', 'Buyout'], adminOnly: true },
      },
      {
        path: 'admin/scoring-history/:id',
        name: 'admin-scoring-history-detail',
        component: () => import('@/views/admin/ScoringHistoryDetailView.vue'),
        meta: { title: 'Scoring Detail', breadcrumb: ['Admin', 'Scoring History', 'Detail'], adminOnly: true },
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
    if (auth.isAuthenticated && to.name === 'login') return { name: 'dashboard' }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'dashboard' }
  }

  if (to.meta.agentOnly && !auth.isAgent) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
