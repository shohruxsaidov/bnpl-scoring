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
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { titleKey: 'routeTitle.dashboard', breadcrumbKeys: ['breadcrumb.dashboard'] },
      },
      {
        path: 'wizard',
        name: 'wizard',
        component: () => import('@/views/wizard/WizardView.vue'),
        meta: { titleKey: 'routeTitle.wizard', breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.newDeal'], agentOnly: true },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/deals/DealDetailView.vue'),
        meta: { titleKey: 'routeTitle.deal', breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.detail'] },
      },
      {
        path: 'admin/products',
        name: 'admin-products',
        component: () => import('@/views/admin/ProductsView.vue'),
        meta: { titleKey: 'routeTitle.products', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.products'], adminOnly: true },
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
        meta: { titleKey: 'routeTitle.categories', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.categories'], adminOnly: true },
      },
      {
        path: 'admin/tariffs',
        name: 'admin-tariffs',
        component: () => import('@/views/admin/TariffsView.vue'),
        meta: { titleKey: 'routeTitle.tariffs', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.tariffs'], adminOnly: true },
      },
      {
        path: 'admin/employees',
        name: 'admin-employees',
        component: () => import('@/views/admin/EmployeesView.vue'),
        meta: { titleKey: 'routeTitle.employees', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.employees'], adminOnly: true },
      },
      {
        path: 'admin/collection-board',
        name: 'admin-collection-board',
        component: () => import('@/views/admin/CollectionBoardView.vue'),
        meta: { titleKey: 'routeTitle.collectionBoard', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.collectionBoard'], adminOnly: true },
      },
      {
        path: 'admin/scoring-history',
        name: 'admin-scoring-history',
        component: () => import('@/views/admin/ScoringHistoryView.vue'),
        meta: { titleKey: 'routeTitle.scoringHistory', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.scoringHistory'], adminOnly: true },
      },
      {
        path: 'admin/payments',
        name: 'admin-payments',
        component: () => import('@/views/admin/PaymentsView.vue'),
        meta: { titleKey: 'routeTitle.payments', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.payments'], adminOnly: true },
      },
      {
        path: 'admin/buyout',
        name: 'admin-buyout',
        component: () => import('@/views/admin/BuyoutView.vue'),
        meta: { titleKey: 'routeTitle.buyout', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.buyout'], adminOnly: true },
      },
      {
        path: 'admin/scoring-history/:id',
        name: 'admin-scoring-history-detail',
        component: () => import('@/views/admin/ScoringHistoryDetailView.vue'),
        meta: { titleKey: 'routeTitle.scoringDetail', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.scoringHistory', 'breadcrumb.detail'], adminOnly: true },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/NotificationsView.vue'),
        meta: { titleKey: 'routeTitle.notifications', breadcrumbKeys: ['breadcrumb.notifications'] },
      },
      {
        path: 'notifications/:id',
        name: 'notification-detail',
        component: () => import('@/views/NotificationDetailView.vue'),
        meta: { titleKey: 'routeTitle.notificationDetail', breadcrumbKeys: ['breadcrumb.notifications', 'breadcrumb.detail'] },
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
