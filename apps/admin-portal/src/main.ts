import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import { createI18n } from 'vue-i18n'

import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import uz from './locales/uz.json'
import ru from './locales/ru.json'
import './styles/main.css'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('lang') || 'uz',
  fallbackLocale: 'ru',
  messages: { uz, ru },
})

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

async function bootstrap() {
  // Restore session BEFORE installing the router so the beforeEach guard
  // sees the correct auth state on the very first navigation (e.g. after reload).
  await useAuthStore().restoreSession()

  app.use(VueQueryPlugin)
  app.use(router)

  app.use(i18n)
  app.use(PrimeVue, {
    ripple: true,
    unstyled: false,
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: '[data-theme="dark"]',
        cssLayer: {
          name: 'primevue',
          order: 'theme, base, primevue',
        },
      },
    },
  })
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)

  app.mount('#app')
}

bootstrap()
