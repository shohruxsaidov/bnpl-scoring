<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

type Step = 'phone' | 'otp'
const step = ref<Step>('phone')

/* ── Phone step ──────────────────────────────────────────────────────────── */
const phoneDigits = ref('')
const phoneError = ref('')

const phoneDisplay = computed(() => {
  const d = phoneDigits.value
  const parts = [
    d.slice(0, 2),
    d.slice(2, 5),
    d.slice(5, 7),
    d.slice(7, 9),
  ].filter(Boolean)
  return parts.join(' ')
})

function onPhoneInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  phoneDigits.value = raw.slice(0, 9)
  phoneError.value = ''
}

const fullPhone = computed(() => `+998${phoneDigits.value}`)

function submitPhone() {
  phoneError.value = ''
  if (phoneDigits.value.length !== 9) {
    phoneError.value = t('login.phoneError')
    return
  }
  const ok = auth.requestOtp(fullPhone.value)
  if (!ok) {
    phoneError.value = t('login.noAccount')
    return
  }
  step.value = 'otp'
  startCountdown()
  nextTick(() => otpRefs.value[0]?.focus())
}

/* ── OTP step ────────────────────────────────────────────────────────────── */
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

function submitOtp() {
  otpError.value = ''
  if (otpCode.value.length !== 4) {
    otpError.value = t('login.codeError')
    return
  }
  const ok = auth.verifyOtp(otpCode.value)
  if (!ok) {
    otpError.value = t('login.invalidCode')
    return
  }
  router.push({ name: 'home' })
}

/* ── Resend countdown ────────────────────────────────────────────────────── */
const seconds = ref(59)
let timer: ReturnType<typeof setInterval> | null = null

function startCountdown() {
  seconds.value = 59
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    if (seconds.value > 0) {
      seconds.value -= 1
    } else if (timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

function resend() {
  if (seconds.value > 0) return
  otp.value = ['', '', '', '']
  otpError.value = ''
  startCountdown()
  nextTick(() => otpRefs.value[0]?.focus())
}

function backToPhone() {
  step.value = 'phone'
  otp.value = ['', '', '', '']
  otpError.value = ''
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="auth-page">
    <!-- ── Left hero panel ──────────────────────────────────────────────── -->
    <div class="auth-hero">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
      <div class="dot-grid" />

      <!-- floating card 1: next payment -->
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
          <span class="gc-sub">3 / 12 {{ $t('login.heroPaid') }}</span>
          <div class="gc-pill-row">
            <span
              v-for="i in 12"
              :key="i"
              class="gc-pill"
              :class="{ filled: i <= 3 }"
            />
          </div>
        </div>
      </div>

      <!-- floating card 2: payment confirmed -->
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

      <!-- floating card 3: schedule -->
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

    <!-- ── Right: auth form ─────────────────────────────────────────────── -->
    <div class="auth-form-wrap">
      <div class="auth-card surface-card">
        <div class="mobile-brand">
          <div class="logo-mark sm">S</div>
          <span class="brand-title sm">Scoring</span>
        </div>

        <!-- step: phone -->
        <template v-if="step === 'phone'">
          <h2>{{ $t('login.welcome') }}</h2>
          <p class="sub">{{ $t('login.subtitle') }}</p>

          <div class="field">
            <label class="field-label" for="phone">{{ $t('login.phoneLabel') }}</label>
            <div class="phone-input" :class="{ invalid: !!phoneError }">
              <span class="prefix font-mono">+998</span>
              <input
                id="phone"
                class="phone-field font-mono"
                inputmode="numeric"
                autocomplete="tel"
                placeholder="91 555 22 33"
                :value="phoneDisplay"
                @input="onPhoneInput"
                @keyup.enter="submitPhone"
              />
            </div>
            <span v-if="phoneError" class="field-error">{{ phoneError }}</span>
          </div>

          <button class="btn-gradient submit" @click="submitPhone">
            {{ $t('login.sendOtp') }}
          </button>

          <div class="hint">
            <strong>{{ $t('login.demoAccount') }}</strong>
            <span>{{ $t('login.demoHint', { phone: '+998 91 555 22 33' }) }}</span>
          </div>
        </template>

        <!-- step: otp -->
        <template v-else>
          <button class="back-link" @click="backToPhone">
            <i class="pi pi-arrow-left" /> {{ $t('login.changeNumber') }}
          </button>
          <h2>{{ $t('login.enterCode') }}</h2>
          <p class="sub">
            {{ $t('login.codeSentTo') }}
            <strong class="font-mono">{{ fullPhone }}</strong>
          </p>

          <div class="otp-row" @paste="onOtpPaste">
            <input
              v-for="(_, idx) in otp"
              :key="idx"
              :ref="(el) => setOtpRef(el, idx)"
              class="otp-box font-mono"
              :class="{ invalid: !!otpError }"
              type="text"
              inputmode="numeric"
              maxlength="1"
              :value="otp[idx]"
              @input="onOtpInput(idx, $event)"
              @keydown="onOtpKeydown(idx, $event)"
            />
          </div>
          <span v-if="otpError" class="field-error center">{{ otpError }}</span>

          <button class="btn-gradient submit" @click="submitOtp">
            {{ $t('login.verifySignIn') }}
          </button>

          <div class="resend">
            <span v-if="seconds > 0" class="font-mono">
              {{ $t('login.resendIn', { sec: seconds }) }}
            </span>
            <button v-else class="resend-btn" @click="resend">
              {{ $t('login.resendCode') }}
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
  0%, 100% { transform: translateX(-45%) rotate(-2deg) translateY(0); }
  50%       { transform: translateX(-45%) rotate(-2deg) translateY(-10px); }
}
@keyframes float2 {
  0%, 100% { transform: rotate(2deg) translateY(0); }
  50%       { transform: rotate(2deg) translateY(-12px); }
}
@keyframes float3 {
  0%, 100% { transform: rotate(-2.5deg) translateY(0); }
  50%       { transform: rotate(-2.5deg) translateY(-9px); }
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
.submit {
  width: 100%;
  margin-top: 0.4rem;
}
.hint {
  margin-top: 1.7rem;
  padding-top: 1.3rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.hint code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-2);
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
.field-error.center {
  text-align: center;
  margin-bottom: 0.6rem;
}
.resend {
  text-align: center;
  margin-top: 1.3rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.resend-btn {
  background: transparent;
  border: none;
  color: var(--accent-2);
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}
.resend-btn:hover {
  text-decoration: underline;
}

@media (max-width: 860px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
  .auth-hero {
    display: none;
  }
  .auth-form-wrap {
    background: var(--bg-surface);
    padding: 1.25rem;
    align-content: center;
  }
  .mobile-brand {
    display: flex;
  }
}
</style>
