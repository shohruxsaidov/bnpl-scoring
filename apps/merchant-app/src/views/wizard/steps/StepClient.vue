<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import { useWizardStore } from '@/stores/wizard'
import { mockDelay } from '@/utils/money'
import type { Client } from '@/types'

const wizard = useWizardStore()

// ── Mock client database (existing clients in the system) ──────────────────
const MOCK_DB: Client[] = [
  {
    pinfl: '31203016740011',
    fullName: 'Jasur Rahimov',
    phone: '+998 91 234 56 78',
    passportSerial: 'AB1234567',
    birthDate: '1988-03-21',
  },
  {
    pinfl: '52109026740022',
    fullName: 'Madina Sobirova',
    phone: '+998 90 345 67 89',
    passportSerial: 'CD2345678',
    birthDate: '1995-09-10',
  },
  {
    pinfl: '30501996740033',
    fullName: 'Bekzod Aliyev',
    phone: '+998 93 456 78 90',
    passportSerial: 'EF3456789',
    birthDate: '1990-05-30',
  },
]

// MyID returns verified identity for unknown PINFLs
const MYID_IDENTITY: Omit<Client, 'pinfl'> = {
  fullName: 'Akmal Tursunov',
  passportSerial: 'GH9876543',
  birthDate: '1994-08-15',
  phone: '+998 93 777 88 99',
}

// ── Phase state machine ────────────────────────────────────────────────────
type Phase =
  | 'search'        // initial: enter PINFL
  | 'searching'     // mock search in progress
  | 'found'         // existing client found
  | 'not_found'     // PINFL not in system
  | 'myid_pending'  // MyID verification in progress
  | 'myid_done'     // MyID verified, new client created
  | 'katm'          // client confirmed (found or new), KATM section active

// Restore state if wizard session already has a client (going back)
function initialPhase(): Phase {
  if (wizard.sessionData.client) return 'katm'
  return 'search'
}

const phase = ref<Phase>(initialPhase())
const pinfl = ref(wizard.sessionData.client?.pinfl ?? '')
const pinflError = ref('')
const searching = ref(false)

const confirmedClient = ref<Client | null>(wizard.sessionData.client)
const isNewClient = ref(wizard.sessionData.isNewClient)

// MyID progress sub-phase
type MyIdPhase = 'waiting' | 'biometric' | 'done'
const myidPhase = ref<MyIdPhase>('waiting')

// KATM
const katmConsent = ref(wizard.sessionData.katmConsent)
const katmLoading = ref(false)
const katmDone = ref(!!wizard.sessionData.katmConsent && !!wizard.sessionData.client)

// ── Actions ────────────────────────────────────────────────────────────────
function validatePinfl(): boolean {
  if (!/^\d{14}$/.test(pinfl.value)) {
    pinflError.value = 'PINFL must be exactly 14 digits'
    return false
  }
  pinflError.value = ''
  return true
}

async function searchClient() {
  if (!validatePinfl()) return
  phase.value = 'searching'
  searching.value = true

  await mockDelay(null, 1200)

  const existing = MOCK_DB.find((c) => c.pinfl === pinfl.value)
  searching.value = false

  if (existing) {
    confirmedClient.value = existing
    isNewClient.value = false
    phase.value = 'found'
  } else {
    phase.value = 'not_found'
  }
}

function useFoundClient() {
  phase.value = 'katm'
}

async function startMyId() {
  phase.value = 'myid_pending'
  myidPhase.value = 'waiting'
  await mockDelay(null, 2000)
  myidPhase.value = 'biometric'
  await mockDelay(null, 1800)
  myidPhase.value = 'done'

  const newClient: Client = { pinfl: pinfl.value, ...MYID_IDENTITY }
  confirmedClient.value = newClient
  isNewClient.value = true
  phase.value = 'myid_done'
}

function confirmNewClient() {
  phase.value = 'katm'
}

async function queryKatm() {
  if (!katmConsent.value) return
  katmLoading.value = true
  await mockDelay(null, 1500)
  katmLoading.value = false
  katmDone.value = true
}

