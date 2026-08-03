<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '@/utils/money'
import { formatGap, useClientActionLabels } from '@/composables/use-client-actions'
import type { ClientActionRow, ClientActionType } from '@/types'

/**
 * Воронка действий — one client's path from registration to a signed deal.
 *
 * This is NOT the cohort funnel an analyst draws: with a sample size of one,
 * percentages are meaningless. What support actually asks at this screen is
 * «докуда клиент дошёл и где застрял», so each stage answers three things —
 * did they clear it, how many tries did it cost, and how long did the previous
 * stage hold them. The taper is decoration; the counters are the content.
 *
 * Stages are fixed rather than derived from the rows, because the shape of the
 * journey is the point: a client with no card_add row must show an EMPTY «Карта»
 * step, not a funnel that silently skips it.
 */

const props = defineProps<{ actions: ClientActionRow[] }>()

const { t } = useI18n()
const { reasonLabel } = useClientActionLabels()

type StageKey = 'registration' | 'card' | 'scoring' | 'signing'

const STAGE_DEFS: Array<{
  key: StageKey
  icon: string
  /** Rows that count as an attempt at this stage. */
  members: ClientActionType[]
}> = [
  { key: 'registration', icon: 'pi-user-plus', members: ['registration'] },
  { key: 'card', icon: 'pi-credit-card', members: ['card_add'] },
  { key: 'scoring', icon: 'pi-chart-line', members: ['scoring'] },
  {
    key: 'signing',
    icon: 'pi-verified',
    // A deliberate refusal is an attempt that failed, not an absent stage —
    // «клиент отказался» and «клиент не дошёл» are different support stories.
    members: ['deal_sign_myid', 'deal_sign_otp', 'deal_sign_reject'],
  },
]

/** Everything outside the funnel: account hygiene, not progress toward a deal. */
const SIDE_ACTIONS: ClientActionType[] = [
  'card_delete',
  'device_revoke',
  'biometric_enroll',
  'biometric_disable',
]

type Stage = {
  key: StageKey
  icon: string
  label: string
  attempts: number
  failures: number
  reached: boolean
  /** First success — when the client actually cleared the stage. */
  clearedAt: string | null
  /** Last attempt of any kind, used when the stage never cleared. */
  lastAttemptAt: string | null
  /** Reason of the most recent failure, shown when the client is stuck here. */
  lastFailureCode: string | null
  state: 'cleared' | 'stuck' | 'pending'
  /** Time since the previous stage cleared — the hesitation signal. */
  gap: string
}

// Rows arrive newest-first from the API; the funnel reasons in journey order.
const chronological = computed(() =>
  [...props.actions].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  ),
)

const stages = computed<Stage[]>(() => {
  const out: Stage[] = []
  let previousCleared: string | null = null

  for (const def of STAGE_DEFS) {
    const rows = chronological.value.filter((r) => def.members.includes(r.action))
    const successes = rows.filter(
      (r) => r.status === 'success' && r.action !== 'deal_sign_reject',
    )
    const failures = rows.filter(
      (r) => r.status !== 'success' || r.action === 'deal_sign_reject',
    )
    const clearedAt = successes[0]?.occurredAt ?? null
    const lastAttemptAt = rows[rows.length - 1]?.occurredAt ?? null

    // «Пусто» and «пробовали, не вышло» are different support stories, so a
    // stage with attempts and no success is always stuck — even if an earlier
    // stage has no rows at all (backfilled trails routinely miss registration).
    const state: Stage['state'] = clearedAt
      ? 'cleared'
      : rows.length > 0
        ? 'stuck'
        : 'pending'

    out.push({
      key: def.key,
      icon: def.icon,
      label: t(`clientDetail.funnelStage_${def.key}`),
      attempts: rows.length,
      failures: failures.length,
      reached: Boolean(clearedAt),
      clearedAt,
      lastAttemptAt,
      lastFailureCode: failures.length ? failures[failures.length - 1]!.reasonCode : null,
      state,
      gap: previousCleared && clearedAt ? formatGap(previousCleared, clearedAt, t) : '',
    })

    if (clearedAt) previousCleared = clearedAt
  }

  return out
})

const clearedCount = computed(() => stages.value.filter((s) => s.reached).length)

