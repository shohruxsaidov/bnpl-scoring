<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useScoringSettingsStore } from '@/stores/scoring-settings'
import type { ConfigurablePipeline, PipelineSetting } from '@/types'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const store = useScoringSettingsStore()

const loading = ref(true)
// Per-pipeline, so one in-flight PUT doesn't freeze the whole list.
const saving = ref<Record<string, boolean>>({})

const ICONS: Record<ConfigurablePipeline, string> = {
  active_deal: 'pi pi-file-check',
  myid: 'pi pi-id-card',
  katm_mib: 'pi pi-building-columns',
  katm_077: 'pi pi-chart-line',
  katm_inps: 'pi pi-wallet',
  plum_card: 'pi pi-credit-card',
}

// A pipeline that supplies no scoring params is a pure gate: turning it off
// costs zero score and only removes its knockouts.
function isGate(p: PipelineSetting): boolean {
  return p.scoringParams.length === 0 && !p.feedsLimit
}

async function apply(p: PipelineSetting, enabled: boolean) {
  saving.value = { ...saving.value, [p.type]: true }
  try {
    await store.setEnabled(p.type, enabled)
    toast.add({
      severity: 'success',
      summary: t(enabled ? 'scoringSettings.enabled' : 'scoringSettings.disabled', {
        name: t(`scoringSettings.pipeline.${p.type}.name`),
      }),
      life: 2000,
    })
  } catch {
    toast.add({ severity: 'error', summary: t('scoringSettings.saveFailed'), life: 3000 })
  } finally {
    saving.value = { ...saving.value, [p.type]: false }
  }
}

function onToggle(p: PipelineSetting, next: boolean) {
  // Enabling MIB is the one dangerous *enable*: MIB_REJECT_CODES is empty, so any
  // response other than 204 puts the scoring run into `error`.
  if (next && p.type === 'katm_mib') {
    confirm.require({
      header: t('scoringSettings.mibEnableTitle'),
      message: t('scoringSettings.mibEnableMsg'),
      icon: 'pi pi-exclamation-triangle',
      rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
      acceptProps: { label: t('scoringSettings.enableAnyway'), severity: 'danger' },
      accept: () => apply(p, true),
    })
    return
  }

  // Re-enabling anything else only restores a check — no confirmation needed.
  if (next) {
    void apply(p, true)
    return
  }

  confirm.require({
    header: t('scoringSettings.disableTitle', {
      name: t(`scoringSettings.pipeline.${p.type}.name`),
    }),
    message: isGate(p)
      ? t('scoringSettings.disableGateMsg')
      : t('scoringSettings.disableSourceMsg'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('scoringSettings.disable'), severity: 'danger' },
    accept: () => apply(p, false),
  })
}

onMounted(async () => {
  try {
    await store.fetch()
  } catch {
    toast.add({ severity: 'error', summary: t('scoringSettings.loadFailed'), life: 3000 })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="settings-page">
    <router-link class="back-link" :to="{ name: 'settings' }">
      <i class="pi pi-arrow-left" />
      {{ $t('settings.backToSettings') }}
    </router-link>

    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('scoringSettings.title') }}</h3>
        <p class="section-hint">{{ $t('scoringSettings.hint') }}</p>
      </header>

      <p v-if="loading" class="empty">{{ $t('common.loading') }}</p>

      <ul v-else class="pipeline-list">
        <li v-for="p in store.pipelines" :key="p.type" class="pipeline-row" :class="{ off: !p.enabled }">
          <div class="pipeline-icon">
            <i :class="ICONS[p.type]" />
          </div>

          <div class="pipeline-text">
            <div class="pipeline-title-row">
              <span class="pipeline-title">{{ $t(`scoringSettings.pipeline.${p.type}.name`) }}</span>
              <span v-if="isGate(p)" class="tag tag-gate">{{ $t('scoringSettings.tagGate') }}</span>
              <span v-else class="tag tag-source">
                {{ $t('scoringSettings.tagParams', { count: p.scoringParams.length }) }}
              </span>
              <span v-if="p.feedsLimit" class="tag tag-limit">{{ $t('scoringSettings.tagLimit') }}</span>
              <span v-if="p.isDefault" class="tag tag-default">{{ $t('scoringSettings.tagDefault') }}</span>
            </div>

            <span class="pipeline-desc">{{ $t(`scoringSettings.pipeline.${p.type}.desc`) }}</span>

            <span v-if="p.stopFactors.length" class="pipeline-note">
              <i class="pi pi-shield" />
              {{ $t('scoringSettings.suppliesStopFactors', { list: p.stopFactors.join(', ') }) }}
            </span>
          </div>

          <ToggleSwitch
            :model-value="p.enabled"
            :disabled="saving[p.type]"
            @update:model-value="(v: boolean) => onToggle(p, v)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 760px;
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
.pipeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.pipeline-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
  transition: opacity 0.12s ease;
}
.pipeline-row:last-child {
  border-bottom: none;
}
.pipeline-row.off {
  opacity: 0.62;
}
.pipeline-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  flex-shrink: 0;
}
.pipeline-icon .pi {
  font-size: 1.05rem;
  color: var(--accent-1);
}
.pipeline-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.pipeline-title-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.pipeline-title {
  font-weight: 700;
  font-size: 0.92rem;
}
.pipeline-desc {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.pipeline-note {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  color: var(--text-secondary);
}
.tag {
  font-size: 0.66rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  white-space: nowrap;
}
.tag-gate {
  background: var(--success-bg);
  color: var(--success);
}
.tag-source {
  background: color-mix(in srgb, var(--accent-1) 16%, transparent);
  color: var(--text-accent);
}
.tag-limit {
  background: var(--warning-bg);
  color: var(--warning);
}
.tag-default {
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  color: var(--text-secondary);
}
.empty {
  margin: 0;
  padding: 1rem 1.1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
