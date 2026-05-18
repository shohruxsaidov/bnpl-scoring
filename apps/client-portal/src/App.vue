<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import Toast from 'primevue/toast'

onMounted(() => {
  const stored = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = stored ?? (prefersDark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
})
</script>

<template>
  <RouterView />
  <Toast position="top-center" />
</template>
