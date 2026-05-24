<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { useWizardStore } from '@/stores/wizard'
import { useAuthStore } from '@/stores/auth'
import type { Client } from '@/types'

const wizard = useWizardStore()
const auth = useAuthStore()
const { t } = useI18n()

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.code ?? 'error')
  return data
}

// ── Phase state machine ────────────────────────────────────────────────────
type Phase =
  | 'search'
  | 'searching'
  | 'found'
  | 'not_found'
  | 'myid_pending'
  | 'myid_done'
  | 'katm'

function initialPhase(): Phase {
  if (wizard.sessionData.client) return 'katm'
  return 'search'
}

const phase = ref<Phase>(initialPhase())
const pinfl = ref(wizard.sessionData.client?.pinfl ?? '')
const pinflError = ref('')
const searchError = ref('')

const confirmedClient = ref<Client | null>(wizard.sessionData.client)
const isNewClient = ref(wizard.sessionData.isNewClient)

// MyID
const myidIframeUrl = ref<string | null>(null)
const myidMock = ref(false)
const myidError = ref('')

// Phone (collected for new clients)
const clientPhone = ref('')
const phoneError = ref('')

// KATM
const katmConsent = ref(wizard.sessionData.katmConsent)
const katmLoading = ref(false)
const katmDone = ref(!!wizard.sessionData.katmConsent && !!wizard.sessionData.client)

// ── Helpers ────────────────────────────────────────────────────────────────
function validatePinfl(): boolean {
  if (!/^\d{14}$/.test(pinfl.value)) {
    pinflError.value = t('stepClient.pinflInvalid')
    return false
  }
  pinflError.value = ''
  return true
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const national = digits.startsWith('998') ? digits.slice(3) : digits
  return `+998${national}`
}

// ── Actions ────────────────────────────────────────────────────────────────
async function searchClient() {
  if (!validatePinfl()) return
  searchError.value = ''
  phase.value = 'searching'
  try {
    const data = await apiFetch(`/merchant/client/search?pinfl=${pinfl.value}`)
    confirmedClient.value = data.client as Client
    isNewClient.value = false
    phase.value = 'found'
  } catch (err) {
    const code = (err as Error).message
    if (code === 'client_not_found') {
      phase.value = 'not_found'
    } else {
      searchError.value = t('stepClient.searchFailed')
      phase.value = 'search'
    }
  }
}

function useFoundClient() {
  phase.value = 'katm'
}

async function startMyId() {
  myidError.value = ''
  phase.value = 'myid_pending'
  try {
    const data = await apiFetch('/merchant/client/myid-session', {
      method: 'POST',
      body: JSON.stringify({ pinfl: pinfl.value }),
    })
    myidMock.value = !!data.mock
    myidIframeUrl.value = data.iframeUrl ?? null
    if (!data.mock) listenForMyidMessage()
  } catch {
    myidError.value = t('stepClient.myidFailed')
    phase.value = 'not_found'
  }
}

function listenForMyidMessage() {
  function onMessage(e: MessageEvent) {
    if (typeof e.data !== 'object' || !e.data) return
    const { code } = e.data as { code?: string }
    if (code) {
      window.removeEventListener('message', onMessage)
      completeMyid(code)
    }
  }
  window.addEventListener('message', onMessage)
}

async function completeMyid(myidCode?: string) {
  myidError.value = ''
  phoneError.value = ''
  const phone = normalizePhone(clientPhone.value)
  if (!phone || phone.length < 12) {
    phoneError.value = t('stepClient.phoneRequired')
    return
  }
  try {
    const data = await apiFetch('/merchant/client/myid-complete', {
      method: 'POST',
      body: JSON.stringify({ pinfl: pinfl.value, phone, myidCode: myidCode ?? 'mock' }),
    })
    confirmedClient.value = data.client as Client
    isNewClient.value = true
    phase.value = 'myid_done'
  } catch (err) {
    const code = (err as Error).message
    myidError.value = code === 'pinfl_mismatch' ? t('stepClient.pinflMismatch') : t('stepClient.myidFailed')
    phase.value = 'not_found'
  }
}

function confirmNewClient() {
  phase.value = 'katm'
}

async function queryKatm() {
  if (!katmConsent.value) return
  katmLoading.value = true
  await new Promise((r) => setTimeout(r, 800))
  katmLoading.value = false
  katmDone.value = true
}

