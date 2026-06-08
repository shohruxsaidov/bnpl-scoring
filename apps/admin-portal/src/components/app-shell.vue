<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './app-sidebar.vue'
import AppTopbar from './app-topbar.vue'

const collapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) mobileOpen.value = false
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
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

@media (max-width: 767px) {
  .content {
    padding: 1rem;
  }
}
</style>
