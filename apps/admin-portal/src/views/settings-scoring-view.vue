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
  myid: 'pi pi-id-card',
  katm_mib: 'pi pi-gavel',
  katm_077: 'pi pi-chart-line',
  katm_inps: 'pi pi-wallet',
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
  max-width: 760px;
}
.panel-head {
  margin-bottom: 1.1rem;
}
.pipeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.pipeline-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.75rem;
  transition: opacity 0.12s ease;
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
  background: color-mix(in srgb, #10b981 14%, transparent);
  color: #047857;
}
.tag-source {
  background: color-mix(in srgb, #6366f1 14%, transparent);
  color: #4338ca;
}
.tag-limit {
  background: color-mix(in srgb, #f59e0b 18%, transparent);
  color: #b45309;
}
.tag-default {
  background: color-mix(in srgb, var(--text-secondary) 12%, transparent);
  color: var(--text-secondary);
}
.empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
