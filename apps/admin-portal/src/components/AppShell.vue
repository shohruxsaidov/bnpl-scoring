<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="shell">
    <AppSidebar :collapsed="collapsed" @toggle="collapsed = !collapsed" />
    <div class="main">
      <AppTopbar />
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
  overflow-x: auto;
}
</style>
