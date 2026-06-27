<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { useDealStore } from '@/stores/deal'
import type { KatmSummary } from '@/stores/deal'
import { useClientApi } from '@/composables/use-client-api'
import { createDealSession, saveSessionStep } from '@/composables/use-deal-session-api'
import { apiFetch } from '@/utils/apiFetch'
import type { Client } from '@/types'

const deal = useDealStore()
const { t } = useI18n()
const {
  searchClientsMutation,
  sendOtpMutation,
  verifyOtpMutation,
  myidSessionMutation,
  completeMyidMutation,
} = useClientApi()

const otpLoading = sendOtpMutation.isPending
const otpVerifying = verifyOtpMutation.isPending
const renewingSession = myidSessionMutation.isPending

// ── Phase state machine ────────────────────────────────────────────────────
type Phase =
  | 'search'
  | 'searching'
  | 'results'
  | 'found'
  | 'not_found'
  | 'otp_send'
  | 'otp_verify'
  | 'pinfl_entry'
  | 'myid_done'
  | 'katm'

function initialPhase(): Phase {
  if (deal.sessionData.client) return 'katm'
  return 'search'
}

const phase = ref<Phase>(initialPhase())
const query = ref('')
const searchError = ref('')
const searchResults = ref<Client[]>([])

// OTP registration flow
const otpPhone = ref('')
const otpPhoneError = ref('')
const otpCode = ref('')
const otpError = ref('')
const regToken = ref('')
const devOtp = ref<string | null>(null)

// Resend OTP cooldown
const RESEND_COOLDOWN_SECONDS = 60
const resendCooldown = ref(0)
let resendTimer: ReturnType<typeof setInterval> | null = null

function stopResendTimer() {
  if (resendTimer) {
    clearInterval(resendTimer)
    resendTimer = null
  }
}

function startResendCooldown() {
  stopResendTimer()
  resendCooldown.value = RESEND_COOLDOWN_SECONDS
  resendTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) stopResendTimer()
  }, 1000)
}

onUnmounted(stopResendTimer)

// PINFL (entered after OTP is verified)
const pinfl = ref('')
const pinflError = ref('')

const confirmedClient = ref<Client | null>(deal.sessionData.client)
const isNewClient = ref(deal.sessionData.isNewClient)

// MyID
const myidError = ref('')

// KATM — queried implicitly when the merchant presses "Continue" (ADR-0025:
// consent → ban pre-check → claim registration → report, possibly async)
const katmLoading = ref(false)
const katmError = ref('')
const katmDone = ref(!!deal.sessionData.katmResult && !!deal.sessionData.client)
const katmBanned = ref(false)
const katmOneIdLocked = ref(false)
// Async report (05050): the server polls the bureau via BullMQ; we poll the
// session status until the result is stamped
const katmPending = ref(deal.sessionData.katmPending)
let katmPollTimer: ReturnType<typeof setInterval> | null = null

const rejected = ref(false)
// Holds the specific reason behind a generic (non-ban, non-oneid) rejection so
// the template can show why and, for data_missing, which fields to fix.
const rejectReason = ref<{ code: string; category: string; missingFields: string[] } | null>(null)

// Localized one-liner for an ineligible/other rejection. data_missing renders
// its own field list instead of this.
const rejectReasonText = computed(() => {
  const code = rejectReason.value?.code
  if (!code) return t('stepClient.rejectReasons.generic')
  const key = `stepClient.rejectReasons.${code}`
  const msg = t(key)
  return msg === key ? t('stepClient.rejectReasons.generic') : msg
})

// Route a pipeline rejection to the right UI state. credit_ban and oneid_locked
// keep their dedicated blocks; everything else uses the reason block.
function applyRejection(
  reasonCode?: string | null,
  category?: string | null,
  missingFields?: string[],
) {
  if (reasonCode === 'credit_ban') {
    katmBanned.value = true
  } else if (reasonCode === 'oneid_locked' || category === 'access') {
    katmOneIdLocked.value = true
  } else {
    rejectReason.value = {
      code: reasonCode ?? '',
      category: category ?? 'ineligible',
      missingFields: missingFields ?? [],
    }
    rejected.value = true
  }
}

