<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

withDefaults(defineProps<{ count?: number }>(), { count: 4 })
</script>

<template>
  <div class="sk-stats" :style="{ '--count': count }">
    <div v-for="i in count" :key="i" class="sk-card surface-card">
      <Skeleton width="6rem" height="0.7rem" border-radius="4px" />
      <Skeleton width="4rem" height="1.8rem" border-radius="6px" class="value" />
      <Skeleton shape="circle" size="2rem" class="icon" />
    </div>
  </div>
</template>

<style scoped>
.sk-stats {
  display: grid;
  grid-template-columns: repeat(var(--count), 1fr);
  gap: 1.1rem;
}
.sk-card {
  padding: 1.3rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 90px;
}
.icon {
  position: absolute;
  right: 1rem;
  top: 1rem;
  opacity: 0.2;
}
.value {
  margin-top: 0.2rem;
}

@media (max-width: 900px) {
  .sk-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .sk-stats { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
}
</style>
