<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useRegistrationApi } from '@/composables/useRegistrationApi'
import type { AuthUser } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const {
  sendPhoneMutation,
  verifyOtpMutation,
  submitPinflMutation,
  completeMyidMutation,
} = useRegistrationApi()

const phoneLoading = sendPhoneMutation.isPending
const otpLoading = verifyOtpMutation.isPending
const pinflLoading = submitPinflMutation.isPending
const myidLoading = completeMyidMutation.isPending

type Step = 1 | 2 | 3 | 4 | 5
const step = ref<Step>(1)

const steps = [
  { n: 1, label: 'register.stepPhone' },
  { n: 2, label: 'register.stepOtp' },
  { n: 3, label: 'register.stepIdentity' },
  { n: 4, label: 'register.stepMyid' },
  { n: 5, label: 'register.stepVerified' },
] as const

/** Reg tokens carried between steps. */
const regToken = ref('')
const myidMock = ref(false)
const devOtp = ref('')
/** Error surfaced after returning from a failed MyID redirect. */
const resumeError = ref('')

/* ── Step 1 — phone ─────────────────────────────────────────────────────── */
const phoneDigits = ref('')
const phoneError = ref('')

const phoneDisplay = computed(() => {
  const d = phoneDigits.value
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)]
    .filter(Boolean)
    .join(' ')
})
const fullPhone = computed(() => `+998${phoneDigits.value}`)

function onPhoneInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  phoneDigits.value = raw.slice(0, 9)
  phoneError.value = ''
}

async function submitPhone() {
  phoneError.value = ''
  if (phoneDigits.value.length !== 9) {
    phoneError.value = t('login.phoneError')
    return
  }
  if (sendPhoneMutation.isPending.value) return
  try {
    const data = await sendPhoneMutation.mutateAsync(phoneDigits.value)
    devOtp.value = data.devOtp ?? ''
    step.value = 2
    nextTick(() => otpRefs.value[0]?.focus())
  } catch (err) {
    const code = (err as Error).message
    phoneError.value = code === 'phone_taken' ? t('register.phoneTaken') : t('register.requestFailed')
  }
}

/* ── Step 2 — otp ───────────────────────────────────────────────────────── */
const otp = ref<string[]>(['', '', '', ''])
const otpRefs = ref<HTMLInputElement[]>([])
const otpError = ref('')

const otpCode = computed(() => otp.value.join(''))

function setOtpRef(el: unknown, idx: number) {
  if (el) otpRefs.value[idx] = el as HTMLInputElement
}

function onOtpInput(idx: number, e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  otpError.value = ''
  if (!val) {
    otp.value[idx] = ''
    return
  }
  otp.value[idx] = val.slice(-1)
  if (idx < 3) {
    nextTick(() => otpRefs.value[idx + 1]?.focus())
  } else {
    nextTick(() => submitOtp())
  }
}

function onOtpKeydown(idx: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !otp.value[idx] && idx > 0) {
    otp.value[idx - 1] = ''
    nextTick(() => otpRefs.value[idx - 1]?.focus())
  }
}

function onOtpPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '')
  if (!text) return
  for (let i = 0; i < 4; i++) otp.value[i] = text[i] ?? ''
  const target = Math.min(text.length, 4) - 1
  nextTick(() => {
    otpRefs.value[Math.max(0, target)]?.focus()
    if (otpCode.value.length === 4) submitOtp()
  })
}

async function submitOtp() {
  otpError.value = ''
  if (otpCode.value.length !== 4) {
    otpError.value = t('login.codeError')
    return
  }
  if (verifyOtpMutation.isPending.value) return
  try {
    const data = await verifyOtpMutation.mutateAsync({ phone: phoneDigits.value, code: otpCode.value })
    regToken.value = data.regToken
    step.value = 3
  } catch (err) {
    const code = (err as Error).message
    otpError.value = code === 'invalid_otp' ? t('login.invalidCode') : t('register.requestFailed')
  }
}

/* ── Step 3 — identity ──────────────────────────────────────────────────── */
const pinflDigits = ref('')
const identityError = ref('')

function onPinflInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  pinflDigits.value = raw.slice(0, 14)
  identityError.value = ''
}

async function submitIdentity() {
  identityError.value = ''
  if (pinflDigits.value.length !== 14) {
    identityError.value = t('register.pinflError')
    return
  }
  if (submitPinflMutation.isPending.value) return
  try {
    const data = await submitPinflMutation.mutateAsync({ regToken: regToken.value, pinfl: pinflDigits.value })
    regToken.value = data.regToken

    if (data.redirectUrl && !data.mock) {
      // Persist the reg token across the full-page MyID redirect — the callback
      // view restores it to complete verification on return.
      sessionStorage.setItem('myid_reg_token', data.regToken)
      step.value = 4
      window.location.href = data.redirectUrl
      return
    }

    // Mock / no-redirect fallback — complete inline (see watch on step).
    myidMock.value = true
    step.value = 4
  } catch (err) {
    const code = (err as Error).message
    identityError.value = code === 'pinfl_taken' ? t('register.pinflTaken') : t('register.requestFailed')
  }
}

/* ── Step 4 — MyID ──────────────────────────────────────────────────────── */
const myidError = ref('')
const verifiedUser = ref<AuthUser | null>(null)

async function completeMyid(code?: string) {
  myidError.value = ''
  if (myidLoading.value) return
  try {
    const data = await completeMyidMutation.mutateAsync({ regToken: regToken.value, myidCode: code })
    const user = data.user as AuthUser
    auth.setUser(user)
    verifiedUser.value = user
    step.value = 5
  } catch (err) {
    const code = (err as Error).message
    myidError.value = code === 'pinfl_taken' ? t('register.pinflTaken')
      : code === 'pinfl_mismatch' ? t('register.pinflMismatch')
        : t('register.requestFailed')
  }
}


onMounted(() => {
  // Returned from a failed MyID redirect — restart the wizard with an error.
  const failed = sessionStorage.getItem('myid_reg_failed')
  if (failed) {
    sessionStorage.removeItem('myid_reg_failed')
    resumeError.value = failed === 'pinfl_taken' ? t('register.pinflTaken')
      : failed === 'pinfl_mismatch' ? t('register.pinflMismatch')
        : t('register.requestFailed')
  }
})


// Auto-complete when MYID_MOCK mode and we reach step 4
watch(step, (s) => {
  if (s === 4 && myidMock.value) {
    setTimeout(() => completeMyid(), 600)
  }
})

