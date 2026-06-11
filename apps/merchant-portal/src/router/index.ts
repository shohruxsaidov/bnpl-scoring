import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login-view.vue'),
    meta: { public: true, titleKey: 'routeTitle.login' },
  },
  {
    path: '/change-password',
    name: 'change-password',
    component: () => import('@/views/change-password-view.vue'),
    meta: { titleKey: 'routeTitle.changePassword' },
  },
  {
    path: '/myid/callback/registration',
    name: 'myid-callback',
    component: () => import('@/views/myid-callback-view.vue'),
    meta: { public: true },
  },
  {
    path: '/myid/callback/signing_deal',
    name: 'myid-sign-callback',
    component: () => import('@/views/myid-sign-callback-view.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/app-shell.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/dashboard-view.vue'),
        meta: { titleKey: 'routeTitle.dashboard', breadcrumbKeys: ['breadcrumb.dashboard'] },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/deals/deals-view.vue'),
        meta: { titleKey: 'routeTitle.deals', breadcrumbKeys: ['breadcrumb.deals'] },
      },
      {
        path: 'deals/create',
        name: 'deals-create',
        component: () => import('@/views/new-deal/new-deal-view.vue'),
        meta: {
          titleKey: 'routeTitle.dealsCreate',
          breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.newDeal'],
          feature: 'create_deal',
        },
      },
      {
        path: 'calculator',
        name: 'calculator',
        component: () => import('@/views/calculator-view.vue'),
        meta: {
          titleKey: 'routeTitle.calculator',
          breadcrumbKeys: ['breadcrumb.calculator'],
          feature: 'create_deal',
        },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/deals/deal-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.deal',
          breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.detail'],
        },
      },
      {
        path: 'admin/products',
        name: 'admin-products',
        component: () => import('@/views/admin/products-view.vue'),
        meta: {
          titleKey: 'routeTitle.products',
          breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.products'],
          feature: 'view_products',
        },
      },
      {
        path: 'admin/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/categories-view.vue'),
        meta: {
          titleKey: 'routeTitle.categories',
          breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.categories'],
          feature: 'manage_categories',
        },
      },
      {
        path: 'admin/tariffs',
        name: 'admin-tariffs',
        component: () => import('@/views/admin/tariffs-view.vue'),
        meta: {
          titleKey: 'routeTitle.tariffs',
          breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.tariffs'],
          feature: 'manage_tariffs',
        },
      },
      {
        path: 'admin/branches',
        name: 'admin-branches',
        component: () => import('@/views/admin/branches-view.vue'),
        meta: {
          titleKey: 'routeTitle.branches',
          breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.branches'],
          feature: 'manage_branches',
        },
      },
      {
        path: 'admin/employees',
        name: 'admin-employees',
        component: () => import('@/views/admin/employees-view.vue'),
        meta: {
          titleKey: 'routeTitle.employees',
          breadcrumbKeys: ['breadcrumb.admin', 'breadcrumb.employees'],
          feature: 'manage_employees',
        },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/notifications-view.vue'),
        meta: {
          titleKey: 'routeTitle.notifications',
          breadcrumbKeys: ['breadcrumb.notifications'],
        },
      },
      {
        path: 'notifications/:id',
        name: 'notification-detail',
        component: () => import('@/views/notification-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.notificationDetail',
          breadcrumbKeys: ['breadcrumb.notifications', 'breadcrumb.detail'],
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings-view.vue'),
        meta: {
          titleKey: 'routeTitle.settings',
          breadcrumbKeys: ['breadcrumb.settings'],
        },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') return { name: 'dashboard' };
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  if (auth.employee?.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' };
  }

  const feature = to.meta.feature as string | undefined;
  if (feature && !auth.can(feature)) {
    return { name: 'dashboard' };
  }

  if (to.name === 'deals' && !auth.can('view_deals')) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
