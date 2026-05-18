<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DealStatus } from '@/types'

const props = defineProps<{ status: DealStatus }>()
const { t } = useI18n()

const COLORS: Record<DealStatus, { fg: string; bg: string }> = {
  scoring: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  active: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  overdue: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  closed: { fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  declined: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

const cfg = computed(() => ({
  ...COLORS[props.status],
  label: t(`status.${props.status}`),
}))
</script>

<template>
  <span class="status-badge" :style="{ color: cfg.fg, background: cfg.bg }">
    <span class="dot" :style="{ background: cfg.fg }" />
    {{ cfg.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