function goToLogin() {
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="auth-page">
    <!-- ── Left hero panel (mirrors LoginView) ──────────────────────────── -->
    <div class="auth-hero">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
      <div class="dot-grid" />

      <div class="glass-card fc-deal">
        <div class="gc-header">
          <span class="gc-dot dot-amber" />
          <span class="gc-tag">{{ $t('login.heroTag') }}</span>
          <span class="gc-id font-mono">#DEAL-1001</span>
        </div>
        <div class="gc-amount font-mono">
          1,399,167 <span class="gc-currency">{{ $t('login.heroSom') }}</span>
        </div>
        <div class="gc-meta">
          <span class="gc-avatar">TS</span>
          <div>
            <div class="gc-name">TechShop Tashkent</div>
            <div class="gc-sub">Due Jul 15 · 12 {{ $t('common.mo') }}</div>
          </div>
        </div>
        <div class="gc-progress-row">
          <span class="gc-sub">3 / 6 {{ $t('login.heroPaid') }}</span>
          <div class="gc-pill-row">
            <span v-for="i in 6" :key="i" class="gc-pill" :class="{ filled: i <= 3 }" />
          </div>
        </div>
      </div>

      <div class="glass-card fc-paid">
        <div class="gc-header">
          <i class="pi pi-check-circle" style="font-size: 0.85rem; color: #00d4aa" />
          <span class="gc-tag">{{ $t('login.heroPayConfirmed') }}</span>
        </div>
        <div class="gc-amount font-mono">
          1,399,167 <span class="gc-currency">{{ $t('login.heroSom') }}</span>
        </div>
        <div class="gc-sub">Paid Jun 15 via Payme</div>
      </div>

      <div class="glass-card fc-schedule">
        <div class="gc-header">
          <i class="pi pi-calendar" style="font-size: 0.8rem; opacity: 0.7" />
          <span class="gc-tag">{{ $t('login.heroSchedule') }}</span>
        </div>
        <div class="sch-list">
          <div class="sch-row done">
            <i class="pi pi-check-circle" />
            <span class="font-mono">May 15</span>
            <span class="sch-amt font-mono">1,399,167</span>
          </div>
          <div class="sch-row done">
            <i class="pi pi-check-circle" />
            <span class="font-mono">Jun 15</span>
            <span class="sch-amt font-mono">1,399,167</span>
          </div>
          <div class="sch-row upcoming">
            <i class="pi pi-clock" />
            <span class="font-mono">Jul 15</span>
            <span class="sch-amt font-mono">1,399,167</span>
          </div>
          <div class="sch-row future">
            <span class="sch-dots">· · ·</span>
            <span class="gc-sub">9 {{ $t('login.heroMore') }}</span>
          </div>
        </div>
      </div>

      <div class="hero-brand">
        <div class="logo-mark">S</div>
        <div>
          <h1 class="brand-title">Scoring</h1>
          <p class="brand-sub">{{ $t('login.heroBrandSub') }}</p>
        </div>
      </div>
    </div>

    <!-- ── Right: wizard card ───────────────────────────────────────────── -->
    <div class="auth-form-wrap">
      <div class="auth-card surface-card">
        <div class="mobile-brand">
          <div class="logo-mark sm">S</div>
          <span class="brand-title sm">Scoring</span>
        </div>

        <!-- progress indicator -->
        <div class="stepper">
          <div v-for="s in steps" :key="s.n" class="step-item" :class="{ active: step === s.n, done: step > s.n }">
            <div class="step-dot">
              <i v-if="step > s.n" class="pi pi-check" />
              <span v-else>{{ s.n }}</span>
            </div>
            <span class="step-label">{{ $t(s.label) }}</span>
          </div>
        </div>

        <!-- error after returning from a failed MyID redirect -->
        <div v-if="resumeError && step === 1" class="resume-error">
          <i class="pi pi-exclamation-circle" /> {{ resumeError }}
        </div>

        <!-- step 1: phone -->
        <template v-if="step === 1">
          <h2>{{ $t('register.phoneTitle') }}</h2>
          <p class="sub">{{ $t('register.phoneSub') }}</p>

          <div class="field">
            <label class="field-label" for="reg-phone">{{ $t('login.phoneLabel') }}</label>
            <div class="phone-input" :class="{ invalid: !!phoneError }">
              <span class="prefix font-mono">+998</span>
              <input id="reg-phone" class="phone-field font-mono" inputmode="numeric" autocomplete="tel"
                placeholder="00 000 00 00" :value="phoneDisplay" @input="onPhoneInput" @keyup.enter="submitPhone" />
            </div>
            <span v-if="phoneError" class="field-error">{{ phoneError }}</span>
          </div>

          <button class="btn-gradient submit" :disabled="phoneLoading" @click="submitPhone">
            <i v-if="phoneLoading" class="pi pi-spin pi-spinner" />
            <span v-else>{{ $t('register.next') }}</span>
          </button>

          <button class="link-btn" @click="goToLogin">
            {{ $t('register.haveAccount') }} <strong>{{ $t('register.signIn') }}</strong>
          </button>
        </template>

        <!-- step 2: otp -->
        <template v-else-if="step === 2">
          <button class="back-link" @click="step = 1">
            <i class="pi pi-arrow-left" /> {{ $t('register.back') }}
          </button>
          <h2>{{ $t('register.otpTitle') }}</h2>
          <p class="sub">{{ $t('register.otpSub', { phone: fullPhone }) }}</p>

          <div class="otp-row" @paste="onOtpPaste">
            <input v-for="(_, idx) in otp" :key="idx" :ref="(el) => setOtpRef(el, idx)" class="otp-box font-mono"
              :class="{ invalid: !!otpError }" type="text" inputmode="numeric" maxlength="1" :value="otp[idx]"
              @input="onOtpInput(idx, $event)" @keydown="onOtpKeydown(idx, $event)" />
          </div>
          <span v-if="otpError" class="field-error center">{{ otpError }}</span>

          <div v-if="devOtp" class="dev-otp">
            DEV OTP: <strong class="font-mono">{{ devOtp }}</strong>
          </div>

          <button class="btn-gradient submit" :disabled="otpLoading" @click="submitOtp">
            <i v-if="otpLoading" class="pi pi-spin pi-spinner" />
            <span v-else>{{ $t('register.next') }}</span>
          </button>
        </template>

        <!-- step 3: identity -->
        <template v-else-if="step === 3">
          <button class="back-link" @click="step = 2">
            <i class="pi pi-arrow-left" /> {{ $t('register.back') }}
          </button>
          <h2>{{ $t('register.identityTitle') }}</h2>
          <p class="sub">{{ $t('register.identitySub') }}</p>

          <div class="field">
            <label class="field-label" for="reg-pinfl">{{ $t('register.pinflLabel') }}</label>
            <input id="reg-pinfl" class="text-field font-mono" type="text" inputmode="numeric"
              :placeholder="$t('register.pinflPlaceholder')" :value="pinflDigits" @input="onPinflInput"
              @keyup.enter="submitIdentity" />
            <span v-if="identityError" class="field-error">{{ identityError }}</span>
          </div>

          <button class="btn-gradient submit" :disabled="pinflLoading" @click="submitIdentity">
            <i v-if="pinflLoading" class="pi pi-spin pi-spinner" />
            <span v-else>{{ $t('register.next') }}</span>
          </button>
        </template>

        <!-- step 4: myid -->
        <template v-else-if="step === 4">
          <div class="myid">
            <div class="myid-shield">
              <i v-if="myidLoading" class="pi pi-spin pi-spinner" />
              <i v-else class="pi pi-shield" />
            </div>
            <h2>{{ $t('register.myidTitle') }}</h2>
            <p class="sub center">{{ myidLoading ? $t('register.myidVerifying') : $t('register.myidSub') }}</p>

            <span v-if="myidError" class="field-error center">{{ myidError }}</span>
          </div>
        </template>

        <!-- step 5: verified -->
        <template v-else>
          <div class="verified">
            <div class="verified-icon">
              <i class="pi pi-check-circle" />
            </div>
            <h2>{{ $t('register.verifiedTitle') }}</h2>
            <p class="sub center">{{ $t('register.verifiedSub') }}</p>

            <div class="verified-grid">
              <div class="vf">
                <span class="vf-label">{{ $t('register.verifiedName') }}</span>
                <span class="vf-value">{{ verifiedUser?.firstName }} {{ verifiedUser?.lastName }}</span>
              </div>
              <div class="vf">
                <span class="vf-label">{{ $t('register.verifiedPhone') }}</span>
                <span class="vf-value font-mono">{{ verifiedUser?.phone }}</span>
              </div>
              <div class="vf">
                <span class="vf-label">{{ $t('register.verifiedPinfl') }}</span>
                <span class="vf-value font-mono">{{ pinflDigits }}</span>
              </div>
              <div class="vf">
                <span class="vf-label">{{ $t('register.verifiedBirth') }}</span>
                <span class="vf-value">{{ verifiedUser?.birthDate }}</span>
              </div>
              <div v-if="verifiedUser?.passportSerial" class="vf">
                <span class="vf-label">{{ $t('register.verifiedPassport') }}</span>
                <span class="vf-value font-mono">{{ verifiedUser.passportSerial }} {{ verifiedUser.passportNumber
                }}</span>
              </div>
            </div>

            <button class="btn-gradient submit" @click="router.push({ name: 'home' })">
              {{ $t('register.goHome') }} <i class="pi pi-arrow-right" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

.auth-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, #4c3dd0 0%, #7b68ee 40%, #9d4edd 75%, #c77dff 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 2.5rem;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  pointer-events: none;
}

