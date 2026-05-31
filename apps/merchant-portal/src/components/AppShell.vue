<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import SearchDialog from './SearchDialog.vue'
import { useNotificationsStore } from '@/stores/notifications'

const notifStore = useNotificationsStore()
const collapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)
const searchOpen = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) mobileOpen.value = false
}

function onGlobalKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    searchOpen.value = true
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('keydown', onGlobalKey)
  notifStore.fetchAll()
  notifStore.connectSSE()
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('keydown', onGlobalKey)
  notifStore.disconnectSSE()
})

function handleToggle() {
  if (isMobile.value) {
    mobileOpen.value = !mobileOpen.value
  } else {
    collapsed.value = !collapsed.value
  }
}

const sidebarCollapsed = computed(() => isMobile.value ? false : collapsed.value)
const sidebarVisible = computed(() => isMobile.value ? mobileOpen.value : true)
</script>

<template>
  <div class="shell">
    <div v-if="isMobile && mobileOpen" class="overlay" @click="mobileOpen = false" />
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="sidebarVisible"
      :is-mobile="isMobile"
      @toggle="handleToggle"
    />
    <div class="main">
      <AppTopbar :show-menu-btn="isMobile" @menu="handleToggle" @search="searchOpen = true" />
      <main class="content">
        <RouterView />
      </main>
    </div>
    <SearchDialog v-model:visible="searchOpen" />
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
  padding: 1.6rem;
  /* clip instead of auto — prevents horizontal overflow without creating a scroll
     container, so position:sticky in child views works against the page scroll */
  overflow-x: clip;
}
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 49;
}

@media (max-width: 767px) {
  .content {
    padding: 1rem;
  }
}
</style>