/** The headline: the furthest stage the client cleared, or where they stalled. */
const currentStage = computed(() => {
  const stuck = stages.value.find((s) => s.state === 'stuck')
  if (stuck) return { label: stuck.label, tone: 'stuck' as const }
  const lastCleared = [...stages.value].reverse().find((s) => s.reached)
  if (!lastCleared) return { label: t('clientDetail.funnelNotStarted'), tone: 'pending' as const }
  const done = clearedCount.value === STAGE_DEFS.length
  return { label: lastCleared.label, tone: done ? ('done' as const) : ('open' as const) }
})

/** Total friction across the journey — the one number worth reading first. */
const totalFailures = computed(
  () => props.actions.filter((r) => r.status !== 'success').length,
)

const firstSeen = computed(() => chronological.value[0]?.occurredAt ?? null)
const lastSeen = computed(
  () => chronological.value[chronological.value.length - 1]?.occurredAt ?? null,
)

/** Bars taper toward the bottom so the block reads as a funnel at a glance. */
function barWidth(index: number): string {
  return `${100 - index * 13}%`
}

const sideCounts = computed(() =>
  SIDE_ACTIONS.map((action) => ({
    action,
    label: t(`clientDetail.action_${action}`),
    count: props.actions.filter((r) => r.action === action).length,
  })).filter((s) => s.count > 0),
)
</script>

<template>
  <div class="funnel surface-card">
    <header class="f-head">
      <div class="f-title">
        <h3>{{ $t('clientDetail.funnelTitle') }}</h3>
        <span class="muted f-sub">{{ $t('clientDetail.funnelSubtitle') }}</span>
      </div>

      <div class="f-stats">
        <div class="f-stat">
          <span class="f-stat-label">{{ $t('clientDetail.funnelReached') }}</span>
          <span class="f-stat-value" :class="`tone-${currentStage.tone}`">
            {{ currentStage.label }}
          </span>
        </div>
        <div class="f-stat">
          <span class="f-stat-label">{{ $t('clientDetail.funnelProgress') }}</span>
          <span class="f-stat-value font-mono">{{ clearedCount }} / {{ stages.length }}</span>
        </div>
        <div class="f-stat">
          <span class="f-stat-label">{{ $t('clientDetail.funnelFailures') }}</span>
          <span class="f-stat-value font-mono" :class="{ 'tone-stuck': totalFailures > 0 }">
            {{ totalFailures }}
          </span>
        </div>
      </div>
    </header>

    <div class="f-body">
      <div v-for="(stage, i) in stages" :key="stage.key" class="f-row">
        <!-- Gap between milestones: how long the previous stage held the client -->
        <div v-if="i > 0" class="f-gap">
          <span v-if="stage.gap" class="f-gap-chip">{{ stage.gap }}</span>
          <span v-else class="f-gap-line" />
        </div>

        <div class="f-bar-wrap">
          <div class="f-bar" :class="`is-${stage.state}`" :style="{ width: barWidth(i) }">
            <span class="f-icon"><i class="pi" :class="stage.icon" /></span>

            <span class="f-label">
              <span class="f-name">{{ stage.label }}</span>
              <span class="f-when font-mono">
                <template v-if="stage.clearedAt">{{ formatDateTime(stage.clearedAt) }}</template>
                <template v-else-if="stage.state === 'stuck'">
                  {{ $t('clientDetail.funnelStuckAt', { date: formatDateTime(stage.lastAttemptAt) }) }}
                </template>
                <template v-else>{{ $t('clientDetail.funnelNoAttempt') }}</template>
              </span>
            </span>

            <span class="f-marks">
              <span v-if="stage.attempts > 1" class="f-chip">
                {{ $t('clientDetail.funnelAttempts', { n: stage.attempts }) }}
              </span>
              <span v-if="stage.failures > 0" class="f-chip is-danger">
                <i class="pi pi-exclamation-triangle" />
                {{ stage.failures }}
              </span>
              <i
                v-if="stage.state === 'cleared'"
                class="pi pi-check-circle f-state-icon is-ok"
              />
              <i
                v-else-if="stage.state === 'stuck'"
                class="pi pi-times-circle f-state-icon is-bad"
              />
              <i v-else class="pi pi-minus-circle f-state-icon is-idle" />
            </span>
          </div>

          <!-- Only the stage that actually blocked the client explains itself -->
          <span v-if="stage.state === 'stuck' && stage.lastFailureCode" class="f-reason">
            {{ $t('clientDetail.funnelBlockedBy') }}
            <b>{{ reasonLabel(stage.lastFailureCode) }}</b>
          </span>
        </div>
      </div>
    </div>

    <footer v-if="sideCounts.length || firstSeen" class="f-foot">
      <span v-if="firstSeen" class="f-foot-item">
        {{ $t('clientDetail.funnelFirstSeen') }}
        <b class="font-mono">{{ formatDateTime(firstSeen) }}</b>
      </span>
      <span v-if="lastSeen" class="f-foot-item">
        {{ $t('clientDetail.funnelLastSeen') }}
        <b class="font-mono">{{ formatDateTime(lastSeen) }}</b>
      </span>
      <span v-for="side in sideCounts" :key="side.action" class="f-foot-item">
        {{ side.label }} <b class="font-mono">×{{ side.count }}</b>
      </span>
    </footer>
  </div>
