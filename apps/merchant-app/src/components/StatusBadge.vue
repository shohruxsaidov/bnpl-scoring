<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DealStatus } from '@/types'

const props = defineProps<{ status: DealStatus }>()
const { t } = useI18n()

const COLORS: Record<
  DealStatus,
  { fg: string; bg: string }
> = {
  draft: { fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  scoring: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  approved: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  declined: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  active: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  closed: { fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  overdue: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
}

const cfg = computed(() => ({
  ...COLORS[props.status],
  label: t(`status.${props.status}`),
}))
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
