<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { useOrganizationStore } from '@/stores/organization'
import { useMerchantsStore } from '@/stores/merchants'

const { locale, t } = useI18n()
const toast = useToast()
const orgStore = useOrganizationStore()
const merchants = useMerchantsStore()

function setLang(lang: 'uz' | 'ru') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

const isDark = ref(false)

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  isDark.value = theme === 'dark'
}

// --- Organization requisites ---------------------------------------------------
const orgForm = ref({
  name: '',
  legalName: '',
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
    f.phone.trim().length > 0 &&
    /^\d{9}$/.test(f.inn) &&
    /^\d{5}$/.test(f.mfo) &&
    /^\d{20}$/.test(f.accountNumber) &&
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
      address: f.address.trim(),
      phone: f.phone.trim(),
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
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
  merchants.fetchBankList()
  const org = orgStore.loaded ? orgStore.organization : await orgStore.fetch().catch(() => null)
  if (org) {
    orgForm.value = {
      name: org.name,
      legalName: org.legalName,
      address: org.address,
      phone: org.phone,
      inn: org.inn,
      mfo: org.mfo,
      accountNumber: org.accountNumber,
      bankName: org.bankName,
    }
  }
})
</script>

<template>
  <div class="settings">
    <section class="surface-card panel org-panel">
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
          <label class="field-label">{{ $t('settings.orgAddress') }}</label>
          <InputText v-model="orgForm.address" :placeholder="$t('settings.orgAddressPlaceholder')" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('settings.orgPhone') }}</label>
            <InputText v-model="orgForm.phone" placeholder="+998 ..." maxlength="20" />
          </div>
          <div class="field">
            <label class="field-label">{{ $t('settings.orgInn') }}</label>
            <InputText v-model="orgForm.inn" placeholder="123456789" maxlength="9" class="font-mono" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('settings.orgMfo') }}</label>
            <InputText v-model="orgForm.mfo" placeholder="00000" maxlength="5" class="font-mono" @input="onMfoInput" />
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
          <InputText v-model="orgForm.accountNumber" placeholder="00000000000000000000" maxlength="20" class="font-mono" />
        </div>
        <div class="org-actions">
          <button class="btn-gradient" :disabled="orgSaving || !orgValid" @click="submitOrganization">
            {{ $t('common.save') }}
          </button>
        </div>
      </div>
    </section>

    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.language') }}</h3>
      </header>
      <div class="option-group">
        <button class="option-btn" :class="{ active: locale === 'uz' }" @click="setLang('uz')">
          <span class="opt-flag">🇺🇿</span>
          <div class="opt-text">
            <span class="opt-name">O'zbek</span>
            <span class="opt-code">uz</span>
          </div>
          <i v-if="locale === 'uz'" class="pi pi-check check-icon" />
        </button>
        <button class="option-btn" :class="{ active: locale === 'ru' }" @click="setLang('ru')">
          <span class="opt-flag">🇷🇺</span>
          <div class="opt-text">
            <span class="opt-name">Русский</span>
            <span class="opt-code">ru</span>
          </div>
          <i v-if="locale === 'ru'" class="pi pi-check check-icon" />
        </button>
      </div>
    </section>

    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.theme') }}</h3>
      </header>
      <div class="option-group">
        <button class="option-btn" :class="{ active: !isDark }" @click="setTheme('light')">
          <i class="pi pi-sun opt-icon" />
          <div class="opt-text">
            <span class="opt-name">{{ $t('settings.themeLight') }}</span>
          </div>
          <i v-if="!isDark" class="pi pi-check check-icon" />
        </button>
        <button class="option-btn" :class="{ active: isDark }" @click="setTheme('dark')">
          <i class="pi pi-moon opt-icon" />
          <div class="opt-text">
            <span class="opt-name">{{ $t('settings.themeDark') }}</span>
          </div>
          <i v-if="isDark" class="pi pi-check check-icon" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
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
.option-group {
  display: flex;
  flex-direction: column;
}
.option-btn {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1.1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  color: var(--text-primary);
}
.option-btn:last-child {
  border-bottom: none;
}
.option-btn:hover {
  background: var(--bg-surface);
}
.option-btn.active {
  background: color-mix(in srgb, var(--accent-1) 8%, transparent);
}
.opt-flag {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}
.opt-icon {
  font-size: 1.1rem;
  color: var(--text-secondary);
  width: 1.4rem;
  text-align: center;
  flex-shrink: 0;
}
.option-btn.active .opt-icon {
  color: var(--accent-1);
}
.opt-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.opt-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.opt-code {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}
.check-icon {
  color: var(--accent-1);
  font-size: 0.85rem;
  flex-shrink: 0;
}
</style>