function resetSearch() {
  phase.value = 'search'
  confirmedClient.value = null
  isNewClient.value = false
  katmConsent.value = false
  katmDone.value = false
  myidPhase.value = 'waiting'
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

const canContinue = computed(
  () => !!confirmedClient.value && katmDone.value,
)

const myidStatusText = computed(() => {
  if (myidPhase.value === 'waiting') return 'Waiting for client to open MyID app…'
  if (myidPhase.value === 'biometric') return 'Biometric check in progress…'
  return 'Identity verified'
})
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>Клиент</h2>
        <p>Search for an existing client or create one via MyID identity verification.</p>
      </div>
      <button v-if="phase !== 'search' && phase !== 'searching'" class="btn-link" @click="resetSearch">
        <i class="pi pi-refresh" /> New search
      </button>
    </header>

    <!-- ── PHASE: search ─────────────────────────────────────────────────── -->
    <div v-if="phase === 'search' || phase === 'searching'" class="search-box">
      <label class="field-label">Client PINFL</label>
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
          {{ phase === 'searching' ? 'Searching…' : 'Search' }}
        </button>
      </div>
      <span v-if="pinflError" class="field-error">{{ pinflError }}</span>
      <p class="search-hint">
        Enter the 14-digit PINFL. If the client exists we'll load their record instantly.
        If not, you'll verify their identity via <strong>MyID</strong>.
      </p>
    </div>

    <!-- ── PHASE: found ──────────────────────────────────────────────────── -->
    <div v-else-if="phase === 'found'" class="client-card found">
      <div class="client-card-header">
        <span class="tag tag-success"><i class="pi pi-check-circle" /> Existing client found</span>
      </div>
      <div class="client-grid">
        <div class="client-field">
          <span class="cf-label">Full name</span>
          <span class="cf-value">{{ confirmedClient!.fullName }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">PINFL</span>
          <span class="cf-value font-mono">{{ confirmedClient!.pinfl }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Phone</span>
          <span class="cf-value font-mono">{{ confirmedClient!.phone }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Passport</span>
          <span class="cf-value font-mono">{{ confirmedClient!.passportSerial }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Date of birth</span>
          <span class="cf-value">{{ confirmedClient!.birthDate }}</span>
        </div>
      </div>
      <button class="btn-gradient mt-1" @click="useFoundClient">
        Use this client <i class="pi pi-arrow-right" />
      </button>
    </div>

    <!-- ── PHASE: not_found ──────────────────────────────────────────────── -->
    <div v-else-if="phase === 'not_found'" class="not-found-box">
      <div class="nf-icon"><i class="pi pi-user-minus" /></div>
      <div>
        <p class="nf-title">No client found for PINFL <span class="font-mono">{{ pinfl }}</span></p>
        <p class="nf-sub">To create a new client record, verify their identity through the <strong>MyID</strong> biometric system.</p>
      </div>
      <button class="btn-myid" @click="startMyId">
        <span class="myid-logo">MyID</span>
        Start identity verification
      </button>
    </div>

    <!-- ── PHASE: myid_pending ───────────────────────────────────────────── -->
    <div v-else-if="phase === 'myid_pending'" class="myid-panel">
      <div class="myid-header">
        <span class="myid-logo-lg">MyID</span>
        <span class="myid-title">Identity Verification</span>
      </div>

      <div class="myid-body">
        <!-- Fake QR code -->
        <div class="qr-wrap" :class="{ 'qr-done': myidPhase === 'done' }">
          <svg viewBox="0 0 21 21" width="140" height="140" class="qr-svg">
            <!-- top-left finder -->
            <rect x="0" y="0" width="7" height="7" rx="1" fill="currentColor"/>
            <rect x="1" y="1" width="5" height="5" rx="0.5" fill="var(--bg-surface)"/>
            <rect x="2" y="2" width="3" height="3" fill="currentColor"/>
            <!-- top-right finder -->
            <rect x="14" y="0" width="7" height="7" rx="1" fill="currentColor"/>
            <rect x="15" y="1" width="5" height="5" rx="0.5" fill="var(--bg-surface)"/>
            <rect x="16" y="2" width="3" height="3" fill="currentColor"/>
            <!-- bottom-left finder -->
            <rect x="0" y="14" width="7" height="7" rx="1" fill="currentColor"/>
            <rect x="1" y="15" width="5" height="5" rx="0.5" fill="var(--bg-surface)"/>
            <rect x="2" y="16" width="3" height="3" fill="currentColor"/>
            <!-- data modules (random-ish pattern) -->
            <rect x="8" y="0" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="0" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="0" width="1" height="1" fill="currentColor"/>
            <rect x="9" y="1" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="1" width="1" height="1" fill="currentColor"/>
            <rect x="8" y="2" width="2" height="1" fill="currentColor"/>
            <rect x="11" y="2" width="2" height="1" fill="currentColor"/>
            <rect x="9" y="3" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="3" width="1" height="1" fill="currentColor"/>
            <rect x="8" y="4" width="1" height="1" fill="currentColor"/>
            <rect x="10" y="4" width="2" height="1" fill="currentColor"/>
            <rect x="8" y="5" width="3" height="1" fill="currentColor"/>
            <rect x="12" y="5" width="1" height="1" fill="currentColor"/>
            <rect x="9" y="6" width="2" height="1" fill="currentColor"/>
            <rect x="0" y="8" width="1" height="1" fill="currentColor"/>
            <rect x="2" y="8" width="3" height="1" fill="currentColor"/>
            <rect x="7" y="8" width="2" height="1" fill="currentColor"/>
            <rect x="10" y="8" width="1" height="1" fill="currentColor"/>
            <rect x="12" y="8" width="3" height="1" fill="currentColor"/>
            <rect x="16" y="8" width="2" height="1" fill="currentColor"/>
            <rect x="19" y="8" width="2" height="1" fill="currentColor"/>
            <rect x="1" y="9" width="2" height="1" fill="currentColor"/>
            <rect x="5" y="9" width="2" height="1" fill="currentColor"/>
            <rect x="9" y="9" width="3" height="1" fill="currentColor"/>
            <rect x="14" y="9" width="2" height="1" fill="currentColor"/>
            <rect x="18" y="9" width="3" height="1" fill="currentColor"/>
            <rect x="0" y="10" width="3" height="1" fill="currentColor"/>
            <rect x="4" y="10" width="1" height="1" fill="currentColor"/>
            <rect x="7" y="10" width="4" height="1" fill="currentColor"/>
            <rect x="13" y="10" width="1" height="1" fill="currentColor"/>
            <rect x="16" y="10" width="3" height="1" fill="currentColor"/>
            <rect x="1" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="3" y="11" width="3" height="1" fill="currentColor"/>
            <rect x="8" y="11" width="2" height="1" fill="currentColor"/>
            <rect x="12" y="11" width="2" height="1" fill="currentColor"/>
            <rect x="15" y="11" width="1" height="1" fill="currentColor"/>
            <rect x="18" y="11" width="2" height="1" fill="currentColor"/>
            <rect x="0" y="12" width="2" height="1" fill="currentColor"/>
            <rect x="4" y="12" width="2" height="1" fill="currentColor"/>
            <rect x="7" y="12" width="1" height="1" fill="currentColor"/>
            <rect x="9" y="12" width="3" height="1" fill="currentColor"/>
            <rect x="14" y="12" width="3" height="1" fill="currentColor"/>
            <rect x="19" y="12" width="2" height="1" fill="currentColor"/>
            <rect x="8" y="14" width="2" height="1" fill="currentColor"/>
            <rect x="11" y="14" width="1" height="1" fill="currentColor"/>
            <rect x="14" y="14" width="2" height="1" fill="currentColor"/>
            <rect x="18" y="14" width="3" height="1" fill="currentColor"/>
            <rect x="9" y="15" width="3" height="1" fill="currentColor"/>
            <rect x="13" y="15" width="1" height="1" fill="currentColor"/>
            <rect x="16" y="15" width="2" height="1" fill="currentColor"/>
            <rect x="8" y="16" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="16" width="2" height="1" fill="currentColor"/>
            <rect x="15" y="16" width="3" height="1" fill="currentColor"/>
            <rect x="19" y="16" width="2" height="1" fill="currentColor"/>
            <rect x="9" y="17" width="2" height="1" fill="currentColor"/>
            <rect x="12" y="17" width="3" height="1" fill="currentColor"/>
            <rect x="17" y="17" width="2" height="1" fill="currentColor"/>
            <rect x="8" y="18" width="3" height="1" fill="currentColor"/>
            <rect x="13" y="18" width="1" height="1" fill="currentColor"/>
            <rect x="16" y="18" width="4" height="1" fill="currentColor"/>
            <rect x="9" y="19" width="1" height="1" fill="currentColor"/>
            <rect x="11" y="19" width="3" height="1" fill="currentColor"/>
            <rect x="15" y="19" width="2" height="1" fill="currentColor"/>
            <rect x="19" y="19" width="2" height="1" fill="currentColor"/>
            <rect x="8" y="20" width="2" height="1" fill="currentColor"/>
            <rect x="12" y="20" width="2" height="1" fill="currentColor"/>
            <rect x="17" y="20" width="3" height="1" fill="currentColor"/>
          </svg>
          <div v-if="myidPhase === 'done'" class="qr-overlay">
            <i class="pi pi-check" />
          </div>
        </div>

        <!-- Steps -->
        <div class="myid-steps">
          <div
            v-for="(step, idx) in [
              { label: 'Open MyID app', phase: 'waiting' },
              { label: 'Biometric check', phase: 'biometric' },
              { label: 'Identity confirmed', phase: 'done' },
            ]"
            :key="idx"
            class="myid-step"
            :class="{
              active: myidPhase === step.phase,
              done: ['waiting','biometric','done'].indexOf(myidPhase) > idx,
            }"
          >
            <span class="step-dot">
              <i v-if="['waiting','biometric','done'].indexOf(myidPhase) > idx" class="pi pi-check" />
              <i v-else-if="myidPhase === step.phase" class="pi pi-spin pi-spinner" />
              <span v-else>{{ idx + 1 }}</span>
            </span>
            <span class="step-label">{{ step.label }}</span>
          </div>
        </div>
      </div>

      <p class="myid-status">{{ myidStatusText }}</p>
    </div>

    <!-- ── PHASE: myid_done ──────────────────────────────────────────────── -->
    <div v-else-if="phase === 'myid_done'" class="client-card new">
      <div class="client-card-header">
        <span class="tag tag-accent"><i class="pi pi-id-card" /> New client — identity verified via MyID</span>
      </div>
      <div class="client-grid">
        <div class="client-field">
          <span class="cf-label">Full name</span>
          <span class="cf-value">{{ confirmedClient!.fullName }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">PINFL</span>
          <span class="cf-value font-mono">{{ confirmedClient!.pinfl }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Phone</span>
          <span class="cf-value font-mono">{{ confirmedClient!.phone }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Passport</span>
          <span class="cf-value font-mono">{{ confirmedClient!.passportSerial }}</span>
        </div>
        <div class="client-field">
          <span class="cf-label">Date of birth</span>
          <span class="cf-value">{{ confirmedClient!.birthDate }}</span>
        </div>
      </div>
      <button class="btn-gradient mt-1" @click="confirmNewClient">
        Confirm & continue <i class="pi pi-arrow-right" />
      </button>
    </div>

    <!-- ── PHASE: katm (KATM consent + query) ───────────────────────────── -->
    <template v-if="phase === 'katm'">
      <!-- Compact client banner -->
      <div class="client-banner">
        <i class="pi pi-user" />
        <span>
          <strong>{{ confirmedClient!.fullName }}</strong>
          <span class="font-mono ml-1 text-secondary">{{ confirmedClient!.pinfl }}</span>
        </span>
        <span v-if="isNewClient" class="tag tag-accent tag-sm">New · MyID verified</span>
        <span v-else class="tag tag-success tag-sm">Existing client</span>
      </div>

      <div class="katm-box">
        <label class="consent">
          <Checkbox v-model="katmConsent" binary />
          <span>Client gives <strong>KATM consent</strong> (bureau query authorisation per law №301)</span>
        </label>
        <button
          class="btn-ghost"
          :disabled="!katmConsent || katmLoading || katmDone"
          @click="queryKatm"
        >
          <i v-if="katmLoading" class="pi pi-spin pi-spinner" />
          <i v-else-if="katmDone" class="pi pi-check" />
          <i v-else class="pi pi-database" />
          {{ katmLoading ? 'Querying KATM…' : katmDone ? 'KATM done' : 'Query KATM' }}
        </button>
      </div>

      <transition name="fade">
        <div v-if="katmDone" class="katm-result">
          <i class="pi pi-check-circle" />
          KATM responded — credit history loaded. Client is eligible to proceed.
        </div>
      </transition>
    </template>

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer class="sc-foot">
      <span class="hint">Step 1 of 7</span>
      <button class="btn-gradient" :disabled="!canContinue" @click="onNext">
        Continue <i class="pi pi-arrow-right" />
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
  margin-bottom: 1.4rem;
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

.myid-body {
  display: flex;
  gap: 2rem;
  align-items: center;
}

/* QR */
.qr-wrap {
  position: relative;
  flex-shrink: 0;
  width: 140px;
  height: 140px;
  border-radius: 12px;
  background: var(--bg-base);
  padding: 8px;
  border: 2px solid var(--accent-1);
  transition: border-color 0.3s;
}
.qr-wrap.qr-done { border-color: var(--success); }
.qr-svg { color: var(--text-primary); display: block; }
.qr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 212, 170, 0.15);
  border-radius: 10px;
  font-size: 3rem;
  color: var(--success);
}

/* MyID steps */
.myid-steps { display: flex; flex-direction: column; gap: 1rem; flex: 1; }
.myid-step {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.88rem;
  color: var(--text-secondary);
  transition: color 0.3s;
}
.myid-step.active { color: var(--accent-1); font-weight: 700; }
.myid-step.done { color: var(--success); font-weight: 600; }

.step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
}
.myid-step.done .step-dot { background: var(--success); border-color: var(--success); color: #fff; }
.myid-step.active .step-dot { background: var(--accent-1); border-color: var(--accent-1); color: #fff; }

.myid-status {
  margin-top: 1.2rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
  text-align: center;
}

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
