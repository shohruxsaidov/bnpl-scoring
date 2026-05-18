import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createI18n } from 'vue-i18n'

import 'primeicons/primeicons.css'

import App from './App.vue'
import router from './router'
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

app.use(createPinia())
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
app.directive('tooltip', Tooltip)

app.mount('#app')
