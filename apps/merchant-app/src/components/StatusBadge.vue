<script setup lang="ts">
import { computed } from 'vue'
import type { DealStatus } from '@/types'

const props = defineProps<{ status: DealStatus }>()

const MAP: Record<
  DealStatus,
  { label: string; fg: string; bg: string }
> = {
  draft: { label: 'Draft', fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  scoring: { label: 'Scoring', fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  approved: { label: 'Approved', fg: 'var(--success)', bg: 'var(--success-bg)' },
  declined: { label: 'Declined', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  active: { label: 'Active', fg: 'var(--success)', bg: 'var(--success-bg)' },
  closed: { label: 'Closed', fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  overdue: { label: 'Overdue', fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

const cfg = computed(() => MAP[props.status])
</script>

<template>
  <span
    class="status-badge"
    :style="{ color: cfg.fg, background: cfg.bg }"
  >
    <span class="dot" :style="{ background: cfg.fg }" />
    {{ cfg.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
