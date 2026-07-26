import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    path: '/',
    component: () => import('@/components/app-shell.vue'),
    children: [
      {
        path: '',
        name: 'overview',
        component: () => import('@/views/overview-view.vue'),
        meta: { titleKey: 'routeTitle.overview', breadcrumbKeys: ['breadcrumb.overview'] },
      },
      {
        path: 'merchants',
        name: 'merchants',
        component: () => import('@/views/merchants-view.vue'),
        meta: {
          titleKey: 'routeTitle.merchants',
          breadcrumbKeys: ['breadcrumb.merchants'],
          feature: 'view_merchants',
        },
      },
      {
        path: 'onboarding/new',
        name: 'onboarding-new',
        component: () => import('@/views/onboarding-wizard-view.vue'),
        meta: {
          titleKey: 'routeTitle.onboarding',
          breadcrumbKeys: ['breadcrumb.onboarding'],
          feature: 'onboard_merchants',
        },
      },
      {
        path: 'merchants/:id',
        name: 'merchant-detail',
        component: () => import('@/views/merchant-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.merchant',
          breadcrumbKeys: ['breadcrumb.merchants', 'breadcrumb.detail'],
          feature: 'view_merchants',
        },
      },
      {
        path: 'clients',
        name: 'clients',
        component: () => import('@/views/clients-view.vue'),
        meta: {
          titleKey: 'routeTitle.clients',
          breadcrumbKeys: ['breadcrumb.clients'],
          feature: 'view_clients',
        },
      },
      {
        path: 'clients/:id',
        name: 'client-detail',
        component: () => import('@/views/client-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.clients',
          breadcrumbKeys: ['breadcrumb.clients', 'breadcrumb.detail'],
          feature: 'view_clients',
        },
      },
      {
        path: 'banners',
        name: 'banners',
        component: () => import('@/views/banners-view.vue'),
        meta: {
          titleKey: 'routeTitle.banners',
          breadcrumbKeys: ['breadcrumb.banners'],
          feature: 'manage_banners',
        },
      },
      {
        // Before the :id route, or 'new' would be parsed as a banner id.
        path: 'banners/new',
        name: 'banner-new',
        component: () => import('@/views/banner-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.banners',
          breadcrumbKeys: ['breadcrumb.banners', 'breadcrumb.new'],
          feature: 'manage_banners',
        },
      },
      {
        path: 'banners/:id',
        name: 'banner-detail',
        component: () => import('@/views/banner-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.banners',
          breadcrumbKeys: ['breadcrumb.banners', 'breadcrumb.detail'],
          feature: 'manage_banners',
        },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/deals-view.vue'),
        meta: {
          titleKey: 'routeTitle.deals',
          breadcrumbKeys: ['breadcrumb.deals'],
          feature: 'view_deals',
        },
      },
      {
        path: 'deals/:id',
        name: 'deal-detail',
        component: () => import('@/views/admin-deal-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.deals',
          breadcrumbKeys: ['breadcrumb.deals', 'breadcrumb.detail'],
          feature: 'view_deals',
        },
      },
      {
        path: 'employees',
        name: 'employees',
        component: () => import('@/views/employees-view.vue'),
        meta: {
          titleKey: 'routeTitle.employees',
          breadcrumbKeys: ['breadcrumb.employees'],
          feature: 'manage_employees',
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings-view.vue'),
        meta: {
          titleKey: 'routeTitle.settings',
          breadcrumbKeys: ['breadcrumb.settings'],
          // The hub is a menu: reachable if any card on it is. Scoring settings
          // is gated on manage_scoring_model and app-versions on view_app_versions,
          // so an admin holding only one of those would otherwise be bounced off
          // the page that links to it.
          anyFeature: ['manage_settings', 'manage_scoring_model', 'view_app_versions'],
        },
      },
      {
        path: 'settings/organization',
        name: 'settings-organization',
        component: () => import('@/views/settings-organization-view.vue'),
        meta: {
          titleKey: 'routeTitle.settingsOrganization',
          breadcrumbKeys: ['breadcrumb.settings', 'breadcrumb.settingsOrganization'],
          feature: 'manage_settings',
        },
      },
      {
        path: 'settings/public-offer',
        name: 'settings-public-offer',
        component: () => import('@/views/settings-public-offer-view.vue'),
        meta: {
          titleKey: 'routeTitle.settingsPublicOffer',
          breadcrumbKeys: ['breadcrumb.settings', 'breadcrumb.settingsPublicOffer'],
          feature: 'manage_settings',
        },
      },
      {
        // Gated by view_app_versions (read) at the route; the publish form
        // inside enforces manage_app_versions (write). Its own feature, not
        // manage_settings: publishing a floor can lock every client out at once.
        path: 'settings/app-versions',
        name: 'settings-app-versions',
        component: () => import('@/views/settings-app-versions-view.vue'),
        meta: {
          titleKey: 'routeTitle.settingsAppVersions',
          breadcrumbKeys: ['breadcrumb.settings', 'breadcrumb.settingsAppVersions'],
          feature: 'view_app_versions',
        },
      },
      {
        // Gated by manage_scoring_model, not manage_settings: these toggles can
        // weaken platform-wide risk controls, so they sit with model authoring
        // rather than with the org-requisites / public-offer grant.
        path: 'settings/scoring',
        name: 'settings-scoring',
        component: () => import('@/views/settings-scoring-view.vue'),
        meta: {
          titleKey: 'routeTitle.settingsScoring',
          breadcrumbKeys: ['breadcrumb.settings', 'breadcrumb.settingsScoring'],
          feature: 'manage_scoring_model',
        },
      },
      {
        path: 'settings/interface',
        name: 'settings-interface',
        component: () => import('@/views/settings-interface-view.vue'),
        meta: {
          titleKey: 'routeTitle.settingsInterface',
          breadcrumbKeys: ['breadcrumb.settings', 'breadcrumb.settingsInterface'],
          feature: 'manage_settings',
        },
      },
      {
        path: 'tariffs',
        name: 'tariffs',
        component: () => import('@/views/tariffs-view.vue'),
        meta: {
          titleKey: 'routeTitle.tariffs',
          breadcrumbKeys: ['breadcrumb.tariffs'],
          feature: 'view_tariffs',
        },
      },
      {
        path: 'blacklist',
        name: 'blacklist',
        component: () => import('@/views/blacklist-view.vue'),
        meta: {
          titleKey: 'routeTitle.blacklist',
          breadcrumbKeys: ['breadcrumb.blacklist'],
          feature: 'manage_blacklist',
        },
      },
      {
        path: 'buyout',
        name: 'buyout',
        component: () => import('@/views/buyout-view.vue'),
        meta: {
          titleKey: 'routeTitle.buyout',
          breadcrumbKeys: ['breadcrumb.buyout'],
          feature: 'manage_buyout',
        },
      },
      {
        path: 'collection-board',
        name: 'collection-board',
        component: () => import('@/views/collection-board-view.vue'),
        meta: {
          titleKey: 'routeTitle.collectionBoard',
          breadcrumbKeys: ['breadcrumb.collectionBoard'],
          feature: 'view_collection_board',
        },
      },
      {
        path: 'payments',
        name: 'payments',
        component: () => import('@/views/payments-view.vue'),
        meta: {
          titleKey: 'routeTitle.payments',
          breadcrumbKeys: ['breadcrumb.payments'],
          feature: 'view_payments',
        },
      },
      {
        path: 'permissions',
        name: 'permissions',
        component: () => import('@/views/permissions-view.vue'),
        meta: {
          titleKey: 'routeTitle.permissions',
          breadcrumbKeys: ['breadcrumb.permissions'],
          feature: 'manage_roles',
        },
      },
      {
        path: 'scoring-model',
        name: 'scoring-model',
        component: () => import('@/views/scoring-model-view.vue'),
        meta: {
          titleKey: 'routeTitle.scoringModel',
          breadcrumbKeys: ['breadcrumb.scoringModel'],
          feature: 'manage_scoring_model',
        },
      },
      {
        path: 'scoring-model/:id',
        name: 'scoring-model-detail',
        component: () => import('@/views/scoring-model-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.scoringModel',
          breadcrumbKeys: ['breadcrumb.scoringModel', 'breadcrumb.detail'],
          feature: 'manage_scoring_model',
        },
      },
      {
        path: 'scoring-model/:id/revisions/:revId',
        name: 'scoring-model-revision',
        component: () => import('@/views/scoring-model-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.scoringModel',
          breadcrumbKeys: ['breadcrumb.scoringModel', 'breadcrumb.detail'],
          feature: 'manage_scoring_model',
        },
      },
      {
        path: 'scorings',
        name: 'scorings',
        component: () => import('@/views/scorings-view.vue'),
        meta: {
          titleKey: 'routeTitle.scorings',
          breadcrumbKeys: ['breadcrumb.scorings'],
          feature: 'view_scorings',
        },
      },
      {
        path: 'scorings/:id',
        name: 'scoring-detail',
        component: () => import('@/views/scoring-detail-view.vue'),
        meta: {
          titleKey: 'routeTitle.scorings',
          breadcrumbKeys: ['breadcrumb.scorings', 'breadcrumb.detail'],
          feature: 'view_scorings',
        },
      },
      {
        path: 'integration-logs',
        name: 'integration-logs',
        component: () => import('@/views/integration-logs-view.vue'),
        meta: {
          titleKey: 'routeTitle.integrationLogs',
          breadcrumbKeys: ['breadcrumb.integrationLogs'],
          feature: 'view_integration_logs',
        },
      },
      {
        path: 'categories',
        name: 'categories',
        component: () => import('@/views/categories-view.vue'),
        meta: {
          titleKey: 'routeTitle.categories',
          breadcrumbKeys: ['breadcrumb.categories'],
          feature: 'manage_global_categories',
        },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory('/admin'),
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

  if (auth.admin?.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  // Dev-only screens are reserved to Superadmin.
  if (to.meta.superadmin && !auth.isSuperadmin) {
    return { name: 'overview' }
  }

  // Overview is always reachable as a safe landing; other routes are Feature-gated.
  const feature = to.meta.feature as string | undefined
  if (feature && !auth.can(feature) && to.name !== 'overview') {
    return { name: 'overview' }
  }

  // A hub page is only a menu — it is reachable if ANY card on it is. Its cards
  // carry their own gates, so holding one of these grants nothing extra.
  const anyFeature = to.meta.anyFeature as string[] | undefined
  if (anyFeature && !anyFeature.some((f) => auth.can(f)) && to.name !== 'overview') {
    return { name: 'overview' }
  }

  return true
})

export default router