.orb-1 {
  width: 420px;
  height: 420px;
  background: rgba(255, 255, 255, 0.18);
  top: -80px;
  right: -100px;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: rgba(123, 104, 238, 0.5);
  bottom: 80px;
  left: -80px;
}

.orb-3 {
  width: 200px;
  height: 200px;
  background: rgba(199, 125, 255, 0.35);
  top: 42%;
  left: 55%;
}

.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
}

.glass-card {
  position: absolute;
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 18px;
  padding: 1rem 1.15rem;
  color: #fff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}

.fc-deal {
  top: 6%;
  left: 50%;
  transform: translateX(-45%) rotate(-2deg);
  width: 250px;
  animation: float1 5s ease-in-out infinite;
}

.fc-paid {
  top: 40%;
  left: 4%;
  width: 210px;
  transform: rotate(2deg);
  animation: float2 6s ease-in-out infinite;
}

.fc-schedule {
  top: 34%;
  right: 4%;
  width: 205px;
  transform: rotate(-2.5deg);
  animation: float3 7s ease-in-out infinite;
}

.gc-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
}

.gc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-amber {
  background: #ffb02e;
  box-shadow: 0 0 6px #ffb02e;
}

.gc-tag {
  font-size: 0.72rem;
  font-weight: 700;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

.gc-id {
  font-size: 0.68rem;
  opacity: 0.55;
}

.gc-amount {
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.65rem;
}

.gc-currency {
  font-size: 0.7em;
  font-weight: 600;
  opacity: 0.75;
}

.gc-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.65rem;
}

