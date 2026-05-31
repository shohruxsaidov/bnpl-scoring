<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomNav from './BottomNav.vue'
import { transitionName } from '@/composables/usePageTransition'
</script>

<template>
  <div class="shell">
    <main class="content">
      <div class="content-inner">
        <RouterView v-slot="{ Component }">
          <transition :name="transitionName" mode="out-in">
            <component :is="Component" :key="$route.path" />
          </transition>
        </RouterView>
      </div>
    </main>

    <BottomNav />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
}
.content {
  flex: 1;
  display: flex;
  justify-content: center;
  padding-bottom: calc(72px + env(safe-area-inset-bottom));
}
.content-inner {
  width: 100%;
  max-width: 480px;
  padding: 1.25rem;
}

/* ── Fade (tab-level switches) ────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Slide transitions (push/pop) ─────────────────────────────────── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.22s ease;
  will-change: transform;
}

/* Push forward: new page slides in from right, old slides out to left */
.slide-left-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}

/* Pop back: new page slides in from left, old slides out to right */
.slide-right-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(40px);
  opacity: 0;
}
</style>
