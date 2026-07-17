<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useAuthStore } from '@/stores/auth'
import { useAppVersionsStore, type AppPlatform, type FleetImpact } from '@/stores/app-versions'
import { formatDateTime } from '@/utils/money'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const auth = useAuthStore()
const store = useAppVersionsStore()

// Publishing is the fleet-locking action; reading the floor is not. Gate the
// whole form on the write feature — the route already gates the page on read.
const canManage = computed(() => auth.can('manage_app_versions'))

const platform = ref<AppPlatform>('ios')
const platformOptions = computed<{ label: string; value: AppPlatform }[]>(() => [
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
])

const minSupportedVersion = ref('')
const latestVersion = ref('')
const storeUrl = ref('')
const messageUz = ref('')
const messageRu = ref('')
const label = ref('')

const publishing = ref(false)
const loading = ref(false)

// Client mirror of the server's strict MAJOR.MINOR.PATCH grammar (lib/semver).
// Kept in lockstep so the form rejects what the API would reject, rather than
// round-tripping to discover it.
const SEMVER = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/
function parseSemver(input: string): [number, number, number] | null {
  const m = SEMVER.exec(input.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

const minParsed = computed(() => parseSemver(minSupportedVersion.value))
const latestParsed = computed(() => parseSemver(latestVersion.value))
const minAboveLatest = computed(
  () => !!minParsed.value && !!latestParsed.value && compareSemver(minParsed.value, latestParsed.value) > 0,
)

const canPublish = computed(
  () =>
    canManage.value &&
    !publishing.value &&
    !!minParsed.value &&
    !!latestParsed.value &&
    !minAboveLatest.value &&
    storeUrl.value.trim().length > 0 &&
    messageUz.value.trim().length > 0 &&
    messageRu.value.trim().length > 0,
)

// The live policy for the selected platform is its most recent revision, and
// the list arrives newest-first.
const current = computed(() => store.revisions.find((r) => r.platform === platform.value) ?? null)
const history = computed(() => store.revisions.filter((r) => r.platform === platform.value))

/* ── Blast-radius preview ────────────────────────────────────────────────── */

const impact = ref<FleetImpact | null>(null)
const impactLoading = ref(false)

async function checkImpact() {
  if (!minParsed.value) return
  impactLoading.value = true
  try {
    impact.value = await store.fetchFleetImpact({
      platform: platform.value,
      minSupportedVersion: minSupportedVersion.value.trim(),
    })
  } catch {
    impact.value = null
    toast.add({ severity: 'error', summary: t('appVersion.impactFailed'), life: 3000 })
  } finally {
    impactLoading.value = false
  }
}

// A preview computed against one platform/floor is meaningless once either
// changes; drop it so a stale count can't inform a publish.
function invalidateImpact() {
  impact.value = null
}

/* ── Publish (behind a confirm that states the lockout) ──────────────────── */

function askPublish() {
  if (!canPublish.value) return
  const lockedOut = impact.value?.lockedOut
  const message =
    lockedOut != null
      ? t('appVersion.confirmMsgWithImpact', {
          min: minSupportedVersion.value.trim(),
          count: lockedOut,
          percent: impact.value?.lockedOutPercent ?? 0,
        })
      : t('appVersion.confirmMsg', { min: minSupportedVersion.value.trim() })

  confirm.require({
    header: t('appVersion.confirmTitle', { platform: platform.value === 'ios' ? 'iOS' : 'Android' }),
    message,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('appVersion.publishAnyway'), severity: 'danger' },
    accept: () => void publish(),
  })
}

async function publish() {
  publishing.value = true
  try {
    await store.publish({
      platform: platform.value,
      minSupportedVersion: minSupportedVersion.value.trim(),
      latestVersion: latestVersion.value.trim(),
      storeUrl: storeUrl.value.trim(),
      messageUz: messageUz.value.trim(),
      messageRu: messageRu.value.trim(),
      label: label.value.trim() || null,
    })
    toast.add({ severity: 'success', summary: t('appVersion.published'), life: 2000 })
    minSupportedVersion.value = ''
    latestVersion.value = ''
    storeUrl.value = ''
    messageUz.value = ''
    messageRu.value = ''
    label.value = ''
    impact.value = null
  } catch (e) {
    const code = e instanceof Error ? e.message : 'error'
    const summary =
      code === 'min_above_latest'
        ? t('appVersion.errMinAboveLatest')
        : code === 'invalid_version'
          ? t('appVersion.errInvalidVersion')
          : t('appVersion.publishFailed')
    toast.add({ severity: 'error', summary, life: 3000 })
  } finally {
    publishing.value = false
  }
}

onMounted(async () => {
  if (store.loaded) return
  loading.value = true
  await store.fetchAll().catch(() => null)
  loading.value = false
})
</script>

<template>
  <div class="settings-page">
    <router-link class="back-link" :to="{ name: 'settings' }">
      <i class="pi pi-arrow-left" />
      {{ $t('settings.backToSettings') }}
    </router-link>

    <!-- Platform scope -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('appVersion.platform') }}</h3>
        <p class="section-hint">{{ $t('appVersion.platformHint') }}</p>
      </header>
      <div class="panel-body">
        <Select
          v-model="platform"
          :options="platformOptions"
          option-label="label"
          option-value="value"
          class="platform-select"
          @change="invalidateImpact"
        />
      </div>
    </section>

    <!-- Current live policy -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('appVersion.current') }}</h3>
        <p class="section-hint">{{ $t('appVersion.currentHint') }}</p>
      </header>
      <div class="panel-body">
        <div v-if="current" class="current-grid">
          <div class="stat">
            <span class="stat-label">{{ $t('appVersion.minSupported') }}</span>
            <span class="stat-value">{{ current.minSupportedVersion }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">{{ $t('appVersion.latest') }}</span>
            <span class="stat-value">{{ current.latestVersion }}</span>
          </div>
          <div class="stat wide">
            <span class="stat-label">{{ $t('appVersion.storeUrl') }}</span>
            <a :href="current.storeUrl" target="_blank" rel="noopener" class="store-link">
              {{ current.storeUrl }}
            </a>
          </div>
          <div class="stat wide">
            <span class="stat-label">{{ $t('appVersion.updatedBy') }}</span>
            <span class="stat-value muted">
              v{{ current.version }} · {{ formatDateTime(current.createdAt) }}
              <template v-if="current.createdByName"> · {{ current.createdByName }}</template>
            </span>
          </div>
        </div>
        <p v-else-if="!loading" class="empty">{{ $t('appVersion.noneForPlatform') }}</p>
      </div>
    </section>

    <!-- Publish new policy -->
    <section v-if="canManage" class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('appVersion.publishNew') }}</h3>
        <p class="section-hint">{{ $t('appVersion.publishHint') }}</p>
      </header>
      <div class="panel-body form">
        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('appVersion.minSupported') }}</label>
            <InputText
              v-model="minSupportedVersion"
              placeholder="1.4.0"
              maxlength="14"
              :invalid="minSupportedVersion.trim().length > 0 && !minParsed"
              @update:model-value="invalidateImpact"
            />
            <span class="field-hint">{{ $t('appVersion.forceHint') }}</span>
          </div>
          <div class="field">
            <label class="field-label">{{ $t('appVersion.latest') }}</label>
            <InputText
              v-model="latestVersion"
              placeholder="1.6.0"
              maxlength="14"
              :invalid="latestVersion.trim().length > 0 && !latestParsed"
            />
            <span class="field-hint">{{ $t('appVersion.softHint') }}</span>
          </div>
        </div>
        <p v-if="minAboveLatest" class="inline-error">
          <i class="pi pi-exclamation-triangle" /> {{ $t('appVersion.errMinAboveLatest') }}
        </p>

        <div class="field">
          <label class="field-label">{{ $t('appVersion.storeUrl') }}</label>
          <InputText v-model="storeUrl" placeholder="https://apps.apple.com/..." maxlength="2048" />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('appVersion.messageUz') }}</label>
            <Textarea v-model="messageUz" rows="3" maxlength="500" auto-resize />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('appVersion.messageRu') }}</label>
            <Textarea v-model="messageRu" rows="3" maxlength="500" auto-resize />
          </div>
        </div>
        <span class="field-hint">{{ $t('appVersion.messageHint') }}</span>

        <div class="field">
          <label class="field-label">{{ $t('appVersion.label') }}</label>
          <InputText v-model="label" :placeholder="$t('appVersion.labelPlaceholder')" maxlength="500" />
        </div>

        <!-- Blast-radius preview -->
        <div class="impact-box">
          <div class="impact-head">
            <span class="impact-title">{{ $t('appVersion.impactTitle') }}</span>
            <button
              class="btn-outline"
              :disabled="!minParsed || impactLoading"
              @click="checkImpact"
            >
              <i v-if="impactLoading" class="pi pi-spin pi-spinner" />
              {{ $t('appVersion.checkImpact') }}
            </button>
          </div>
          <div v-if="impact" class="impact-body">
            <p class="impact-headline">
              {{ $t('appVersion.impactHeadline', {
                count: impact.lockedOut,
                percent: impact.lockedOutPercent,
                total: impact.activeDevices,
                days: impact.days,
              }) }}
            </p>
            <p v-if="impact.unknownVersion > 0" class="impact-note">
              {{ $t('appVersion.impactUnknown', { count: impact.unknownVersion }) }}
            </p>
            <p class="impact-note subtle">{{ $t('appVersion.impactCaveat') }}</p>
            <table v-if="impact.distribution.length" class="history-table">
              <thead>
                <tr>
                  <th>{{ $t('appVersion.colAppVersion') }}</th>
                  <th>{{ $t('appVersion.colDevices') }}</th>
                  <th>{{ $t('appVersion.colVerdict') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in impact.distribution" :key="b.appVersion">
                  <td>{{ b.appVersion }}</td>
                  <td>{{ b.devices }}</td>
                  <td>
                    <span class="verdict" :class="{ 'locked': b.lockedOut }">
                      {{ b.lockedOut ? $t('appVersion.verdictLocked') : $t('appVersion.verdictOk') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="impact-hint">{{ $t('appVersion.impactPrompt') }}</p>
        </div>

        <div class="actions">
          <button class="btn-gradient" :disabled="!canPublish" @click="askPublish">
            <i v-if="publishing" class="pi pi-spin pi-spinner" />
            {{ $t('appVersion.publish') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Revision history -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('appVersion.history') }}</h3>
      </header>
      <div class="panel-body">
        <table v-if="history.length" class="history-table">
          <thead>
            <tr>
              <th>{{ $t('appVersion.colVersion') }}</th>
              <th>{{ $t('appVersion.colMin') }}</th>
              <th>{{ $t('appVersion.colLatest') }}</th>
              <th>{{ $t('appVersion.colLabel') }}</th>
              <th>{{ $t('appVersion.colDate') }}</th>
              <th>{{ $t('appVersion.colAuthor') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in history" :key="r.id">
              <td><span class="version-badge sm">v{{ r.version }}</span></td>
              <td>{{ r.minSupportedVersion }}</td>
              <td>{{ r.latestVersion }}</td>
              <td>{{ r.label || '—' }}</td>
              <td>{{ formatDateTime(r.createdAt) }}</td>
              <td>{{ r.createdByName || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!loading" class="empty">{{ $t('appVersion.noneForPlatform') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  width: fit-content;
}
.back-link:hover {
  color: var(--text-primary);
}
.back-link .pi {
  font-size: 0.75rem;
}
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.section-hint {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.panel-body {
  padding: 1rem 1.1rem 1.1rem;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.form :deep(.p-inputtext),
.form :deep(.p-textarea) {
  width: 100%;
}
.platform-select {
  min-width: 12rem;
}
.field {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.35rem;
}
.field-row {
  display: flex;
  gap: 0.85rem;
}
.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.field-hint {
  font-size: 0.72rem;
  color: var(--text-secondary);
}
.inline-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--red-500, #ef4444);
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
.current-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.stat.wide {
  grid-column: 1 / -1;
}
.stat-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}
.stat-value {
  font-size: 0.95rem;
  font-weight: 700;
}
.stat-value.muted {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.store-link {
  font-size: 0.82rem;
  color: var(--accent-1);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.store-link:hover {
  text-decoration: underline;
}
.impact-box {
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  padding: 0.85rem;
  background: color-mix(in srgb, var(--accent-1) 2%, transparent);
}
.impact-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.impact-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}
.impact-body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.impact-headline {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}
.impact-note {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-secondary);
}
.impact-note.subtle {
  font-style: italic;
}
.impact-hint {
  margin: 0.6rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.verdict {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 0.4rem;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--text-secondary) 10%, transparent);
}
.verdict.locked {
  color: var(--red-500, #ef4444);
  background: color-mix(in srgb, #ef4444 12%, transparent);
}
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent-1);
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent-1) 45%, transparent);
  border-radius: 0.5rem;
  cursor: pointer;
}
.btn-outline:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-1) 8%, transparent);
}
.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
}
.version-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--accent-1);
  background: color-mix(in srgb, var(--accent-1) 12%, transparent);
}
.version-badge.sm {
  min-width: auto;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.history-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.history-table td {
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}
</style>