.gc-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  font-size: 0.7rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.gc-name {
  font-size: 0.82rem;
  font-weight: 700;
}

.gc-sub {
  font-size: 0.7rem;
  opacity: 0.6;
}

.gc-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.gc-pill-row {
  display: flex;
  gap: 2px;
}

.gc-pill {
  width: 12px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
}

.gc-pill.filled {
  background: #00d4aa;
}

.sch-list {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
}

.sch-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
}

.sch-row.done {
  opacity: 0.6;
}

.sch-row.done i {
  color: #00d4aa;
}

.sch-row.upcoming {
  font-weight: 700;
}

.sch-row.upcoming i {
  color: #ffb02e;
}

.sch-row.future {
  opacity: 0.4;
  font-size: 0.7rem;
}

.sch-amt {
  margin-left: auto;
  font-size: 0.72rem;
}

.sch-dots {
  letter-spacing: 0.15em;
}

.hero-brand {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: grid;
  place-items: center;
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.brand-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.brand-sub {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.7);
}

@keyframes float1 {

  0%,
  100% {
    transform: translateX(-45%) rotate(-2deg) translateY(0);
  }

  50% {
    transform: translateX(-45%) rotate(-2deg) translateY(-10px);
  }
}

@keyframes float2 {

  0%,
  100% {
    transform: rotate(2deg) translateY(0);
  }

  50% {
    transform: rotate(2deg) translateY(-12px);
  }
}

@keyframes float3 {

  0%,
  100% {
    transform: rotate(-2.5deg) translateY(0);
  }

  50% {
    transform: rotate(-2.5deg) translateY(-9px);
  }
}

.auth-form-wrap {
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--bg-base);
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2.4rem;
}

.mobile-brand {
  display: none;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 1.6rem;
}

.logo-mark.sm {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-hero);
  border: none;
  font-size: 1rem;
}

.brand-title.sm {
  font-size: 1.25rem;
  color: var(--text-primary);
}

/* stepper */
.stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
  margin-bottom: 1.8rem;
}

.step-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  position: relative;
}

.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 13px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: var(--border-subtle);
  z-index: 0;
}

.step-item.done:not(:last-child)::after {
  background: var(--accent-1);
}

.step-dot {
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  font-weight: 800;
  background: var(--bg-base);
  border: 2px solid var(--border-subtle);
  color: var(--text-secondary);
}

