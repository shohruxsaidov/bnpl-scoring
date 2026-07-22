<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DealSessionStatus } from '@/composables/use-deal-sessions-api'

/**
 * Deliberately separate from StatusBadge. A session's `active` means "an agent
 * is standing at this form right now", not the deal's `active` ("live and being
 * repaid") — so it gets the in-progress amber, not the success green, and the
 * two vocabularies never get confused for one another.
 */
const props = defineProps<{ status: DealSessionStatus; rejectReason?: string | null }>()
const { t, te } = useI18n()

const COLORS: Record<DealSessionStatus, { fg: string; bg: string }> = {
  active: { fg: 'var(--warning)', bg: 'var(--warning-bg)' },
  completed: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  rejected: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  abandoned: { fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
  expired: { fg: 'var(--text-secondary)', bg: 'var(--bg-surface)' },
}

const cfg = computed(() => ({
  ...COLORS[props.status],
  label: t(`dealSessions.status.${props.status}`),
}))

// Reuses the wizard's own rejection copy — the agent already reads these
// sentences when a run dies in front of them. Unknown codes fall back to the
// raw code rather than an empty cell: a new stop-factor should look untranslated,
// not invisible.
const reason = computed(() => {
  const code = props.rejectReason
  if (!code) return null
  const key = `stepClient.rejectReasons.${code}`
  return te(key) ? t(key) : code
})
</script>

<template>
  <div class="session-status">
    <span class="status-badge" :style="{ color: cfg.fg, background: cfg.bg }">
      <span class="dot" :style="{ background: cfg.fg }" />
      {{ cfg.label }}
    </span>
    <span v-if="reason" class="reason" :title="reason">{{ reason }}</span>
  </div>
</template>

<style scoped>
.session-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.reason {
  font-size: 0.72rem;
  line-height: 1.25;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
