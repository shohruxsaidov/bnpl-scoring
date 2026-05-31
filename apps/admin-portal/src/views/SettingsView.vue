<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import { useToast } from 'primevue/usetoast'
import type { IntegrationEndpoint, PlatformConfigItem } from '@/types'

const toast = useToast()
const { t } = useI18n()

const endpoints = computed<IntegrationEndpoint[]>(() => [
  { label: t('settings.katmBaseUrl'), value: 'https://api.katm.uz/v2', masked: false },
  { label: t('settings.katmTimeout'), value: '8000 ms', masked: false },
  { label: t('settings.myidClientId'), value: 'myid_c_••••••••3f2a', masked: true },
  { label: t('settings.plumgateApiKey'), value: 'plm_••••••••••••••••', masked: true },
  { label: t('settings.paymeMerchantId'), value: '5e8f1c2a9b4d6e7f0a1b2c3d', masked: false },
  { label: t('settings.clickServiceId'), value: 'clk_svc_44219', masked: false },
])

const config = ref<PlatformConfigItem[]>([
  { key: 'otp_expiry', label: t('settings.otpExpiry'), value: 300, unit: 's', numeric: true },
  {
    key: 'max_wizard',
    label: t('settings.maxWizard'),
    value: 5,
    unit: '',
    numeric: true,
  },
  {
    key: 'hard_deny',
    label: t('settings.hardDeny'),
    value: 0.0,
    unit: '',
    numeric: true,
  },
  {
    key: 'partial_limit',
    label: t('settings.partialLimit'),
    value: 0.8,
    unit: '',
    numeric: true,
  },
])

const editingKey = ref<string | null>(null)
const draft = ref<string | number>('')

function startEdit(item: PlatformConfigItem) {
  editingKey.value = item.key
  draft.value = item.value
}

function cancelEdit() {
  editingKey.value = null
}

function saveEdit(item: PlatformConfigItem) {
  item.value = draft.value
  editingKey.value = null
  toast.add({
    severity: 'success',
    summary: t('settings.settingSaved'),
    detail: `${item.label} → ${item.value}${item.unit ? ' ' + item.unit : ''}`,
    life: 2500,
  })
}
</script>

<template>
  <div class="settings">
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.integrationEndpoints') }}</h3>
        <span class="muted">{{ $t('settings.readOnlyInfra') }}</span>
      </header>
      <div class="rows">
        <div v-for="e in endpoints" :key="e.label" class="row">
          <span class="row-label">{{ e.label }}</span>
          <span class="row-value font-mono" :class="{ masked: e.masked }">
            {{ e.value }}
          </span>
          <span v-if="e.masked" class="lock"><i class="pi pi-lock" /></span>
        </div>
      </div>
    </section>

    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.platformConfig') }}</h3>
        <span class="muted">{{ $t('settings.inlineEditable') }}</span>
      </header>
      <div class="rows">
        <div v-for="item in config" :key="item.key" class="row">
          <span class="row-label">{{ item.label }}</span>

          <template v-if="editingKey === item.key">
            <div class="edit-area">
              <InputNumber
                v-if="item.numeric"
                v-model="(draft as number)"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                class="edit-input"
              />
              <InputText v-else v-model="(draft as string)" class="edit-input" />
              <button class="icon-btn ok" :title="$t('settings.save')" @click="saveEdit(item)">
                <i class="pi pi-check" />
              </button>
              <button class="icon-btn" :title="$t('common.cancel')" @click="cancelEdit">
                <i class="pi pi-times" />
              </button>
            </div>
          </template>

          <template v-else>
            <span class="row-value font-mono">
              {{ item.value }}<span v-if="item.unit" class="unit"> {{ item.unit }}</span>
            </span>
            <button class="icon-btn" :title="$t('common.edit')" @click="startEdit(item)">
              <i class="pi pi-pencil" />
            </button>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.rows {
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
  min-height: 56px;
}
.row:last-child {
  border-bottom: none;
}
.row-label {
  flex: 1;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.row-value {
  font-size: 0.86rem;
  font-weight: 700;
  text-align: right;
}
.row-value.masked {
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}
.unit {
  font-size: 0.74rem;
  font-weight: 600;
  opacity: 0.7;
}
.lock {
  color: var(--text-secondary);
  font-size: 0.75rem;
}
.edit-area {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.edit-input {
  width: 140px;
}
.edit-input :deep(.p-inputnumber-input) {
  width: 140px;
  text-align: right;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  transition: all 0.12s ease;
  flex-shrink: 0;
}
.icon-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.icon-btn.ok:hover {
  color: var(--success);
  border-color: var(--success);
}
</style>
