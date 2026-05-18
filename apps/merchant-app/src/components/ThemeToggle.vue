<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isDark = ref(false)

function apply(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  isDark.value = theme === 'dark'
}

function toggle() {
  apply(isDark.value ? 'light' : 'dark')
}

onMounted(() => {
  isDark.value =
    document.documentElement.getAttribute('data-theme') === 'dark'
})
</script>

<template>
  <button
    class="theme-toggle"
    :title="isDark ? 'Switch to light' : 'Switch to dark'"
    @click="toggle"
  >
    <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" />
  </button>
</template>

<style scoped>
.theme-toggle {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.theme-toggle:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
</style>