function stopKatmPolling() {
  if (katmPollTimer) {
    clearInterval(katmPollTimer)
    katmPollTimer = null
  }
}

function startKatmPolling() {
  stopKatmPolling()
  katmPending.value = true
  deal.setKatmPending(true)
  katmPollTimer = setInterval(checkKatmStatus, 5000)
}

async function checkKatmStatus() {
  if (!deal.dealSessionId) return
  try {
    const res = await apiFetch<
      { status: string; error?: string | null; reasonCategory?: string | null } & KatmSummary
    >(`/merchant/deal-sessions/${deal.dealSessionId}/katm-status`)
    if (res.status === 'completed') {
      stopKatmPolling()
      katmPending.value = false
      deal.setKatmResult(res)
      katmDone.value = true
      onNext()
    } else if (res.status === 'failed') {
      stopKatmPolling()
      katmPending.value = false
      deal.setKatmPending(false)
      // An async knockout (credit_ban / has_defaults / no_income) — surface the
      // specific reason rather than a generic error.
      applyRejection(res.error, res.reasonCategory)
    }
  } catch {
    // transient — keep polling
  }
}

onMounted(() => {
  if (katmPending.value && deal.sessionData.client) startKatmPolling()
})
onUnmounted(stopKatmPolling)

// ── Helpers ────────────────────────────────────────────────────────────────
function validatePinfl(): boolean {
  if (!/^\d{14}$/.test(pinfl.value)) {
    pinflError.value = t('stepClient.pinflInvalid')
    return false
  }
  pinflError.value = ''
  return true
}

function isPinflLike(s: string): boolean {
  return /^\d{14}$/.test(s.trim())
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const national = digits.startsWith('998') ? digits.slice(3) : digits
  return `+998${national}`
}

// ── Actions ────────────────────────────────────────────────────────────────
async function searchClient() {
  const q = query.value.trim()
  if (!q) return
  searchError.value = ''
  phase.value = 'searching'
  try {
    const data = await searchClientsMutation.mutateAsync(q)
    searchResults.value = data.clients as Client[]
    if (searchResults.value.length === 0) {
      if (isPinflLike(q)) pinfl.value = q
      phase.value = 'not_found'
    } else {
      phase.value = 'results'
    }
  } catch {
    searchError.value = t('stepClient.searchFailed')
    phase.value = 'search'
  }
}

function selectClient(client: Client) {
  confirmedClient.value = client
  isNewClient.value = false
  phase.value = 'found'
}

function useFoundClient() {
  phase.value = 'katm'
}

async function sendOtp() {
  const phone = normalizePhone(otpPhone.value)
  if (phone.length < 12) {
    otpPhoneError.value = t('stepClient.phoneRequired')
    return
  }
  otpPhoneError.value = ''
  try {
    const data = await sendOtpMutation.mutateAsync(phone)
    devOtp.value = data.devOtp ?? null
    phase.value = 'otp_verify'
    startResendCooldown()
  } catch {
    otpPhoneError.value = t('stepClient.otpSendFailed')
  }
}

async function resendOtp() {
  if (resendCooldown.value > 0 || otpLoading.value) return
  otpError.value = ''
  otpCode.value = ''
  try {
    const data = await sendOtpMutation.mutateAsync(normalizePhone(otpPhone.value))
    devOtp.value = data.devOtp ?? null
    startResendCooldown()
  } catch {
    otpError.value = t('stepClient.otpSendFailed')
  }
}

async function verifyOtpCode() {
  const phone = normalizePhone(otpPhone.value)
  if (!otpCode.value.trim()) return
  otpError.value = ''
  try {
    const data = await verifyOtpMutation.mutateAsync({ phone, code: otpCode.value.trim() })
    regToken.value = data.regToken
    phase.value = 'pinfl_entry'
  } catch (err) {
    const code = (err as Error).message
    otpError.value = code === 'invalid_otp' ? t('stepClient.invalidOtp') : t('stepClient.otpSendFailed')
  }
}