.step-item.active .step-dot {
  border-color: var(--accent-1);
  color: var(--accent-2);
}

.step-item.done .step-dot {
  background: var(--accent-1);
  border-color: var(--accent-1);
  color: #fff;
}

.step-label {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}

.step-item.active .step-label {
  color: var(--text-primary);
}

.auth-card h2 {
  margin: 0 0 0.35rem;
  font-size: 1.55rem;
  font-weight: 800;
}

.sub {
  margin: 0 0 1.8rem;
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.5;
}

.sub.center {
  text-align: center;
}

.field {
  margin-bottom: 1.2rem;
}

.phone-input {
  display: flex;
  align-items: center;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.phone-input:focus-within {
  border-color: var(--accent-1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-1) 20%, transparent);
}

.phone-input.invalid {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
}

.phone-input .prefix {
  padding: 0.85rem 0.6rem 0.85rem 1rem;
  color: var(--text-secondary);
  font-weight: 700;
  border-right: 1px solid var(--border-subtle);
}

.phone-field {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  color: var(--text-primary);
  letter-spacing: 0.06em;
}

.phone-field::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.text-field {
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-base);
  padding: 0.85rem 1rem;
  font-size: 1rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.text-field:focus {
  border-color: var(--accent-1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-1) 20%, transparent);
}

.text-field::placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.field-error {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.8rem;
  color: var(--danger);
}

.field-error.center {
  text-align: center;
  margin-bottom: 0.6rem;
}

.submit {
  width: 100%;
  margin-top: 0.4rem;
}

.submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.link-btn {
  width: 100%;
  margin-top: 1rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.88rem;
  cursor: pointer;
  text-align: center;
}

.link-btn strong {
  color: var(--accent-2);
  font-weight: 700;
}

.link-btn:hover strong {
  text-decoration: underline;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
}

.back-link:hover {
  color: var(--accent-2);
}

.otp-row {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.otp-box {
  width: 100%;
  aspect-ratio: 1;
  text-align: center;
  font-size: 1.7rem;
  font-weight: 700;
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  background: var(--bg-base);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.otp-box:focus {
  border-color: var(--accent-1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-1) 20%, transparent);
}

.otp-box.invalid {
  border-color: var(--danger);
}

.dev-otp {
  margin-bottom: 0.9rem;
  padding: 0.6rem 0.8rem;
  border: 1px dashed var(--border-subtle);
  border-radius: 10px;
  font-size: 0.8rem;
  text-align: center;
  color: var(--text-secondary);
}

.dev-otp strong {
  color: var(--accent-2);
  font-size: 1rem;
  letter-spacing: 0.15em;
}

/* myid step */
.myid {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 0.5rem;
}

.myid-shield {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  margin-bottom: 1.3rem;
  font-size: 2.3rem;
  color: #16a34a;
  background: color-mix(in srgb, #16a34a 14%, transparent);
  border: 1px solid color-mix(in srgb, #16a34a 35%, transparent);
}

.myid .submit {
  width: 100%;
  margin-top: 1rem;
}

.resume-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.4rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--danger);
}

/* verified step */
.verified {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding-top: 0.5rem;
}

.verified-icon {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  margin-bottom: 1.3rem;
  font-size: 2.3rem;
  color: #16a34a;
  background: color-mix(in srgb, #16a34a 14%, transparent);
  border: 1px solid color-mix(in srgb, #16a34a 35%, transparent);
}

.verified-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 1.4rem 0 1.6rem;
  text-align: left;
}

.vf {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.vf:last-child {
  border-bottom: none;
}

.vf-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.vf-value {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: right;
}

.verified .submit {
  width: 100%;
}

@media (max-width: 860px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .auth-card {
    padding: 20px
  }

  .auth-hero {
    display: none;
  }

  .auth-form-wrap {
    background: var(--bg-surface);
    padding: 15px;
    align-content: center;
    min-height: 100svh;
  }

  .mobile-brand {
    display: flex;
  }
}
</style>
