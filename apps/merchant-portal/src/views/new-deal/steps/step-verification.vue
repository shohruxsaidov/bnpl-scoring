<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDealStore } from '@/stores/deal'
import { useClientApi } from '@/composables/use-client-api'
import { useCreateDealMutation } from '@/composables/use-deals-api'
import {
  fetchActiveSession,
  isSigningProofFresh,
  saveSessionStep,
} from '@/composables/use-deal-session-api'
import MonoAmount from '@/components/mono-amount.vue'

const { t, locale } = useI18n()
const deal = useDealStore()
const {
  sendSigningOtpMutation,
  verifySigningOtpMutation,
  myidSignSessionMutation,
} = useClientApi()

const createDealMutation = useCreateDealMutation()

const sd = computed(() => deal.sessionData)
const principal = computed(() => deal.basketTotal)
const totalPayable = computed(() => {
  const t = sd.value.tariff
  if (!t) return principal.value
  return Math.round(principal.value * (1 + t.markupPercent / 100))
})

function itemPrice(price: string, quantity: number): number {
  const base = Math.round(parseFloat(price) * 100)
  const pct = sd.value.tariff?.markupPercent ?? 0
  return Math.round(base * (1 + pct / 100)) * quantity
}

// ── Signing gate ───────────────────────────────────────────────────────────
// MyID (identity — the client is standing here) first, then the OTP (акцепт —
// consent to these exact terms), which is therefore always the last act before
// the Deal. Neither proof lives in the browser: both are stamped onto the Deal
// Session server-side, and the phase below is READ back off that stamp — so the
// gate the agent sees can never disagree with the gate the server enforces.
type SignPhase = 'myid' | 'otp' | 'ready'

const otpCode = ref('')
const otpError = ref('')
const devOtp = ref<string | null>(null)
const myidError = ref('')
const submitting = ref(false)
const submitError = ref('')
const lang = ref<'ru' | 'uz'>(sd.value.contractLang ?? 'ru')
/** The SMS has gone out in this sitting — a sub-state of the `otp` phase. */
const otpSent = ref(false)

/** Ticks so a proof going stale re-renders the gate instead of waiting for a 409. */
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | null = null

const signing = computed(() => sd.value.signing)
const myidFresh = computed(() => isSigningProofFresh(signing.value?.myidVerifiedAt, now.value))
const otpFresh = computed(() => isSigningProofFresh(signing.value?.otpVerifiedAt, now.value))

const phase = computed<SignPhase>(() => {
  if (!myidFresh.value) return 'myid'
  if (!otpFresh.value) return 'otp'
  return 'ready'
})

/** A scan that HAS happened but has aged out — say so, rather than looking untouched. */
const myidExpired = computed(() => !!signing.value?.myidVerifiedAt && !myidFresh.value)

// Falling back to the MyID gate voids the code we may have sent for the old scan.
watch(phase, (p) => {
  if (p === 'myid') {
    otpSent.value = false
    otpCode.value = ''
    devOtp.value = ''
  }
})

/**
 * Persist the contract language onto the session. Called before the MyID redirect
 * (so the choice survives leaving the page) and again before deal creation, which
 * reads `lang` off the session — never off the request (ADR-0024).
 */
async function saveVerificationStep(): Promise<boolean> {
  if (!deal.dealSessionId) return false
  try {
    await saveSessionStep(deal.dealSessionId, 'verification', { lang: lang.value })
    return true
  } catch {
    return false
  }
}

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

onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 5000)

  // The face-scan's return leg left a verdict for us. Success needs no flag — the
  // stamp is already on the session we just re-hydrated from.
  const failed = sessionStorage.getItem('myid_sign_failed')
  if (failed) {
    sessionStorage.removeItem('myid_sign_failed')
    myidError.value =
      failed === 'pinfl_mismatch'
        ? t('stepVerification.myidPinflMismatch')
        : t('stepVerification.myidFailed')
  }
})

onUnmounted(() => {
  stopResendTimer()
  if (clock) clearInterval(clock)
})

async function startMyidSigning() {
  if (!deal.dealSessionId) return
  myidError.value = ''

  // Save the language before we leave the page — a re-hydrate on return would
  // otherwise silently reset the selector to RU and sign the wrong contract.
  if (!(await saveVerificationStep())) {
    myidError.value = t('stepVerification.stepSaveFailed')
    return
  }

  try {
    const res = await myidSignSessionMutation.mutateAsync(deal.dealSessionId)
    sessionStorage.setItem('myid_sign_session_token', res.signingSessionToken)
    window.location.href = res.redirectUrl
  } catch (err: any) {
    // The client took a deal elsewhere while this wizard was open. The server
    // stops us here, before the face scan and the SMS — the deal cannot exist,
    // so there is nothing to be gained by putting the client through signing it.
    myidError.value =
      err?.message === 'active_deal_exists'
        ? t('stepVerification.activeDealExists')
        : t('stepVerification.myidSessionFailed')
  }
}

