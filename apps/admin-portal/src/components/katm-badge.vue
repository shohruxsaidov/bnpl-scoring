<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  katmClass: string
  scoringLevel?: string | null
}>()

const classColor = computed(() => {
  const c = props.katmClass.toUpperCase()
  if (c === 'A1' || c === 'A') return { border: '#1a8a4a', text: '#1a8a4a', bg: 'rgba(26,138,74,0.08)' }
  if (c === 'B') return { border: '#27ae60', text: '#27ae60', bg: 'rgba(39,174,96,0.08)' }
  if (c === 'C') return { border: '#f1c40f', text: '#b8950a', bg: 'rgba(241,196,15,0.08)' }
  if (c === 'D') return { border: '#e67e22', text: '#c06010', bg: 'rgba(230,126,34,0.08)' }
  return { border: '#e74c3c', text: '#c0392b', bg: 'rgba(231,76,60,0.08)' }
})
</script>

<template>
  <div
    class="badge"
    :style="{
      borderColor: classColor.border,
      background: classColor.bg,
    }"
  >
    <span class="badge-class" :style="{ color: classColor.text }">{{ katmClass }}</span>
    <span v-if="scoringLevel" class="badge-level" :style="{ color: classColor.text }">
      {{ scoringLevel }}
    </span>
  </div>
</template>

<style scoped>
.badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2.5px solid;
  border-radius: 14px;
  padding: 0.75rem 1.25rem;
  min-width: 90px;
  min-height: 90px;
  gap: 0.3rem;
}
.badge-class {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
}
.badge-level {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.85;
  text-align: center;
}
</style>