function resetSearch() {
  phase.value = 'search'
  confirmedClient.value = null
  isNewClient.value = false
  katmConsent.value = false
  katmDone.value = false
  myidIframeUrl.value = null
  myidMock.value = false
  myidError.value = ''
  clientPhone.value = ''
}

function onNext() {
  if (!confirmedClient.value || !katmDone.value) return
  wizard.setClient(confirmedClient.value, {
    isNew: isNewClient.value,
    myidVerified: isNewClient.value,
  })
  wizard.setKatmConsent(katmConsent.value)
  wizard.complete('client')
}

const canContinue = computed(() => !!confirmedClient.value && katmDone.value)
const clientFullName = computed(() =>
  confirmedClient.value ? `${confirmedClient.value.firstName} ${confirmedClient.value.lastName}` : ''
)
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>{{ $t('stepClient.title') }}</h2>
        <p>{{ $t('stepClient.subtitle') }}</p>
      </div>
      <button v-if="phase !== 'search' && phase !== 'searching'" class="btn-link" @click="resetSearch">
        <i class="pi pi-refresh" /> {{ $t('stepClient.newSearch') }}
      </button>
    </header>

    <!-- ── PHASE: search ─────────────────────────────────────────────────── -->
    <div v-if="phase === 'search' || phase === 'searching'" class="search-box">
      <label class="field-label">{{ $t('stepClient.clientPinfl') }}</label>
      <div class="search-row">
        <InputText
          v-model="pinfl"
          maxlength="14"
          placeholder="31203016740099"
          class="font-mono pinfl-input"
          :invalid="!!pinflError"
          :disabled="phase === 'searching'"
          @keydown.enter="searchClient"
        />
        <button class="btn-gradient" :disabled="phase === 'searching'" @click="searchClient">
          <i v-if="phase === 'searching'" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-search" />
          {{ phase === 'searching' ? $t('stepClient.searching') : $t('stepClient.search') }}
        </button>
      </div>
      <span v-if="pinflError" class="field-error">{{ pinflError }}</span>
      <span v-if="searchError" class="field-error">{{ searchError }}</span>
      <p class="search-hint">
        {{ $t('stepClient.searchHint') }}
      </p>
    </div>

    <!-- ── PHASE: found ──────────────────────────────────────────────────── -->
    <div v-else-if="phase === 'found'" class="client-card found">
      <div class="client-card-header">
        <span class="tag tag-success"><i class="pi pi-check-circle" /> {{ $t('stepClient.existingFound') }}</span>
      </div>
      <div class="client-grid">
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.fullName') }}</span>
          <span class="cf-value">{{ clientFullName }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.pinfl') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.pinfl }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.phone') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.phone }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.passport') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.passportSerial }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.birthDate') }}</span>
          <span class="cf-value">{{ confirmedClient!.birthDate }}</span>
        </div>
      </div>
      <button class="btn-gradient mt-1" @click="useFoundClient">
        {{ $t('stepClient.useClient') }} <i class="pi pi-arrow-right" />
      </button>
    </div>

    <!-- ── PHASE: not_found ──────────────────────────────────────────────── -->
    <div v-else-if="phase === 'not_found'" class="not-found-box">
      <div class="nf-icon"><i class="pi pi-user-minus" /></div>
      <div>
        <p class="nf-title">{{ $t('stepClient.noClientFound', { pinfl }) }}</p>
        <p class="nf-sub">{{ $t('stepClient.noClientSub') }}</p>
      </div>
      <button class="btn-myid" @click="startMyId">
        <span class="myid-logo">MyID</span>
        {{ $t('stepClient.startVerification') }}
      </button>
    </div>

    <!-- ── PHASE: myid_pending ───────────────────────────────────────────── -->
    <div v-else-if="phase === 'myid_pending'" class="myid-panel">
      <div class="myid-header">
        <span class="myid-logo-lg">MyID</span>
        <span class="myid-title">{{ $t('stepClient.identityVerification') }}</span>
      </div>

      <!-- Phone field (agent enters client's phone while client does MyID) -->
      <div class="field mb-1">
        <label class="field-label">{{ $t('stepClient.clientPhone') }}</label>
        <div class="phone-row">
          <span class="phone-prefix">+998</span>
          <InputText
            v-model="clientPhone"
            inputmode="numeric"
            placeholder="91 555 22 33"
            class="phone-field-input"
            :invalid="!!phoneError"
            @input="phoneError = ''"
          />
        </div>
        <span v-if="phoneError" class="field-error">{{ phoneError }}</span>
      </div>

      <span v-if="myidError" class="field-error mb-1">{{ myidError }}</span>

      <!-- Real MyID iframe -->
      <iframe
        v-if="!myidMock && myidIframeUrl"
        :src="myidIframeUrl"
        class="myid-frame"
        allow="camera"
      />

      <!-- Mock mode button -->
      <button
        v-if="myidMock"
        class="btn-gradient mt-1"
        @click="completeMyid()"
      >
        <i class="pi pi-id-card" />
        {{ $t('stepClient.startVerification') }} (mock)
      </button>
    </div>

    <!-- ── PHASE: myid_done ──────────────────────────────────────────────── -->
    <div v-else-if="phase === 'myid_done'" class="client-card new">
      <div class="client-card-header">
        <span class="tag tag-accent"><i class="pi pi-id-card" /> {{ $t('stepClient.newClientVerified') }}</span>
      </div>
      <div class="client-grid">
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.fullName') }}</span>
          <span class="cf-value">{{ clientFullName }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.pinfl') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.pinfl }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.phone') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.phone }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.passport') }}</span>
          <span class="cf-value font-mono">{{ confirmedClient!.passportSerial }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">{{ $t('stepClient.birthDate') }}</span>
          <span class="cf-value">{{ confirmedClient!.birthDate }}</span>
        </div>
      </div>
      <button class="btn-gradient mt-1" @click="confirmNewClient">
        {{ $t('stepClient.confirmContinue') }} <i class="pi pi-arrow-right" />
      </button>
    </div>

    <!-- ── PHASE: katm (KATM consent + query) ───────────────────────────── -->
    <template v-if="phase === 'katm'">
      <!-- Compact client banner -->
      <div class="client-banner">
        <i class="pi pi-user" />
        <span>
          <strong>{{ clientFullName }}</strong>
          <span class="font-mono ml-1 text-secondary">{{ confirmedClient!.pinfl }}</span>
        </span>
        <span v-if="isNewClient" class="tag tag-accent tag-sm">{{ $t('stepClient.newMyidVerified') }}</span>
        <span v-else class="tag tag-success tag-sm">{{ $t('stepClient.existingClient') }}</span>
      </div>

      <div class="katm-box">
        <label class="consent">
          <Checkbox v-model="katmConsent" binary />
          <span>{{ $t('stepClient.katmConsent', { katm: $t('stepClient.katmConsentBold') }) }}</span>
        </label>
        <button
          class="btn-ghost"
          :disabled="!katmConsent || katmLoading || katmDone"
          @click="queryKatm"
        >
          <i v-if="katmLoading" class="pi pi-spin pi-spinner" />
          <i v-else-if="katmDone" class="pi pi-check" />
          <i v-else class="pi pi-database" />
          {{ katmLoading ? $t('stepClient.queryingKatm') : katmDone ? $t('stepClient.katmDone') : $t('stepClient.queryKatm') }}
        </button>
      </div>

      <transition name="fade">
        <div v-if="katmDone" class="katm-result">
          <i class="pi pi-check-circle" />
          {{ $t('stepClient.katmResult') }}
        </div>
      </transition>
    </template>

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer class="sc-foot">
      <span class="hint">{{ $t('stepClient.stepOf') }}</span>
      <button class="btn-gradient" :disabled="!canContinue" @click="onNext">
        {{ $t('common.continue') }} <i class="pi pi-arrow-right" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card { padding: 2rem; }

.sc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.sc-head h2 { margin: 0; font-size: 1.4rem; font-weight: 800; }
.sc-head p { margin: 0.3rem 0 0; color: var(--text-secondary); font-size: 0.88rem; }

/* ── Search ── */
.search-box { margin: 1.8rem 0; }
.search-row { display: flex; gap: 0.8rem; margin-top: 0.5rem; }
.pinfl-input { flex: 1; font-size: 1.05rem; letter-spacing: 0.06em; }
.search-hint { margin-top: 0.8rem; font-size: 0.84rem; color: var(--text-secondary); }

/* ── Client card (found / myid_done) ── */
.client-card {
  margin: 1.8rem 0;
  border-radius: 16px;
  padding: 1.4rem;
  border: 1.5px solid transparent;
}
.client-card.found {
  background: var(--success-bg);
  border-color: var(--success);
}
.client-card.new {
  background: var(--bg-surface);
  border-color: var(--accent-1);
}
.client-card-header { margin-bottom: 1.1rem; }

.client-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1.4rem;
}
.client-field { display: flex; flex-direction: column; gap: 0.2rem; }
.cf-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.cf-value { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
.mt-1 { margin-top: 1.2rem; }

/* ── Not found ── */
.not-found-box {
  margin: 1.8rem 0;
  background: var(--warning-bg);
  border: 1.5px solid var(--warning);
  border-radius: 16px;
  padding: 1.4rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.nf-icon { font-size: 2rem; color: var(--warning); }
.nf-title { margin: 0; font-weight: 700; font-size: 0.95rem; }
.nf-sub { margin: 0.3rem 0 0; font-size: 0.85rem; color: var(--text-secondary); }

.btn-myid {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  background: var(--gradient-hero);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.7rem 1.3rem;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  align-self: flex-start;
  box-shadow: var(--accent-glow);
  transition: opacity 0.2s;
}
.btn-myid:hover { opacity: 0.88; }
.myid-logo {
  background: #fff;
  color: var(--accent-1);
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

/* ── MyID panel ── */
.myid-panel {
  margin: 1.8rem 0;
  background: var(--bg-surface);
  border: 1.5px solid var(--accent-1);
  border-radius: 16px;
  padding: 1.6rem;
  box-shadow: var(--accent-glow);
}
.myid-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 1.2rem;
}
.myid-logo-lg {
  background: var(--gradient-hero);
  color: #fff;
  padding: 0.3rem 0.8rem;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}
.myid-title { font-weight: 700; font-size: 1rem; }
.myid-frame {
  width: 100%;
  height: 440px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  margin-top: 0.8rem;
}
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.field-error { font-size: 0.8rem; color: var(--danger); }
.phone-row { display: flex; align-items: center; gap: 0; border: 1px solid var(--border-subtle); border-radius: 10px; overflow: hidden; }
.phone-prefix { padding: 0.65rem 0.6rem 0.65rem 0.9rem; font-size: 0.9rem; font-weight: 700; color: var(--text-secondary); border-right: 1px solid var(--border-subtle); white-space: nowrap; }
.phone-field-input { flex: 1; border: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 0.65rem 0.9rem; }
.mb-1 { margin-bottom: 0.8rem; }

/* ── Client banner (katm phase) ── */
.client-banner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin: 1.8rem 0 1.2rem;
  background: var(--bg-surface);
  padding: 0.9rem 1.2rem;
  border-radius: 12px;
  font-size: 0.9rem;
  flex-wrap: wrap;
}
.client-banner i { color: var(--accent-1); font-size: 1.1rem; }
.text-secondary { color: var(--text-secondary); }
.ml-1 { margin-left: 0.3rem; }

/* ── KATM ── */
.katm-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--bg-surface);
  padding: 1.1rem 1.3rem;
  border-radius: 14px;
}
.consent { display: flex; align-items: center; gap: 0.7rem; font-size: 0.88rem; cursor: pointer; }
.btn-ghost { display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap; }

.katm-result {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--success);
  background: var(--success-bg);
  padding: 0.8rem 1.1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.86rem;
}

/* ── Tags ── */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}
.tag-success { background: var(--success-bg); color: var(--success); }
.tag-accent { background: var(--bg-surface); color: var(--accent-1); border: 1px solid var(--accent-1); }
.tag-sm { font-size: 0.72rem; padding: 0.2rem 0.6rem; }

/* ── Footer ── */
.sc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}
.hint { color: var(--text-secondary); font-size: 0.82rem; font-weight: 600; }
.btn-gradient { display: inline-flex; align-items: center; gap: 0.5rem; }
.btn-gradient:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-link {
  background: none;
  border: none;
  color: var(--accent-1);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  padding: 0;
}
.btn-link:hover { text-decoration: underline; }

/* ── Transition ── */
.fade-enter-active { transition: opacity 0.3s ease; }
.fade-enter-from { opacity: 0; }
</style>