async function sendSigningOtp() {
  if (!deal.dealSessionId) return
  otpError.value = ''
  devOtp.value = null
  try {
    const res = await sendSigningOtpMutation.mutateAsync(deal.dealSessionId)
    if (res.devOtp) devOtp.value = res.devOtp
    otpSent.value = true
    startResendCooldown()
  } catch (err: any) {
    otpError.value =
      err?.message === 'myid_not_verified'
        ? t('stepVerification.myidExpired')
        : t('stepVerification.otpSendFailed')
  }
}

async function verifySigningOtp() {
  if (!deal.dealSessionId || !otpCode.value) return
  otpError.value = ''
  try {
    const res = await verifySigningOtpMutation.mutateAsync({
      dealSessionId: deal.dealSessionId,
      code: otpCode.value,
    })
    // The stamp the server just wrote — the phase recomputes from it.
    deal.setSigning(res.signing)
  } catch (err: any) {
    otpError.value =
      err?.message === 'myid_not_verified'
        ? t('stepVerification.myidExpired')
        : t('stepVerification.otpInvalid')
  }
}

// ── Deal creation ──────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value === 'ru' ? 'ru-RU' : 'uz-UZ', {
    day: '2-digit',
    month: 'long',
  })
}

async function signSubmit() {
  if (!deal.dealSessionId || phase.value !== 'ready') return
  submitting.value = true
  submitError.value = ''
  try {
    // The deal is built FROM the session (ADR-0024): save the contract language,
    // then send nothing but the session id — both signing proofs are already
    // stamped on it, so a business-rule failure here can be retried without
    // burning the client's SMS.
    if (!(await saveVerificationStep())) {
      submitError.value = t('stepVerification.stepSaveFailed')
      return
    }

    const res = await createDealMutation.mutateAsync({ dealSessionId: deal.dealSessionId })

    deal.setCreatedDealId(res.dealId, res.dealNumber)
    deal.complete('verification')
  } catch (err: any) {
    const code = err?.message
    if (code === 'myid_not_verified' || code === 'otp_not_verified' || code === 'pinfl_mismatch') {
      // A proof aged out between render and click — drop back to the gate that
      // now needs redoing instead of leaving a dead "Создать сделку" button.
      const active = await fetchActiveSession().catch(() => null)
      if (active) deal.hydrateFromSession(active)
      submitError.value = t('stepVerification.myidExpired')
    } else if (code === 'active_deal_exists') {
      submitError.value = t('stepVerification.activeDealExists')
    } else {
      submitError.value = code ?? t('stepVerification.createDealFailed')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="step-card surface-card">
    <header class="sc-head">
      <div>
        <h2>{{ $t('stepVerification.title') }}</h2>
        <p>{{ $t('stepVerification.subtitle') }}</p>
      </div>
    </header>

    <div class="summary-grid">
      <section class="sum-block">
        <h4><i class="pi pi-user" /> {{ $t('stepVerification.client') }}</h4>
        <dl>
          <div>
            <dt>{{ $t('stepVerification.name') }}</dt>
            <dd>{{ sd.client ? `${sd.client.firstName} ${sd.client.lastName}` : '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.pinfl') }}</dt>
            <dd class="font-mono">{{ sd.client?.pinfl }}</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.phone') }}</dt>
            <dd>{{ sd.client?.phone }}</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.passport') }}</dt>
            <dd class="font-mono">{{ sd.client?.passportSeries }}{{ sd.client?.passportNumber }}</dd>
          </div>

        </dl>
      </section>



      <section class="sum-block">
        <h4><i class="pi pi-percentage" /> {{ $t('stepVerification.tariff') }}</h4>
        <dl>
          <div>
            <dd>{{ sd.tariff?.name }}</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.term') }}</dt>
            <dd>{{ sd.tariff?.termMonths }} {{ $t('stepVerification.months') }}</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.ustama') }}</dt>
            <dd>{{ sd.tariff?.markupPercent }}%</dd>
          </div>
          <div>
            <dt>{{ $t('stepVerification.paymentDay') }}</dt>
            <dd class="font-mono">{{ sd.paymentDay }}</dd>
          </div>
        </dl>
      </section>

      <section class="sum-block totals">
        <h4><i class="pi pi-wallet" /> {{ $t('stepVerification.amounts') }}</h4>
        <div class="amt-row">
          <span>{{ $t('stepVerification.totalPayable') }}</span>
          <MonoAmount :value="totalPayable" size="md" />
        </div>
      </section>
    </div>

    <section class="basket-block">
      <h4><i class="pi pi-shopping-bag" /> {{ $t('stepVerification.basket', { count: deal.basketCount }) }}</h4>
      <div v-for="item in sd.basket" :key="item.product.id" class="basket-line">
        <span>{{ item.product.name }}</span>
        <span class="font-mono qty">×{{ item.quantity }}</span>
        <MonoAmount :value="itemPrice(item.product.price, item.quantity)" size="sm" :gradient="false" />
      </div>
    </section>

    <section class="sched-block">
      <h4><i class="pi pi-calendar" /> {{ $t('stepVerification.schedulePreview') }}</h4>
      <table class="sched-table">
        <thead>
          <tr>
            <th class="sc-num">№</th>
            <th>{{ $t('common.date') }}</th>
            <th class="sc-amt">{{ $t('common.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sd.schedule" :key="row.index">
            <td class="sc-num font-mono">{{ row.index }}</td>
            <td class="font-mono sc-date">{{ fmtDate(row.dueDate) }}</td>
            <td class="sc-amt">
              <MonoAmount :value="row.amount" size="sm" :gradient="false" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Contract language selector -->
    <div class="lang-selector">
      <span class="lang-label">{{ $t('stepVerification.contractLang') }}</span>
      <div class="lang-btns">
        <button class="lang-btn" :class="{ active: lang === 'ru' }" @click="lang = 'ru'">RU</button>
        <button class="lang-btn" :class="{ active: lang === 'uz' }" @click="lang = 'uz'">UZ</button>
      </div>
    </div>

    <!-- Signing gate: MyID (identity) → OTP (акцепт) → create -->
    <div class="sign-gate">
      <!-- myid: the client must pass the face-scan before any code is sent -->
      <div v-if="phase === 'myid'" class="gate-row">
        <div class="gate-hint">
          <i class="pi pi-id-card" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.myidTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.myidHint') }}</p>
            <p v-if="myidExpired" class="otp-error mt-1">
              <i class="pi pi-clock" /> {{ $t('stepVerification.myidExpired') }}
            </p>
            <p v-if="myidError" class="otp-error mt-1">
              <i class="pi pi-exclamation-circle" /> {{ myidError }}
            </p>
          </div>
        </div>
        <button class="btn-myid" :disabled="myidSignSessionMutation.isPending.value" @click="startMyidSigning">
          <i v-if="myidSignSessionMutation.isPending.value" class="pi pi-spin pi-spinner" />
          <span v-else class="myid-logo-text">MyID</span>
          {{ $t('stepVerification.verifyMyid') }}
        </button>
      </div>

      <!-- otp: identity proven — now take the client's consent to these terms -->
      <div v-else-if="phase === 'otp'" class="gate-otp">
        <div class="gate-hint">
          <i class="pi pi-verified success-icon" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.myidVerifiedTitle') }}</p>
            <p class="gate-sub">
              {{ otpSent
                ? $t('stepVerification.otpSentHint', { phone: sd.client?.phone ?? '' })
                : $t('stepVerification.signHint', { phone: sd.client?.phone ?? '' }) }}
            </p>
            <p v-if="devOtp" class="dev-otp">DEV: {{ devOtp }}</p>
          </div>
        </div>

        <button v-if="!otpSent" class="btn-gradient" :disabled="sendSigningOtpMutation.isPending.value"
          @click="sendSigningOtp">
          <i v-if="sendSigningOtpMutation.isPending.value" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-send" />
          {{ $t('stepVerification.sendOtp') }}
        </button>

        <div v-else class="otp-row">
          <input v-model="otpCode" type="text" inputmode="numeric" maxlength="4" class="otp-input font-mono"
            :placeholder="$t('stepVerification.otpPlaceholder')" @keyup.enter="verifySigningOtp" />
          <button class="btn-gradient" :disabled="otpCode.length < 4 || verifySigningOtpMutation.isPending.value"
            @click="verifySigningOtp">
            <i v-if="verifySigningOtpMutation.isPending.value" class="pi pi-spin pi-spinner" />
            <i v-else class="pi pi-check" />
            {{ $t('stepVerification.confirmOtp') }}
          </button>
          <button class="btn-ghost resend" :disabled="resendCooldown > 0 || sendSigningOtpMutation.isPending.value"
            @click="sendSigningOtp">
            <i v-if="sendSigningOtpMutation.isPending.value" class="pi pi-spin pi-spinner" />
            {{ resendCooldown > 0
              ? $t('stepVerification.resendIn', { seconds: resendCooldown })
              : $t('stepVerification.resendOtp') }}
          </button>
        </div>

        <p v-if="otpError" class="otp-error">
          <i class="pi pi-exclamation-circle" /> {{ otpError }}
        </p>
      </div>

      <!-- ready: both proofs stamped → build the deal from the session -->
      <div v-else class="gate-row myid-verified">
        <div class="gate-hint">
          <i class="pi pi-check-circle success-icon" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.signedTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.signedHint') }}</p>
          </div>
        </div>
        <button class="btn-gradient sign" :disabled="submitting" @click="signSubmit">
          <i v-if="submitting" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-file-check" />
          {{ submitting ? $t('stepVerification.creatingDeal') : $t('stepVerification.createDeal') }}
        </button>
        <p v-if="submitError" class="submit-error">
          <i class="pi pi-exclamation-triangle" /> {{ submitError }}
        </p>
      </div>
    </div>

    <footer class="sc-foot">
      <button class="btn-ghost" :disabled="submitting" @click="deal.back()">
        <i class="pi pi-arrow-left" /> {{ $t('common.back') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.step-card {
  padding: 2rem;
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
  margin: 1.8rem 0;
}

.sum-block {
  background: var(--bg-surface);
  border-radius: 14px;
  padding: 1.2rem;
}

.sum-block h4 {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--accent-2);
}

.sum-block dl {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sum-block dl div {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  gap: 0.5rem;
}

.sum-block dt {
  color: var(--text-secondary);
  font-weight: 600;
}

.sum-block dd {
  margin: 0;
  font-weight: 700;
  text-align: right;
}

.totals .amt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.8rem;
}

.basket-block,
.sched-block {
  background: var(--bg-surface);
  border-radius: 14px;
  padding: 1.2rem;
  margin-bottom: 1.1rem;
}

.basket-block h4,
.sched-block h4 {
  margin: 0 0 0.9rem;
  font-size: 0.82rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--accent-2);
}

.basket-line {
  display: grid;
  grid-template-columns: 1fr 60px 1fr;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.84rem;
}

.basket-line:last-child {
  border-bottom: none;
}

.basket-line .qty {
  color: var(--text-secondary);
  text-align: center;
}

.basket-line :last-child {
  text-align: right;
}

.sched-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

.sched-table th {
  text-align: left;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
  padding: 0.5rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.sched-table td {
  padding: 0.5rem 0.7rem;
  color: var(--text-primary);
}

.sched-table tbody tr:nth-child(odd) {
  background: var(--bg-base);
}

.sched-table .sc-num {
  width: 3rem;
  text-align: center;
  color: var(--text-secondary);
}

.sched-table .sc-amt {
  text-align: right;
}

.sc-date {
  color: var(--text-secondary);
  font-weight: 700;
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.1rem;
}

.lang-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.lang-btns {
  display: flex;
  gap: 0.4rem;
}

.lang-btn {
  padding: 0.35rem 0.85rem;
  border-radius: 8px;
  border: 1.5px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.lang-btn.active {
  border-color: var(--accent-2);
  color: var(--accent-2);
  background: color-mix(in srgb, var(--accent-2) 10%, transparent);
}

.sign-gate {
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 1.4rem 1.6rem;
  margin-bottom: 1.2rem;
  background: var(--bg-surface);
}

.gate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.4rem;
}

.gate-row.signed {
  border-color: var(--success);
}

.gate-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
}

.gate-hint>.pi {
  font-size: 1.5rem;
  color: var(--accent-2);
  margin-top: 0.1rem;
}

.success-icon {
  color: var(--success) !important;
}

.gate-title {
  margin: 0 0 0.2rem;
  font-weight: 800;
  font-size: 0.9rem;
}

.gate-sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.dev-otp {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--warning);
  background: var(--warning-bg);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  display: inline-block;
}

.gate-otp {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.submit-error {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.otp-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.otp-input {
  width: 100px;
  height: 44px;
  border: 2px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.3em;
  outline: none;
  transition: border-color 0.15s ease;
}

.otp-input:focus {
  border-color: var(--accent-2);
}

.resend {
  font-size: 0.78rem;
  margin-left: auto;
}

.resend:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.otp-error {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.sc-foot {
  display: flex;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--border-subtle);
}

.btn-gradient,
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.sign {
  padding: 0.7rem 1.6rem;
}

.btn-myid {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.4rem;
  border-radius: 12px;
  border: 2px solid #1a56db;
  background: #fff;
  color: #1a56db;
  font-weight: 800;
  font-size: 0.88rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.btn-myid:hover:not(:disabled) {
  background: #1a56db;
  color: #fff;
}

.btn-myid:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.myid-logo-text {
  font-weight: 900;
  font-style: italic;
  font-size: 0.9rem;
}

.myid-verified {
  border-color: var(--success);
}

.mt-1 {
  margin-top: 0.4rem;
}

@media (max-width: 700px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .gate-row {
    flex-direction: column;
    gap: 1rem;
  }

  .gate-hint {
    i {
      display: none;
    }
  }

  .otp-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.8rem;



    .otp-input {
      width: 100%;
    }
  }
}

@media (max-width: 480px) {
  .step-card {
    padding: 1.2rem;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
