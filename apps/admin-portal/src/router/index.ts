import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, titleKey: 'routeTitle.login' },
  },
  {
    path: '/change-password',
    name: 'change-password',
    component: () => import('@/views/ChangePasswordView.vue'),
    meta: { titleKey: 'routeTitle.changePassword' },
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
        meta: {
          titleKey: 'routeTitle.merchants',
          breadcrumbKeys: ['breadcrumb.merchants'],
          feature: 'view_merchants',
        },
      },
      {
        path: 'onboarding/new',
        name: 'onboarding-new',
        component: () => import('@/views/OnboardingWizardView.vue'),
        meta: {
          titleKey: 'routeTitle.onboarding',
          breadcrumbKeys: ['breadcrumb.onboarding'],
          feature: 'onboard_merchants',
        },
      },
      {
        path: 'merchants/:id',
        name: 'merchant-detail',
        component: () => import('@/views/MerchantDetailView.vue'),
        meta: {
          titleKey: 'routeTitle.merchant',
          breadcrumbKeys: ['breadcrumb.merchants', 'breadcrumb.detail'],
          feature: 'view_merchants',
        },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/DealsView.vue'),
        meta: {
          titleKey: 'routeTitle.deals',
          breadcrumbKeys: ['breadcrumb.deals'],
          feature: 'view_deals',
        },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/AdminDealDetailView.vue'),
        meta: {
          titleKey: 'routeTitle.deals',
          breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.detail'],
          feature: 'view_deals',
        },
      },
      {
        path: 'employees',
        name: 'employees',
        component: () => import('@/views/EmployeesView.vue'),
        meta: {
          titleKey: 'routeTitle.employees',
          breadcrumbKeys: ['breadcrumb.employees'],
          feature: 'manage_employees',
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: {
          titleKey: 'routeTitle.settings',
          breadcrumbKeys: ['breadcrumb.settings'],
          feature: 'manage_settings',
        },
      },
      {
        path: 'tariffs',
        name: 'tariffs',
        component: () => import('@/views/TariffsView.vue'),
        meta: {
          titleKey: 'routeTitle.tariffs',
          breadcrumbKeys: ['breadcrumb.tariffs'],
          feature: 'view_tariffs',
        },
      },
      {
        path: 'blacklist',
        name: 'blacklist',
        component: () => import('@/views/BlacklistView.vue'),
        meta: {
          titleKey: 'routeTitle.blacklist',
          breadcrumbKeys: ['breadcrumb.blacklist'],
          feature: 'manage_blacklist',
        },
      },
      {
        path: 'buyout',
        name: 'buyout',
        component: () => import('@/views/BuyoutView.vue'),
        meta: {
          titleKey: 'routeTitle.buyout',
          breadcrumbKeys: ['breadcrumb.buyout'],
          feature: 'manage_buyout',
        },
      },
      {
        path: 'collection-board',
        name: 'collection-board',
        component: () => import('@/views/CollectionBoardView.vue'),
        meta: {
          titleKey: 'routeTitle.collectionBoard',
          breadcrumbKeys: ['breadcrumb.collectionBoard'],
          feature: 'view_collection_board',
        },
      },
      {
        path: 'scoring-history',
        name: 'scoring-history',
        component: () => import('@/views/ScoringHistoryView.vue'),
        meta: {
          titleKey: 'routeTitle.scoringHistory',
          breadcrumbKeys: ['breadcrumb.scoringHistory'],
          feature: 'view_scoring_history',
        },
      },
      {
        path: 'scoring-history/:id',
        name: 'scoring-detail',
        component: () => import('@/views/ScoringDetailView.vue'),
        meta: {
          titleKey: 'routeTitle.scoringHistory',
          breadcrumbKeys: ['breadcrumb.scoringHistory', 'breadcrumb.detail'],
          feature: 'view_scoring_history',
        },
      },
      {
        path: 'payments',
        name: 'payments',
        component: () => import('@/views/PaymentsView.vue'),
        meta: {
          titleKey: 'routeTitle.payments',
          breadcrumbKeys: ['breadcrumb.payments'],
          feature: 'view_payments',
        },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/SendNotificationView.vue'),
        meta: {
          titleKey: 'routeTitle.sendNotification',
          breadcrumbKeys: ['breadcrumb.notifications'],
          feature: 'send_notifications',
        },
      },
      {
        path: 'permissions',
        name: 'permissions',
        component: () => import('@/views/PermissionsView.vue'),
        meta: {
          titleKey: 'routeTitle.permissions',
          breadcrumbKeys: ['breadcrumb.permissions'],
          feature: 'manage_roles',
        },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory('/admin'),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') return { name: 'overview' };
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  if (auth.admin?.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' };
  }

  // Dev-only screens are reserved to Superadmin.
  if (to.meta.superadmin && !auth.isSuperadmin) {
    return { name: 'overview' };
  }

  // Overview is always reachable as a safe landing; other routes are Feature-gated.
  const feature = to.meta.feature as string | undefined;
  if (feature && !auth.can(feature) && to.name !== 'overview') {
    return { name: 'overview' };
  }

  return true;
});

export default router;