async function startMyId() {
  if (!validatePinfl()) return
  myidError.value = ''
  try {
    const data = await myidSessionMutation.mutateAsync({ regToken: regToken.value, pinfl: pinfl.value })
    regToken.value = data.regToken
    if (data.mock) {
      await completeMyid('mock')
    } else {
      sessionStorage.setItem('myid_reg_token', data.regToken)
      window.location.href = data.redirectUrl!
    }
  } catch (err) {
    const code = (err as Error).message
    if (code === 'client_already_registered') {
      pinflError.value = t('stepClient.clientAlreadyRegistered')
    } else {
      myidError.value = t('stepClient.myidFailed')
    }
  }
}

async function completeMyid(myidCode?: string) {
  myidError.value = ''
  try {
    const data = await completeMyidMutation.mutateAsync({ regToken: regToken.value, myidCode: myidCode ?? 'mock' })
    confirmedClient.value = data.client as Client
    isNewClient.value = true
    phase.value = 'myid_done'
  } catch (err) {
    const code = (err as Error).message
    myidError.value = code === 'pinfl_mismatch' ? t('stepClient.pinflMismatch') : t('stepClient.myidFailed')
    phase.value = 'pinfl_entry'
  }
}

function confirmNewClient() {
  phase.value = 'katm'
}

async function queryKatm(): Promise<boolean> {
  if (!confirmedClient.value || !deal.dealSessionId) return false
  katmLoading.value = true
  katmError.value = ''
  katmBanned.value = false
  katmOneIdLocked.value = false
  rejected.value = false
  rejectReason.value = null
  try {
    const result = await apiFetch<
      {
        status: 'completed' | 'pending' | 'rejected' | 'failed'
        reasonCode?: string
        reasonCategory?: string
        reason?: string
        missingFields?: string[]
      } & Partial<KatmSummary>
    >(`/merchant/deal-sessions/${deal.dealSessionId}/start`, {
      method: 'POST',
      body: JSON.stringify({
        userId: confirmedClient.value.id,
      }),
    })
    if (result.status === 'pending') {
      startKatmPolling()
      return false
    }
    // A rejection is a normal 200 outcome now — show the specific reason.
    if (result.status === 'rejected') {
      applyRejection(result.reasonCode, result.reasonCategory, result.missingFields)
      return false
    }
    // A technical / needs-review failure (e.g. an unmapped MIB code) is NOT a
    // pass — surface a generic error and do not advance the wizard.
    if (result.status === 'failed') {
      katmError.value = t('stepClient.katmError')
      return false
    }
    deal.setKatmResult(result as KatmSummary)
    katmDone.value = true
    return true
  } catch {
    // Only transport/system failures reach here — rejections come back as 200.
    katmError.value = t('stepClient.katmError')
    return false
  } finally {
    katmLoading.value = false
  }
}

function resetSearch() {
  phase.value = 'search'
  query.value = ''
  searchResults.value = []
  confirmedClient.value = null
  isNewClient.value = false
  otpPhone.value = ''
  otpPhoneError.value = ''
  otpCode.value = ''
  otpError.value = ''
  regToken.value = ''
  devOtp.value = null
  stopResendTimer()
  resendCooldown.value = 0
  pinfl.value = ''
  pinflError.value = ''
  katmDone.value = false
  katmError.value = ''
  katmBanned.value = false
  katmOneIdLocked.value = false
  rejected.value = false
  rejectReason.value = null
  stopKatmPolling()
  katmPending.value = false
  deal.setKatmPending(false)
  myidError.value = ''
}

// "New session" from a rejection: clear the store + local state and open a fresh
// backend deal session, mirroring step-card's recreateSession so the wizard is
// usable again instead of dead-ending on a reset-but-sessionless state.
async function recreateSession() {
  deal.reset()
  resetSearch()
  const { id } = await createDealSession()
  deal.setDealSessionId(id)
}

const saving = ref(false)
const saveError = ref('')

