<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDealStore } from '@/stores/deal'
import { useClientApi } from '@/composables/use-client-api'
import { useCreateDealMutation } from '@/composables/use-deals-api'
import { saveSessionStep } from '@/composables/use-deal-session-api'
import MonoAmount from '@/components/mono-amount.vue'

const { locale } = useI18n()
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

// ── Signing phase machine ──────────────────────────────────────────────────
// idle → otp_sent → signed → [MyID redirect] → myid_verified
type SignPhase = 'idle' | 'otp_sent' | 'signed' | 'myid_verified'
const signPhase = ref<SignPhase>('idle')
const otpCode = ref('')
const otpError = ref('')
const devOtp = ref<string | null>(null)
const myidError = ref('')
const submitting = ref(false)
const submitError = ref('')
const lang = ref<'ru' | 'uz'>('ru')
/** JWT proof of OTP consent — returned by /sign-otp/verify, sent with deal creation */
const signingToken = ref<string | null>(null)
/** When the Client's signing OTP was verified — recorded on the session's verification step */
const otpVerifiedAt = ref<string | null>(null)

/**
 * Blocking save of the Верификация step (lang + OTP consent moment) onto the
 * Deal Session — the Deal is built from the session, so this must land before
 * deal creation or the MyID redirect (ADR-0024).
 */
async function saveVerificationStep(): Promise<boolean> {
  if (!deal.dealSessionId) return false
  try {
    await saveSessionStep(deal.dealSessionId, 'verification', {
      lang: lang.value,
      otpVerifiedAt: otpVerifiedAt.value,
    })
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

onUnmounted(stopResendTimer)

// Resume after MyID sign callback
onMounted(() => {
  const complete = sessionStorage.getItem('myid_sign_complete')
  const failed = sessionStorage.getItem('myid_sign_failed')
  if (complete) {
    sessionStorage.removeItem('myid_sign_complete')
    // Restore the signing token that was saved before the redirect
    signingToken.value = sessionStorage.getItem('signing_token')
    signPhase.value = 'myid_verified'
  } else if (failed) {
    sessionStorage.removeItem('myid_sign_failed')
    // Resume at 'signed' — token is still valid, agent can retry MyID
    signingToken.value = sessionStorage.getItem('signing_token')
    signPhase.value = 'signed'
    myidError.value = 'MyID верификация не удалась. Попробуйте ещё раз.'
  }
})

async function sendSigningOtp() {
  if (!deal.dealSessionId) return
  otpError.value = ''
  devOtp.value = null
  const res = await sendSigningOtpMutation.mutateAsync(deal.dealSessionId)
  if (res.devOtp) devOtp.value = res.devOtp
  signPhase.value = 'otp_sent'
  startResendCooldown()
}

async function verifySigningOtp() {
  if (!deal.dealSessionId || !otpCode.value) return
  otpError.value = ''
  try {
    const res = await verifySigningOtpMutation.mutateAsync({ dealSessionId: deal.dealSessionId, code: otpCode.value })
    signingToken.value = res.signingToken
    otpVerifiedAt.value = new Date().toISOString()
    // Persist across the MyID redirect — restored in onMounted
    sessionStorage.setItem('signing_token', res.signingToken)
    signPhase.value = 'signed'
  } catch {
    otpError.value = 'Неверный код. Попробуйте ещё раз.'
  }
}

async function startMyidSigning() {
  const pinfl = sd.value.client?.pinfl
  if (!pinfl) return
  myidError.value = ''

  // The MyID callback creates the deal FROM the session — the verification
  // step must be on the server before we leave the page
  if (!(await saveVerificationStep())) {
    myidError.value = 'Не удалось сохранить шаг. Попробуйте ещё раз.'
    return
  }

  try {
    const res = await myidSignSessionMutation.mutateAsync(pinfl)
    if (res.mock) {
      // Dev/mock mode — skip redirect, go straight to verified
      signPhase.value = 'myid_verified'
      return
    }
    if (res.redirectUrl) {
      sessionStorage.setItem('myid_sign_session_token', res.signingSessionToken)
      window.location.href = res.redirectUrl
    }
  } catch {
    myidError.value = 'Не удалось создать сессию MyID. Попробуйте ещё раз.'
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
  if (!signingToken.value || !deal.dealSessionId) return
  submitting.value = true
  submitError.value = ''
  try {
    // The deal is built FROM the session (ADR-0024): save the verification
    // step (lang + consent moment), then send only the session id + token
    if (!(await saveVerificationStep())) {
      submitError.value = 'Не удалось сохранить шаг. Попробуйте ещё раз.'
      return
    }

    const res = await createDealMutation.mutateAsync({
      dealSessionId: deal.dealSessionId,
      signingToken: signingToken.value,
    })

    sessionStorage.removeItem('signing_token')
    deal.setCreatedDealId(res.dealId, res.dealNumber)
    deal.complete('verification')
  } catch (err: any) {
    submitError.value = err?.message ?? 'Ошибка создания сделки. Попробуйте ещё раз.'
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

    <!-- Signing OTP gate -->
    <div class="sign-gate">
      <!-- idle: prompt agent to send OTP -->
      <div v-if="signPhase === 'idle'" class="gate-row">
        <div class="gate-hint">
          <i class="pi pi-shield" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.signTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.signHint', { phone: sd.client?.phone ?? '' }) }}</p>
          </div>
        </div>
        <button class="btn-gradient" :disabled="sendSigningOtpMutation.isPending.value" @click="sendSigningOtp">
          <i v-if="sendSigningOtpMutation.isPending.value" class="pi pi-spin pi-spinner" />
          <i v-else class="pi pi-send" />
          {{ $t('stepVerification.sendOtp') }}
        </button>
      </div>

      <!-- otp_sent: agent enters code received from client -->
      <div v-else-if="signPhase === 'otp_sent'" class="gate-otp">
        <div class="gate-hint">
          <i class="pi pi-mobile" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.otpSentTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.otpSentHint', { phone: sd.client?.phone ?? '' }) }}</p>
            <p v-if="devOtp" class="dev-otp">DEV: {{ devOtp }}</p>
          </div>
        </div>
        <div class="otp-row">
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

      <!-- signed: OTP verified → now verify identity with MyID -->
      <div v-else-if="signPhase === 'signed'" class="gate-row">
        <div class="gate-hint">
          <i class="pi pi-check-circle success-icon" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.signedTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.myidHint') }}</p>
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

      <!-- myid_verified: both OTP + MyID done → create deal -->
      <div v-else-if="signPhase === 'myid_verified'" class="gate-row myid-verified">
        <div class="gate-hint">
          <i class="pi pi-verified success-icon" />
          <div>
            <p class="gate-title">{{ $t('stepVerification.myidVerifiedTitle') }}</p>
            <p class="gate-sub">{{ $t('stepVerification.myidVerifiedHint') }}</p>
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
