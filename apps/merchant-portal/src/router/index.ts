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
    path: '/myid/callback/registration',
    name: 'myid-callback',
    component: () => import('@/views/MyidCallbackView.vue'),
    meta: { public: true },
  },
  {
    path: '/myid/callback/signing_deal',
    name: 'myid-sign-callback',
    component: () => import('@/views/MyidSignCallbackView.vue'),
    meta: { public: true },
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
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/deals/DealsView.vue'),
        meta: { titleKey: 'routeTitle.deals', breadcrumbKeys: ['breadcrumb.deals'] },
      },
      {
        path: 'deals/create',
        name: 'deals-create',
        component: () => import('@/views/new-deal/NewDealView.vue'),
        meta: { titleKey: 'routeTitle.dealsCreate', breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.newDeal'], feature: 'create_deal' },
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
        meta: { titleKey: 'routeTitle.products', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.products'], feature: 'manage_products' },
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoriesView.vue'),
        meta: { titleKey: 'routeTitle.categories', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.categories'], feature: 'manage_categories' },
      },
      {
        path: 'admin/tariffs',
        name: 'admin-tariffs',
        component: () => import('@/views/admin/TariffsView.vue'),
        meta: { titleKey: 'routeTitle.tariffs', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.tariffs'], feature: 'manage_tariffs' },
      },
      {
        path: 'admin/branches',
        name: 'admin-branches',
        component: () => import('@/views/admin/BranchesView.vue'),
        meta: { titleKey: 'routeTitle.branches', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.branches'], feature: 'manage_branches' },
      },
      {
        path: 'admin/employees',
        name: 'admin-employees',
        component: () => import('@/views/admin/EmployeesView.vue'),
        meta: { titleKey: 'routeTitle.employees', breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.employees'], feature: 'manage_employees' },
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

  const feature = to.meta.feature as string | undefined
  if (feature && !auth.can(feature)) {
    return { name: 'dashboard' }
  }

  if (to.name === 'deals' && !auth.can('view_deals')) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
