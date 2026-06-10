<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import AppSidebar from './app-sidebar.vue'
import AppTopbar from './app-topbar.vue'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'

const collapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const orgStore = useOrganizationStore()

watch(() => route.path, () => {
  if (isMobile.value) mobileOpen.value = false
})

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) mobileOpen.value = false
}

// Organization requisites print on every Contract — warn admins who can fix it
// (manage_settings) until the singleton row is created. Dismissible; reappears
// next session.
async function checkOrganization() {
  if (!auth.can('manage_settings')) return
  const org = await orgStore.fetch().catch(() => undefined)
  if (org !== null) return
  toast.add({
    severity: 'warn',
    group: 'org-missing',
    summary: t('orgWarning.title'),
    detail: t('orgWarning.message'),
  })
}

function goToOrganizationForm() {
  toast.removeGroup('org-missing')
  router.push({ name: 'settings' })
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  checkOrganization()
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

function handleToggle() {
  if (isMobile.value) {
    mobileOpen.value = !mobileOpen.value
  } else {
    collapsed.value = !collapsed.value
  }
}
</script>

<template>
  <div class="shell">
    <div v-if="isMobile && mobileOpen" class="overlay" @click="mobileOpen = false" />
    <AppSidebar
      :collapsed="isMobile ? false : collapsed"
      :mobile-open="isMobile ? mobileOpen : true"
      :is-mobile="isMobile"
      @toggle="handleToggle"
    />
    <div class="main">
      <AppTopbar :show-menu-btn="isMobile" @menu="handleToggle" />
      <main class="content">
        <RouterView />
      </main>
    </div>
    <Toast position="bottom-center" group="org-missing">
      <template #message="slotProps">
        <div class="org-toast">
          <i class="pi pi-exclamation-triangle org-toast-icon" />
          <div class="org-toast-body">
            <span class="org-toast-title">{{ slotProps.message.summary }}</span>
            <span class="org-toast-text">{{ slotProps.message.detail }}</span>
          </div>
          <button class="btn-gradient org-toast-btn" @click="goToOrganizationForm">
            {{ $t('orgWarning.action') }}
          </button>
        </div>
      </template>
    </Toast>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-surface);
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.content {
  flex: 1;
  padding: 1.2rem 1.4rem;
  overflow-x: clip;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 49;
}
.org-toast {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 1;
  min-width: 0;
}
.org-toast-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}
.org-toast-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.org-toast-title {
  font-weight: 700;
  font-size: 0.88rem;
}
.org-toast-text {
  font-size: 0.8rem;
}
.org-toast-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .content {
    padding: 1rem;
  }
}
</style>
