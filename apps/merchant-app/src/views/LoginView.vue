<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Dialog from 'primevue/dialog'
import { useAuthStore } from '@/stores/auth'
import type { Employee, EmployeeRole } from '@/types'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const schema = toTypedSchema(
  z.object({
    email: z.string().min(1, t('login.emailRequired')).email(t('login.emailInvalid')),
    password: z.string().min(1, t('login.passwordRequired')),
  }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { email: '', password: '' },
})

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const loginError = ref('')
const pendingEmployee = ref<Employee | null>(null)
const showRolePicker = ref(false)

function finish(employee: Employee, role: EmployeeRole) {
  auth.login(employee, role)
  router.push('/')
}

const onSubmit = handleSubmit((values) => {
  loginError.value = ''
  const employee = auth.validate(values.email, values.password)
  if (!employee) {
    loginError.value = t('login.invalidCredentials')
    return
  }
  if (employee.roles.length > 1) {
    pendingEmployee.value = employee
    showRolePicker.value = true
  } else {
    finish(employee, employee.roles[0])
  }
})

function pickRole(role: EmployeeRole) {
  if (pendingEmployee.value) {
    showRolePicker.value = false
    finish(pendingEmployee.value, role)
  }
}
</script>

<template>
  <div class="auth-page">

    <!-- ── Left hero panel ─────────────────────────────────────────────── -->
    <div class="auth-hero">
      <!-- background orbs -->
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />
      <!-- dot grid -->
      <div class="dot-grid" />

      <!-- floating card 1: approved deal -->
      <div class="glass-card fc-deal">
        <div class="gc-header">
          <span class="gc-dot dot-green" />
          <span class="gc-tag">{{ $t('login.dealApproved') }}</span>
          <span class="gc-id font-mono">#DEAL-1041</span>
        </div>
        <div class="gc-amount font-mono">14,990,000 <span class="gc-currency">{{ $t('login.som') }}</span></div>
        <div class="gc-meta">
          <span class="gc-avatar">JR</span>
          <div>
            <div class="gc-name">Jasur Rahimov</div>
            <div class="gc-sub">12 {{ $t('login.months') }} · {{ $t('login.markup') }} 12%</div>
          </div>
        </div>
        <div class="gc-progress-row">
          <span class="gc-sub">3 / 12 {{ $t('login.paid') }}</span>
          <div class="gc-pill-row">
            <span v-for="i in 12" :key="i" class="gc-pill" :class="{ filled: i <= 3 }" />
          </div>
        </div>
      </div>

      <!-- floating card 2: credit score -->
      <div class="glass-card fc-score">
        <div class="gc-header">
          <span class="gc-tag">{{ $t('login.creditScore') }}</span>
          <span class="gc-dot dot-green" />
        </div>
        <div class="score-display">
          <span class="score-num font-mono">742</span>
          <span class="score-max">&thinsp;/ 1000</span>
        </div>
        <div class="score-track">
          <div class="score-fill" style="width: 74.2%" />
        </div>
        <div class="score-labels">
          <span class="score-badge approved">{{ $t('login.approved') }}</span>
          <span class="gc-sub">KATM · MyID</span>
        </div>
      </div>

      <!-- floating card 3: payment schedule -->
      <div class="glass-card fc-schedule">
        <div class="gc-header">
          <i class="pi pi-calendar" style="font-size:0.8rem;opacity:0.7" />
          <span class="gc-tag">{{ $t('login.paymentSchedule') }}</span>
        </div>
        <div class="sch-list">
          <div class="sch-row done">
            <i class="pi pi-check-circle" />
            <span class="font-mono">May 15</span>
            <span class="sch-amt font-mono">1,249,167</span>
          </div>
          <div class="sch-row done">
            <i class="pi pi-check-circle" />
            <span class="font-mono">Jun 15</span>
            <span class="sch-amt font-mono">1,249,167</span>
          </div>
          <div class="sch-row upcoming">
            <i class="pi pi-clock" />
            <span class="font-mono">Jul 15</span>
            <span class="sch-amt font-mono">1,249,167</span>
          </div>
          <div class="sch-row future">
            <span class="sch-dots">· · ·</span>
            <span class="gc-sub">9 {{ $t('login.morePayments') }}</span>
          </div>
        </div>
      </div>

      <!-- floating card 4: mini stats strip -->
      <div class="glass-card fc-stats">
        <div class="stat-item">
          <span class="stat-num font-mono">24</span>
          <span class="stat-lbl">{{ $t('login.activeDeals') }}</span>
        </div>
        <div class="stat-sep" />
        <div class="stat-item">
          <span class="stat-num font-mono">98%</span>
          <span class="stat-lbl">{{ $t('login.onTime') }}</span>
        </div>
        <div class="stat-sep" />
        <div class="stat-item">
          <span class="stat-num font-mono">4.2M</span>
          <span class="stat-lbl">{{ $t('login.disbursed') }}</span>
        </div>
      </div>

      <!-- bottom brand content -->
      <div class="hero-brand">
        <div class="logo-mark">S</div>
        <div>
          <h1 class="brand-title">Scoring</h1>
          <p class="brand-sub">{{ $t('login.brandSub') }}</p>
        </div>
      </div>
    </div>

    <!-- ── Right: login form ───────────────────────────────────────────── -->
    <div class="auth-form-wrap">
      <form class="auth-card surface-card" @submit="onSubmit">
        <h2>{{ $t('login.welcome') }}</h2>
        <p class="sub">{{ $t('login.subtitle') }}</p>

        <div class="field">
          <label class="field-label" for="email">{{ $t('login.email') }}</label>
          <InputText
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            placeholder="admin@demo.com"
            :invalid="!!errors.email"
            autocomplete="username"
          />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="password">{{ $t('login.password') }}</label>
          <Password
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            :feedback="false"
            toggle-mask
            placeholder="password"
            :invalid="!!errors.password"
            input-class="w-full"
            fluid
          />
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <p v-if="loginError" class="login-error">
          <i class="pi pi-exclamation-triangle" /> {{ loginError }}
        </p>

        <button type="submit" class="btn-gradient submit">{{ $t('login.signIn') }}</button>

        <div class="hint">
          <strong>{{ $t('login.demoAccounts') }}</strong>
          <span><code>admin@demo.com</code> / <code>password</code> — {{ $t('login.demoBothRoles') }}</span>
          <span><code>agent@demo.com</code> / <code>password</code> — {{ $t('login.demoAgentOnly') }}</span>
        </div>
      </form>
    </div>

    <!-- role picker dialog -->
    <Dialog
      v-model:visible="showRolePicker"
      modal
      :header="$t('login.chooseRole')"
      :style="{ width: '420px' }"
      :closable="false"
    >
      <p class="role-intro">
        {{ $t('login.roleIntro') }}
      </p>
      <div class="role-grid">
        <button class="role-card" @click="pickRole('merchant_admin')">
          <i class="pi pi-shield" />
          <strong>{{ $t('login.merchantAdmin') }}</strong>
          <small>{{ $t('login.merchantAdminDesc') }}</small>
        </button>
        <button class="role-card" @click="pickRole('agent')">
          <i class="pi pi-user-plus" />
          <strong>{{ $t('login.agent') }}</strong>
          <small>{{ $t('login.agentDesc') }}</small>
        </button>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────── */
