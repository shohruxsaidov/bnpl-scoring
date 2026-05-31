<script setup lang="ts">
import { RouterView } from 'vue-router'
import BottomNav from './BottomNav.vue'
</script>

<template>
  <div class="shell">
    <main class="content">
      <div class="content-inner">
        <RouterView v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
