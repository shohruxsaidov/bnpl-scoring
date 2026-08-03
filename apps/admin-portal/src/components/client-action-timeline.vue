<script setup lang="ts">
import { computed } from 'vue'
import { formatIsoDate } from '@/utils/money'
import { useClientActionLabels } from '@/composables/use-client-actions'
import type { ClientActionRow } from '@/types'

/**
 * The action log as a vertical timeline instead of a grid.
 *
 * A client's trail is bursty — a dozen scoring retries inside one minute, then
 * nothing for a week. A flat table renders that as an indistinguishable wall of
 * near-identical rows (exactly what the Действия tab looked like). Grouping by
 * day and hanging events off a spine makes the bursts and the silences visible,
 * which is the shape support is looking for.
 */

const props = defineProps<{ actions: ClientActionRow[] }>()
const emit = defineEmits<{ open: [row: ClientActionRow] }>()

const { actionLabel, actionIcon, actorLabel, sourceText, reasonLabel } = useClientActionLabels()

/** Day key in the ADMIN's timezone, not UTC — slicing the ISO string would file
 *  a 02:00 local event under the previous day while the row above it shows the
 *  local clock time. */
function localDayKey(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

// Rows arrive newest-first and stay that way: the last thing that happened is
// what support is asked about.
const days = computed(() => {
  const groups: Array<{ date: string; rows: ClientActionRow[] }> = []
  for (const row of props.actions) {
    const date = localDayKey(row.occurredAt)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.rows.push(row)
    else groups.push({ date, rows: [row] })
  }
  return groups
})

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Signing rows only open once the run produced a Deal — sessions have no page. */
function isOpenable(row: ClientActionRow): boolean {
  return Boolean(row.dealId || row.scoringId)
}
</script>

<template>
  <div class="tl surface-card">
    <div v-if="!actions.length" class="tl-empty muted">
      <i class="pi pi-inbox" />
      <span>{{ $t('clientDetail.noActions') }}</span>
    </div>

    <div v-for="group in days" :key="group.date" class="tl-day">
      <div class="tl-date">
        <span class="tl-date-label">{{ formatIsoDate(group.date) }}</span>
        <span class="tl-date-count muted">{{ group.rows.length }}</span>
      </div>

      <div class="tl-events">
        <button
          v-for="row in group.rows"
          :key="row.id"
          class="tl-event"
          :class="{ 'is-failed': row.status !== 'success', 'is-openable': isOpenable(row) }"
          type="button"
          :disabled="!isOpenable(row)"
          @click="emit('open', row)"
        >
          <span class="tl-time font-mono">{{ timeOf(row.occurredAt) }}</span>

          <span class="tl-node">
            <i class="pi" :class="actionIcon(row.action)" />
          </span>

          <span class="tl-main">
            <span class="tl-head">
              <span class="tl-name">{{ actionLabel(row.action) }}</span>
              <span
                class="tl-status"
                :class="row.status === 'success' ? 'is-ok' : 'is-bad'"
              >
                {{ $t(`clientDetail.actionStatus_${row.status}`) }}
              </span>
              <!-- Reconstructed rows carry an inferred actor, so say so rather
                   than let the actor read as something we observed. -->
              <span
                v-if="row.backfilled"
                class="tl-flag"
                :title="$t('clientDetail.actionBackfilled')"
              >
                <i class="pi pi-history" />
              </span>
            </span>

            <span class="tl-meta">
              <span class="tl-actor">
                <i class="pi pi-user" />
                {{ actorLabel(row) }}
              </span>
              <span v-if="sourceText(row)" class="tl-source">
                <i class="pi pi-building" />
                {{ sourceText(row) }}
              </span>
              <span v-if="row.reasonCode" class="tl-reason">
                <i class="pi pi-exclamation-circle" />
                {{ reasonLabel(row.reasonCode) }}
              </span>
            </span>
          </span>

          <i v-if="isOpenable(row)" class="pi pi-angle-right tl-go" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tl {
  padding: 0.4rem 0 0.6rem;
}

.tl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  font-size: 0.85rem;
}

.tl-empty .pi {
  font-size: 1.6rem;
  opacity: 0.5;
}

.tl-date {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 1.2rem 0.4rem;
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  z-index: 1;
}

.tl-date-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.tl-date-count {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.05rem 0.4rem;
  border-radius: var(--r-full);
  background: var(--bg-input);
  font-variant-numeric: tabular-nums;
}

.tl-events {
  display: flex;
  flex-direction: column;
  padding: 0 1.2rem;
}

.tl-event {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.5rem 0.5rem 0;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
  text-align: left;
  font-family: inherit;
  color: inherit;
  position: relative;
}

/* The spine: one continuous line behind every node in the day */
.tl-event::before {
  content: '';
  position: absolute;
  left: 63px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-subtle);
}

.tl-events .tl-event:first-child::before { top: 50%; }
.tl-events .tl-event:last-child::before { bottom: 50%; }
.tl-events .tl-event:only-child::before { display: none; }

.tl-event.is-openable {
  cursor: pointer;
}

.tl-event.is-openable:hover {
  background: var(--bg-hover);
}

.tl-time {
  width: 44px;
  flex-shrink: 0;
  font-size: 0.74rem;
  color: var(--text-muted);
  padding-top: 0.35rem;
  font-variant-numeric: tabular-nums;
}

.tl-node {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.7rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--text-accent);
  position: relative;
  z-index: 1;
  margin-top: 0.15rem;
}

.is-failed .tl-node {
  border-color: var(--danger-bd);
  background: var(--danger-bg);
  color: var(--danger);
}

.tl-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.tl-head {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.tl-name {
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--text-primary);
}

.tl-status {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 0.08rem 0.4rem;
  border-radius: var(--r-full);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tl-status.is-ok {
  color: var(--success);
  background: var(--success-bg);
}

.tl-status.is-bad {
  color: var(--danger);
  background: var(--danger-bg);
}

.tl-flag {
  color: var(--text-muted);
  font-size: 0.7rem;
  cursor: help;
}

.tl-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.85rem;
  font-size: 0.73rem;
  color: var(--text-secondary);
}

.tl-meta .pi {
  font-size: 0.65rem;
  opacity: 0.7;
  margin-right: 0.2rem;
}

.tl-reason {
  color: var(--danger);
}

.tl-go {
  align-self: center;
  font-size: 0.8rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tl-event.is-openable:hover .tl-go {
  color: var(--text-accent);
}

@media (max-width: 700px) {
  .tl-event::before { display: none; }
  .tl-time { width: 38px; }
}
</style>