async function onNext() {
  if (!confirmedClient.value || katmLoading.value || saving.value) return
  if (katmPending.value || katmBanned.value) return
  if (!katmDone.value && !(await queryKatm())) return

  // Blocking step save — the wizard advances only once the server has it (ADR-0024)
  saving.value = true
  saveError.value = ''
  try {
    await saveSessionStep(deal.dealSessionId!, 'client', {
      isNewClient: isNewClient.value,
      myidVerified: isNewClient.value,
      katmConsent: true,
    })
  } catch {
    saveError.value = t('deal.stepSaveError')
    return
  } finally {
    saving.value = false
  }

  deal.setClient(confirmedClient.value, {
    isNew: isNewClient.value,
    myidVerified: isNewClient.value,
  })
  deal.setKatmConsent(true)
  deal.complete('client')
}

const canContinue = computed(
  () =>
    phase.value === 'katm' &&
    !!confirmedClient.value &&
    !katmPending.value &&
    !katmBanned.value &&
    !rejected.value,
)
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
      <label class="field-label">{{ $t('stepClient.searchLabel') }}</label>
      <div class="search-row">
        <InputText v-model="query" :placeholder="$t('stepClient.searchPlaceholder')" class="search-input"
          :disabled="phase === 'searching'" @keydown.enter="searchClient" />
        <button class="btn-gradient" :disabled="phase === 'searching' || !query.trim()" @click="searchClient">
          <i v-if="phase === 'searching'" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-search" />
          {{ phase === 'searching' ? $t('stepClient.searching') : $t('stepClient.search') }}
        </button>
      </div>
      <span v-if="searchError" class="field-error">{{ searchError }}</span>
      <p class="search-hint">{{ $t('stepClient.searchHint') }}</p>
    </div>

    <!-- ── PHASE: results ────────────────────────────────────────────────── -->
    <div v-else-if="phase === 'results'" class="results-box">
      <p class="results-count">{{ $t('stepClient.resultsFound', { count: searchResults.length }) }}</p>
      <ul class="results-list">
        <li v-for="c in searchResults" :key="c.pinfl" class="result-item" @click="selectClient(c)">
          <i class="pi pi-user result-icon" />
          <div class="result-info">
            <span class="result-name">{{ c.firstName }} {{ c.lastName }}</span>
            <span class="result-pinfl font-mono">{{ c.pinfl }}</span>
          </div>
          <i class="pi pi-chevron-right result-arrow" />
        </li>
      </ul>
      <button class="btn-link mt-1" @click="phase = 'not_found'">
        <i class="pi pi-user-plus" /> {{ $t('stepClient.clientNotInList') }}
      </button>
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
          <span class="cf-value font-mono">{{ confirmedClient!.passportSeries }}{{ confirmedClient?.passportNumber
            }}</span>
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
        <p class="nf-title">{{ $t('stepClient.noClientFound') }}</p>
        <p class="nf-sub">{{ $t('stepClient.noClientSub') }}</p>
      </div>
      <button class="btn-myid" @click="phase = 'otp_send'">
        <i class="pi pi-user-plus" style="font-size:1rem" />
        {{ $t('stepClient.registerNewClient') }}
      </button>
    </div>

    <!-- ── PHASE: otp_send ───────────────────────────────────────────────── -->
    <div v-else-if="phase === 'otp_send'" class="reg-panel">
      <div class="reg-step-head">
        <span class="reg-step-badge">1 / 3</span>
        <span class="reg-step-title">{{ $t('stepClient.otpSendTitle') }}</span>
      </div>
      <p class="reg-step-sub">{{ $t('stepClient.otpSendSub') }}</p>
      <div class="field">
        <label class="field-label">{{ $t('stepClient.clientPhone') }}</label>
        <div class="phone-row">
          <span class="phone-prefix">+998</span>
          <InputText v-model="otpPhone" inputmode="numeric" placeholder="00 000 00 00" class="phone-field-input"
            :invalid="!!otpPhoneError" :disabled="otpLoading" @keydown.enter="sendOtp" @input="otpPhoneError = ''" />
        </div>
        <span v-if="otpPhoneError" class="field-error">{{ otpPhoneError }}</span>
      </div>
      <button class="btn-gradient mt-1" :disabled="otpLoading || !otpPhone.trim()" @click="sendOtp">
        <i v-if="otpLoading" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-send" />
        {{ $t('stepClient.sendOtp') }}
      </button>
    </div>

    <!-- ── PHASE: otp_verify ─────────────────────────────────────────────── -->
    <div v-else-if="phase === 'otp_verify'" class="reg-panel">
      <div class="reg-step-head">
        <span class="reg-step-badge">2 / 3</span>
        <span class="reg-step-title">{{ $t('stepClient.otpVerifyTitle') }}</span>
      </div>
      <p class="reg-step-sub">{{ $t('stepClient.otpVerifySub', { phone: otpPhone }) }}</p>
      <div v-if="devOtp" class="dev-otp-badge">
        <span class="dev-label">DEV</span>
        <span class="dev-code">{{ devOtp }}</span>
      </div>
      <div class="field">
        <label class="field-label">{{ $t('stepClient.otpCode') }}</label>
        <InputText v-model="otpCode" inputmode="numeric" maxlength="6" placeholder="1234" class="font-mono otp-input"
          :invalid="!!otpError" :disabled="otpVerifying" @keydown.enter="verifyOtpCode" @input="otpError = ''" />
        <span v-if="otpError" class="field-error">{{ otpError }}</span>
      </div>
      <button class="btn-gradient mt-1" :disabled="otpVerifying || !otpCode.trim()" @click="verifyOtpCode">
        <i v-if="otpVerifying" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-check" />
        {{ $t('stepClient.verifyOtp') }}
      </button>
      <button class="btn-link resend-btn" :disabled="resendCooldown > 0 || otpLoading" @click="resendOtp">
        <i v-if="otpLoading" class="pi pi-spin pi-spinner" />
        <i v-else class="pi pi-refresh" />
        {{ resendCooldown > 0
          ? $t('stepClient.resendIn', { seconds: resendCooldown })
          : $t('stepClient.resendOtp') }}
      </button>
    </div>

    <!-- ── PHASE: pinfl_entry ────────────────────────────────────────────── -->
    <div v-else-if="phase === 'pinfl_entry'" class="reg-panel">
      <div class="reg-step-head">
        <span class="reg-step-badge">3 / 3</span>
        <span class="reg-step-title">{{ $t('stepClient.pinflEntryTitle') }}</span>
      </div>
      <p class="reg-step-sub">{{ $t('stepClient.pinflEntrySub') }}</p>
      <div class="field">
        <label class="field-label">{{ $t('stepClient.clientPinfl') }}</label>
        <InputText v-model="pinfl" maxlength="14" placeholder="31203016740099" class="font-mono" :invalid="!!pinflError"
          @input="pinflError = ''" @keydown.enter="startMyId" />
        <span v-if="pinflError" class="field-error">{{ pinflError }}</span>
      </div>
      <span v-if="myidError" class="field-error mt-1">{{ myidError }}</span>
      <button class="btn-myid mt-1" :disabled="!pinfl.trim() || renewingSession" @click="startMyId">
        <i v-if="renewingSession" class="pi pi-spin pi-spinner" />
        <span v-else class="myid-logo">MyID</span>
        {{ $t('stepClient.startVerification') }}
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
          <span class="cf-value font-mono">{{ confirmedClient!.passportSeries }}{{ confirmedClient?.passportNumber }}</span>
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

      <transition name="fade">
        <div v-if="katmDone" class="katm-result">
          <i class="pi pi-check-circle" />
          {{ $t('stepClient.katmResult') }}
        </div>
      </transition>

      <transition name="fade">
        <div v-if="katmPending" class="katm-pending">
          <i class="pi pi-spin pi-spinner" />
          {{ $t('stepClient.katmPendingWait') }}
        </div>
      </transition>

      <transition name="fade">
        <div v-if="katmBanned" class="katm-error">
          <i class="pi pi-ban" />
          {{ $t('stepClient.katmBanned') }}
        </div>
      </transition>

      <transition name="fade">
        <div v-if="katmOneIdLocked" class="katm-one-id-hint">
          <i class="pi pi-lock katm-one-id-hint__icon" />
          <div class="katm-one-id-hint__body">
            <p class="katm-one-id-hint__title">{{ $t('stepClient.oneIdLockedTitle') }}</p>
            <p class="katm-one-id-hint__desc">{{ $t('stepClient.oneIdLockedDesc') }}</p>
          </div>
          <button class="btn-ghost btn-sm" style="margin-left: auto; flex-shrink: 0" :disabled="katmLoading"
            @click="onNext">
            <i class="pi pi-refresh" /> {{ $t('common.retry') }}
          </button>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="rejected" class="rejected-block">
          <i class="pi pi-times-circle rejected-icon" />
          <div class="rejected-body">
            <p class="rejected-title">{{ $t('stepCard.rejectedTitle') }}</p>
            <template v-if="rejectReason?.category === 'data_missing'">
              <p class="rejected-desc">{{ $t('stepClient.rejectReasons.dataMissingDesc') }}</p>
              <ul class="rejected-fields">
                <li v-for="f in rejectReason.missingFields" :key="f">
                  {{ $t(`stepClient.rejectReasons.fields.${f}`) }}
                </li>
              </ul>
            </template>
            <p v-else class="rejected-desc">{{ rejectReasonText }}</p>
          </div>
          <button class="btn-ghost" style="margin-left: auto" @click="recreateSession">
            {{ $t('stepCard.newSession') }}
          </button>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="katmError" class="katm-error">
          <i class="pi pi-exclamation-triangle" />
          {{ katmError }}
          <button class="btn-ghost btn-sm" :disabled="katmLoading" @click="onNext">
            <i class="pi pi-refresh" /> {{ $t('common.retry') }}
          </button>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="saveError" class="katm-error">
          <i class="pi pi-exclamation-triangle" />
          {{ saveError }}
          <button class="btn-ghost btn-sm" :disabled="saving" @click="onNext">
            <i class="pi pi-refresh" /> {{ $t('common.retry') }}
          </button>
        </div>
      </transition>
    </template>

    <!-- ── Footer ────────────────────────────────────────────────────────── -->
    <footer v-if="!rejected" class="sc-foot">
      <span class="hint">{{ $t('stepClient.stepOf') }}</span>
      <button class="btn-gradient" :disabled="!canContinue || katmLoading || saving" @click="onNext">
        <i v-if="katmLoading || saving" class="pi pi-spin pi-spinner" />
        {{ katmLoading ? $t('stepClient.queryingKatm') : $t('common.continue') }}
        <i v-if="!katmLoading && !saving" class="pi pi-arrow-right" />
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card {
  padding: 2rem;
}

