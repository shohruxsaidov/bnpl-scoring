<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import InputMask from 'primevue/inputmask'
import { useToast } from 'primevue/usetoast'
import { useOrganizationStore } from '@/stores/organization'
import { useMerchantsStore } from '@/stores/merchants'

const { t } = useI18n()
const toast = useToast()
const orgStore = useOrganizationStore()
const merchants = useMerchantsStore()

const orgForm = ref({
  name: '',
  legalName: '',
  directorName: '',
  address: '',
  phone: '',
  inn: '',
  mfo: '',
  accountNumber: '',
  bankName: '',
})
const orgSaving = ref(false)

function onMfoInput() {
  const mfo = orgForm.value.mfo.trim()
  if (!/^\d{5}$/.test(mfo)) {
    orgForm.value.bankName = ''
    return
  }
  const found = merchants.bankList.find((b) => b.mfo === mfo)
  orgForm.value.bankName = found?.bankName ?? ''
}

const orgValid = computed(() => {
  const f = orgForm.value
  return (
    f.name.trim().length > 0 &&
    f.legalName.trim().length > 0 &&
    f.address.trim().length > 0 &&
    f.phone.length > 0 && !f.phone.includes('_') &&
    /^\d{9}$/.test(f.inn) && !f.inn.includes('_') &&
    /^\d{5}$/.test(f.mfo) && !f.mfo.includes('_') &&
    /^\d{20}$/.test(f.accountNumber) && !f.accountNumber.includes('_') &&
    f.bankName.length > 0
  )
})

async function submitOrganization() {
  if (!orgValid.value) return
  orgSaving.value = true
  try {
    const f = orgForm.value
    await orgStore.save({
      name: f.name.trim(),
      legalName: f.legalName.trim(),
      directorName: f.directorName.trim() || null,
      address: f.address.trim(),
      phone: '998' + f.phone.replace(/\D/g, ''),
      inn: f.inn,
      mfo: f.mfo,
      accountNumber: f.accountNumber,
      bankName: f.bankName,
    })
    toast.add({ severity: 'success', summary: t('settings.orgSaved'), life: 2000 })
  } catch {
    toast.add({ severity: 'error', summary: t('settings.orgSaveFailed'), life: 3000 })
  } finally {
    orgSaving.value = false
  }
}

onMounted(async () => {
  merchants.fetchBankList()
  const org = orgStore.loaded ? orgStore.organization : await orgStore.fetch().catch(() => null)
  if (org) {
    orgForm.value = {
      name: org.name,
      legalName: org.legalName,
      directorName: org.directorName ?? '',
      address: org.address,
      phone: org.phone.replace(/^998/, ''),
      inn: org.inn,
      mfo: org.mfo,
      accountNumber: org.accountNumber,
      bankName: org.bankName,
    }
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
        <h3 class="section-title">{{ $t('settings.organization') }}</h3>
        <p class="section-hint">{{ $t('settings.organizationHint') }}</p>
      </header>
      <div class="org-form">
        <div class="field">
          <label class="field-label">{{ $t('settings.orgName') }}</label>
          <InputText v-model="orgForm.name" :placeholder="$t('settings.orgNamePlaceholder')" maxlength="200" />
        </div>
        <div class="field">
          <label class="field-label">{{ $t('settings.orgLegalName') }}</label>
          <InputText v-model="orgForm.legalName" :placeholder="$t('settings.orgLegalNamePlaceholder')" maxlength="200" />
        </div>
        <div class="field">
          <label class="field-label">{{ $t('settings.orgDirectorName') }}</label>
          <InputText v-model="orgForm.directorName" :placeholder="$t('settings.orgDirectorNamePlaceholder')"
            maxlength="200" />
        </div>
        <div class="field">
          <label class="field-label">{{ $t('settings.orgAddress') }}</label>
          <InputText v-model="orgForm.address" :placeholder="$t('settings.orgAddressPlaceholder')" />
        </div>
        <div class="field-row">
          <div class="field phone-field">
            <label class="field-label">{{ $t('settings.orgPhone') }}</label>
            <span class="p-inputgroup-addon">+998</span>
            <InputMask v-model="orgForm.phone" mask="999999999" placeholder="000000000" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('settings.orgInn') }}</label>
            <InputMask v-model="orgForm.inn" mask="999999999" placeholder="000000000" class="font-mono" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('settings.orgMfo') }}</label>
            <InputMask v-model="orgForm.mfo" mask="99999" placeholder="00000" class="font-mono" @input="onMfoInput" />
            <span v-if="orgForm.mfo.length === 5 && !orgForm.bankName" class="field-error">
              {{ $t('settings.bankNotFound') }}
            </span>
          </div>
          <div class="field">
            <label class="field-label">{{ $t('settings.orgBankName') }}</label>
            <InputText :model-value="orgForm.bankName" disabled />
          </div>
        </div>
        <div class="field">
          <label class="field-label">{{ $t('settings.orgAccountNumber') }}</label>
          <InputMask v-model="orgForm.accountNumber" mask="99999999999999999999" placeholder="00000000000000000000" class="font-mono" />
        </div>
        <div class="org-actions">
          <button class="btn-gradient" :disabled="orgSaving || !orgValid" @click="submitOrganization">
            {{ $t('common.save') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
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
.section-hint {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.org-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1.1rem 1.1rem;
}
.org-form :deep(.p-inputtext) {
  width: 100%;
}
.field {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.phone-field {
  position: relative;
}
.p-inputgroup-addon {
  color: var(--text-secondary);
  position: absolute;
  left: 10px;
  top: 26px;
  height: 40px;
  pointer-events: none;
  display: flex;
  align-items: center;
}
.phone-field :deep(.p-inputtext) {
  padding-left: 3.25rem;
}
.field-row {
  display: flex;
  gap: 0.85rem;
}
.org-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
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
</style>