</template>

<style scoped>
.funnel {
  display: flex;
  flex-direction: column;
}

.f-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem 1.2rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
}

.f-title h3 {
  margin: 0 0 0.15rem;
  font-size: 0.95rem;
  font-weight: 800;
}

.f-sub {
  font-size: 0.75rem;
}

.f-stats {
  display: flex;
  gap: 1.75rem;
}

.f-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  text-align: right;
}

.f-stat-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.f-stat-value {
  font-size: 0.85rem;
  font-weight: 800;
}

.tone-done { color: var(--success); }
.tone-stuck { color: var(--danger); }
.tone-open { color: var(--text-accent); }
.tone-pending { color: var(--text-muted); }

.f-body {
  display: flex;
  flex-direction: column;
  padding: 1.1rem 1.2rem 0.6rem;
}

.f-row {
  display: flex;
  flex-direction: column;
}

/* Connector between milestones — carries the elapsed-time chip */
.f-gap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  position: relative;
}

.f-gap::before {
  content: '';
  position: absolute;
  inset: 0 auto;
  left: 50%;
  width: 1px;
  height: 100%;
  background: linear-gradient(
    to bottom,
    var(--border-default),
    var(--border-subtle)
  );
}

.f-gap-chip {
  position: relative;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-full);
  padding: 0.1rem 0.5rem;
  font-variant-numeric: tabular-nums;
}

.f-gap-line {
  display: none;
}

.f-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.f-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 52px;
  padding: 0.55rem 0.9rem;
  border-radius: var(--r-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg-input);
  transition: transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease);
}

.f-bar:hover {
  transform: translateY(-1px);
  box-shadow: var(--sh-sm);
}

.f-bar.is-cleared {
  background: linear-gradient(
    100deg,
    var(--accent-glow) 0%,
    rgba(123, 104, 238, 0.06) 55%,
    transparent 100%
  );
  border-color: var(--border-strong);
}

.f-bar.is-stuck {
  background: var(--danger-bg);
  border-color: var(--danger-bd);
}

.f-bar.is-pending {
  background: transparent;
  border-style: dashed;
  opacity: 0.6;
}

.f-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.is-cleared .f-icon {
  background: var(--gradient-hero);
  color: #fff;
  border-color: transparent;
}

.is-stuck .f-icon {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger-bd);
}

.f-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.f-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.is-pending .f-name {
  color: var(--text-muted);
}

.f-when {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.f-marks {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.f-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.12rem 0.45rem;
  border-radius: var(--r-full);
  background: var(--bg-surface);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  font-variant-numeric: tabular-nums;
}

.f-chip.is-danger {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-bd);
}

.f-state-icon {
  font-size: 1rem;
}

.f-state-icon.is-ok { color: var(--success); }
.f-state-icon.is-bad { color: var(--danger); }
.f-state-icon.is-idle { color: var(--text-muted); opacity: 0.5; }

.f-reason {
  font-size: 0.72rem;
  color: var(--danger);
}

.f-reason b {
  font-weight: 700;
}

.f-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  padding: 0.75rem 1.2rem;
  border-top: 1px solid var(--border-subtle);
}

.f-foot-item {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.f-foot-item b {
  color: var(--text-primary);
  font-weight: 700;
}

@media (max-width: 900px) {
  .f-head {
    flex-direction: column;
    gap: 0.75rem;
  }

  .f-stats {
    gap: 1.25rem;
  }

  .f-stat {
    text-align: left;
  }

  /* The taper costs too much width on a narrow screen — keep the content */
  .f-bar {
    width: 100% !important;
  }
}
</style>
