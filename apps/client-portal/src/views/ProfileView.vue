<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import ThemeToggle from '@/components/ThemeToggle.vue'

const auth = useAuthStore()
const notifs = useNotificationsStore()
const router = useRouter()
const { locale } = useI18n()

const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window

function togglePush() {
  if (notifs.pushEnabled) notifs.disablePush()
  else notifs.enablePush()
}

function setLang(lang: 'uz' | 'ru') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

const client = computed(() => auth.user)

const fullName = computed(() =>
  client.value ? `${client.value.firstName} ${client.value.lastName}`.trim() : '',
)

const initials = computed(() => {
  return fullName.value
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="client" class="profile">
    <header class="ph surface-card">
      <div class="avatar">{{ initials }}</div>
      <div class="ph-name">{{ fullName }}</div>
      <div class="ph-phone font-mono">{{ client.phone }}</div>
    </header>

    <section class="block surface-card">
      <h2 class="block-title">{{ $t('profile.personalInfo') }}</h2>
      <div class="row">
        <span class="row-label">{{ $t('profile.fullName') }}</span>
        <span class="row-value">{{ fullName }}</span>
      </div>
      <div class="row">
        <span class="row-label">{{ $t('profile.phone') }}</span>
        <span class="row-value font-mono">{{ client.phone }}</span>
      </div>
    </section>

    <section class="block surface-card">
      <h2 class="block-title">{{ $t('profile.preferences') }}</h2>
      <div class="row nav-row" @click="router.push({ name: 'notifications' })">
        <span class="row-label">{{ $t('nav.alerts') }}</span>
        <div class="row-right">
          <span v-if="notifs.unreadCount > 0" class="notif-badge">{{ notifs.unreadCount }}</span>
          <i class="pi pi-chevron-right row-chevron" />
        </div>
      </div>
      <div class="row">
        <span class="row-label">{{ $t('profile.language') }}</span>
        <div class="lang-switch">
          <button
            class="lang-btn"
            :class="{ active: locale === 'uz' }"
            @click="setLang('uz')"
          >UZ</button>
          <span class="lang-sep">|</span>
          <button
            class="lang-btn"
            :class="{ active: locale === 'ru' }"
            @click="setLang('ru')"
          >RU</button>
        </div>
      </div>
      <div class="row toggle-row">
        <div>
          <span class="row-value">{{ $t('profile.appearance') }}</span>
          <span class="row-hint">{{ $t('profile.appearanceHint') }}</span>
        </div>
        <ThemeToggle />
      </div>
      <div v-if="pushSupported" class="row toggle-row">
        <div>
          <span class="row-value">{{ $t('profile.pushNotifications') }}</span>
          <span class="row-hint">{{ $t('profile.pushNotificationsHint') }}</span>
        </div>
        <button class="push-toggle" :class="{ active: notifs.pushEnabled }" @click="togglePush">
          <span class="push-knob" />
        </button>
      </div>
    </section>

    <button class="logout" @click="logout">
      <i class="pi pi-sign-out" /> {{ $t('profile.logout') }}
    </button>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ph {
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  text-align: center;
}
.avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--gradient-hero);
  color: #fff;
  font-size: 1.7rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  margin-bottom: 0.4rem;
}
.ph-name {
  font-size: 1.3rem;
  font-weight: 800;
}
.ph-phone {
  font-size: 0.88rem;
  color: var(--text-secondary);
}
.block {
  padding: 1.3rem;
}
.block-title {
  margin: 0 0 1rem;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.row:first-of-type {
  padding-top: 0;
}
.row-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.row-value {
  font-size: 0.9rem;
  font-weight: 700;
  text-align: right;
}
.toggle-row {
  align-items: center;
}
.nav-row {
  cursor: pointer;
}
.nav-row:hover {
  color: var(--accent-2);
}
.row-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.notif-badge {
  background: var(--danger);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
.row-chevron {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.lang-switch {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  border-radius: 10px;
  padding: 0.25rem 0.5rem;
}
.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.76rem;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  transition: color 0.15s ease;
  font-family: inherit;
}
.lang-btn:hover {
  color: var(--text-primary);
}
.lang-btn.active {
  color: var(--accent-2);
}
.lang-sep {
  color: var(--border-subtle);
  font-size: 0.76rem;
}
.row-hint {
  display: block;
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-top: 0.2rem;
}
.card-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.card-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.card-row:first-of-type {
  padding-top: 0;
}
.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--accent-2);
  display: grid;
  place-items: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.card-brand {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.card-pan {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 14px;
  padding: 0.95rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.logout:hover {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
}
.push-toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: var(--border-subtle);
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}
.push-toggle.active {
  background: var(--accent-2);
}
.push-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}
.push-toggle.active .push-knob {
  transform: translateX(18px);
}
</style>