.sc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.sc-head h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.sc-head p {
  margin: 0.3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

/* ── Search ── */
.search-box {
  margin: 1.8rem 0;
}

.search-row {
  display: flex;
  gap: 0.8rem;
  margin-top: 0.5rem;
}

.search-input {
  flex: 1;
}

.search-hint {
  margin-top: 0.8rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

/* ── Results ── */
.results-box {
  margin: 1.8rem 0;
}

.results-count {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 0 0 0.8rem;
}

.results-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.result-item:hover {
  border-color: var(--accent-1);
  background: var(--bg-elevated, var(--bg-surface));
}

.result-icon {
  color: var(--accent-1);
  font-size: 1.1rem;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.result-name {
  font-weight: 700;
  font-size: 0.92rem;
}

.result-pinfl {
  font-size: 0.8rem;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}

.result-arrow {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

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

.client-card-header {
  margin-bottom: 1.1rem;
}

.client-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1.4rem;
}

.client-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cf-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cf-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.mt-1 {
  margin-top: 1.2rem;
}

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

.nf-icon {
  font-size: 2rem;
  color: var(--warning);
}

.nf-title {
  margin: 0;
  font-weight: 700;
  font-size: 0.95rem;
}

.nf-sub {
  margin: 0.3rem 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

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

.btn-myid:hover {
  opacity: 0.88;
}

.myid-logo {
  background: #fff;
  color: var(--accent-1);
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

/* ── Registration flow panels (otp_send / otp_verify / pinfl_entry) ── */
.reg-panel {
  margin: 1.8rem 0;
  background: var(--bg-surface);
  border: 1.5px solid var(--border-subtle);
  border-radius: 16px;
  padding: 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reg-step-head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.reg-step-badge {
  background: var(--accent-1);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  white-space: nowrap;
}

.reg-step-title {
  font-weight: 700;
  font-size: 1rem;
}

.reg-step-sub {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text-secondary);
}

.otp-input {
  font-size: 1.4rem;
  letter-spacing: 0.3em;
  max-width: 160px;
}

.dev-otp-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #1a1a2e;
  border: 1.5px dashed #f59e0b;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  align-self: flex-start;
}

.dev-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #f59e0b;
  letter-spacing: 0.1em;
}

.dev-code {
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #f59e0b;
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

.myid-title {
  font-weight: 700;
  font-size: 1rem;
}

.myid-frame-wrap {
  position: relative;
  margin-top: 0.8rem;
}

.myid-frame {
  width: 100%;
  height: 440px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  display: block;
}

.myid-timeout-overlay {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
}

.myid-timeout-msg {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}

.myid-timeout-actions {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--text-primary);
  border: 1.5px solid var(--border-subtle);
  border-radius: 10px;
  padding: 0.6rem 1.1rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s;
}

.btn-outline:hover {
  border-color: var(--accent-1);
  color: var(--accent-1);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-error {
  font-size: 0.8rem;
  color: var(--danger);
}

.phone-row {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}

.phone-prefix {
  padding: 0.65rem 0.6rem 0.65rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-secondary);
  border-right: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.phone-field-input {
  flex: 1;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0.65rem 0.9rem;
}

.mb-1 {
  margin-bottom: 0.8rem;
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

.client-banner i {
  color: var(--accent-1);
  font-size: 1.1rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.ml-1 {
  margin-left: 0.3rem;
}

/* ── KATM ── */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

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

.katm-error {
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--danger);
  background: var(--danger-bg, #fff0f0);
  padding: 0.8rem 1.1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.86rem;
}

.katm-pending {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--warning);
  background: var(--warning-bg);
  padding: 0.8rem 1.1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.86rem;
}

.katm-one-id-hint {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  background: var(--warning-bg);
  border: 1px solid var(--warning);
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
  margin-top: 1.4rem;
}

.katm-one-id-hint__icon {
  font-size: 1.6rem;
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.katm-one-id-hint__body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.katm-one-id-hint__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--warning);
}

.katm-one-id-hint__desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.rejected-block {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--danger-bg, #fff0f0);
  border: 1px solid var(--danger);
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
  margin-top: 1.4rem;
}

.rejected-icon {
  font-size: 2rem;
  color: var(--danger);
  flex-shrink: 0;
}

.rejected-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.rejected-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--danger);
}

.rejected-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.btn-sm {
  font-size: 0.8rem;
  padding: 0.25rem 0.6rem;
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

.tag-success {
  background: var(--success-bg);
  color: var(--success);
}

.tag-accent {
  background: var(--bg-surface);
  color: var(--accent-1);
  border: 1px solid var(--accent-1);
}

.tag-sm {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
}

/* ── Footer ── */
.sc-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}

.hint {
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

.btn-gradient {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-gradient:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

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

.btn-link:hover {
  text-decoration: underline;
}

.resend-btn {
  align-self: flex-start;
}

.resend-btn:disabled {
  color: var(--text-secondary);
  cursor: not-allowed;
  text-decoration: none;
}

/* ── Transition ── */
.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
}

@media (max-width: 600px) {
  .client-grid {
    grid-template-columns: 1fr;
  }

  .search-row {
    flex-direction: column;
  }

  .sc-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.8rem;
  }

  .step-card {
    padding: 1rem;
  }
}
</style>