.auth-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* ── Hero panel ─────────────────────────────────────────────────────────── */
.auth-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, #4c3dd0 0%, #7b68ee 40%, #9d4edd 75%, #c77dff 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 2.5rem;
}

/* background orbs */
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

/* dot grid overlay */
.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
}

/* ── Floating glass cards ───────────────────────────────────────────────── */
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

/* deal card */
.fc-deal {
  top: 5%;
  left: 50%;
  transform: translateX(-45%) rotate(-2deg);
  width: 240px;
  animation: float1 5s ease-in-out infinite;
}

/* score card */
.fc-score {
  top: 36%;
  left: 4%;
  width: 180px;
  transform: rotate(2deg);
  animation: float2 6s ease-in-out infinite;
}

/* schedule card */
.fc-schedule {
  top: 30%;
  right: 4%;
  width: 200px;
  transform: rotate(-2.5deg);
  animation: float3 7s ease-in-out infinite;
}

/* stats strip */
.fc-stats {
  top: 66%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1.3rem;
  animation: float4 5.5s ease-in-out infinite;
}

/* ── Card internals ─────────────────────────────────────────────────────── */
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
.dot-green { background: #00d4aa; box-shadow: 0 0 6px #00d4aa; }

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
  background: rgba(255,255,255,0.25);
  font-size: 0.7rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.gc-name { font-size: 0.82rem; font-weight: 700; }
.gc-sub { font-size: 0.7rem; opacity: 0.6; }

.gc-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.gc-pill-row { display: flex; gap: 2px; }
.gc-pill {
  width: 12px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255,255,255,0.25);
  transition: background 0.2s;
}
.gc-pill.filled { background: #00d4aa; }

/* score card */
.score-display {
  display: flex;
  align-items: baseline;
  gap: 0;
  margin-bottom: 0.5rem;
}
.score-num {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
}
.score-max {
  font-size: 0.8rem;
  opacity: 0.55;
}
.score-track {
  height: 5px;
  background: rgba(255,255,255,0.2);
  border-radius: 999px;
  margin-bottom: 0.55rem;
  overflow: hidden;
}
.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d4aa, #7b68ee);
  border-radius: 999px;
}
.score-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.score-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.score-badge.approved { background: rgba(0,212,170,0.25); color: #00d4aa; }

/* schedule card */
.sch-list { display: flex; flex-direction: column; gap: 0.42rem; }
.sch-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
}
.sch-row.done { opacity: 0.6; }
.sch-row.done i { color: #00d4aa; }
.sch-row.upcoming { font-weight: 700; }
.sch-row.upcoming i { color: #ffb02e; }
.sch-row.future { opacity: 0.4; font-size: 0.7rem; }
.sch-amt { margin-left: auto; font-size: 0.72rem; }
.sch-dots { letter-spacing: 0.15em; }

/* stats strip */
.stat-item { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
.stat-num { font-size: 1.1rem; font-weight: 800; }
.stat-lbl { font-size: 0.65rem; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.stat-sep { width: 1px; height: 28px; background: rgba(255,255,255,0.25); }

/* ── Bottom brand ───────────────────────────────────────────────────────── */
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
  border: 1px solid rgba(255,255,255,0.3);
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
  color: rgba(255,255,255,0.7);
}

/* ── Float animations ───────────────────────────────────────────────────── */
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
@keyframes float4 {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%       { transform: translateX(-50%) translateY(-7px); }
}

/* ── Right side ─────────────────────────────────────────────────────────── */
.auth-form-wrap {
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--bg-base);
}
.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 2.2rem;
}
.auth-card h2 {
  margin: 0 0 0.3rem;
  font-size: 1.5rem;
  font-weight: 800;
}
.sub {
  margin: 0 0 1.8rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.field { margin-bottom: 1.1rem; }
.field :deep(.p-password) { width: 100%; }
.submit { width: 100%; margin-top: 0.4rem; }
.login-error {
  color: var(--danger);
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.8rem;
}
.hint {
  margin-top: 1.6rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.hint code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-2);
}

/* role picker */
.role-intro {
  color: var(--text-secondary);
  font-size: 0.88rem;
  margin: 0 0 1.2rem;
}
.role-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}
.role-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 1.1rem;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.role-card:hover {
  border-color: var(--accent-2);
  box-shadow: var(--accent-glow);
}
.role-card i { font-size: 1.4rem; color: var(--accent-2); }
.role-card strong { font-size: 0.95rem; }
.role-card small { color: var(--text-secondary); font-size: 0.74rem; }

@media (max-width: 767px) {
  .auth-page {
    grid-template-columns: 1fr;
  }
  .auth-hero {
    display: none;
  }
  .auth-form-wrap {
    padding: 1.5rem 1rem;
    align-items: flex-start;
    padding-top: 3rem;
  }
  .auth-card {
    max-width: 100%;
    padding: 1.6rem 1.2rem;
  }
}
</style>
