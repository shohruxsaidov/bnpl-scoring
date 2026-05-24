<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import { useAuthStore } from '@/stores/auth'

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
const loading = ref(false)

const onSubmit = handleSubmit(async (values) => {
  loginError.value = ''
  loading.value = true
  try {
    await auth.login(values.email, values.password)
    router.push('/')
  } catch {
    loginError.value = t('login.invalidCredentials')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="orb orb-1" />
    <div class="orb orb-2" />
    <div class="dot-grid" />

    <div class="auth-stack">
      <div class="brand-head">
        <div class="logo-mark">S</div>
        <div>
          <h1 class="brand-title">Scoring</h1>
          <span class="brand-badge">{{ $t('login.platformAdmin') }}</span>
        </div>
      </div>

      <form class="auth-card surface-card" @submit="onSubmit">
        <h2>{{ $t('login.signIn') }}</h2>
        <p class="sub">{{ $t('login.subtitle') }}</p>

        <div class="field">
          <label class="field-label" for="email">{{ $t('login.email') }}</label>
          <InputText
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            placeholder="platform@scoring.uz"
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
            placeholder="admin123"
            :invalid="!!errors.password"
            input-class="w-full"
            fluid
          />
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <p v-if="loginError" class="login-error">
          <i class="pi pi-exclamation-triangle" /> {{ loginError }}
        </p>

        <button type="submit" class="btn-gradient submit" :disabled="loading">
          {{ loading ? $t('login.signingIn') : $t('login.signIn') }}
        </button>

        <div class="hint">
          <strong>{{ $t('login.demoAccount') }}</strong>
          <span><code>platform@scoring.uz</code> / <code>admin123</code></span>
        </div>
      </form>

      <p class="foot">{{ $t('login.footer') }}</p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #2a2342 0%, #4c3dd0 45%, #7b68ee 75%, #9d4edd 100%);
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.orb-1 {
  width: 460px;
  height: 460px;
  background: rgba(157, 78, 221, 0.45);
  top: -120px;
  right: -120px;
}
.orb-2 {
  width: 340px;
  height: 340px;
  background: rgba(123, 104, 238, 0.5);
  bottom: -100px;
  left: -90px;
}
.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px);
  background-size: 30px 30px;
  pointer-events: none;
}
.auth-stack {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}
.brand-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.logo-mark {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: grid;
  place-items: center;
  font-size: 1.35rem;
  font-weight: 800;
  color: #fff;
}
.brand-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
.brand-badge {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fff;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
}
.auth-card {
  width: 100%;
  padding: 2rem;
}
.auth-card h2 {
  margin: 0 0 0.3rem;
  font-size: 1.35rem;
  font-weight: 800;
}
.sub {
  margin: 0 0 1.6rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
}
.field {
  margin-bottom: 1rem;
}
.field :deep(.p-password) {
  width: 100%;
}
.submit {
  width: 100%;
  margin-top: 0.4rem;
  justify-content: center;
  padding: 0.65rem 1rem;
}
.login-error {
  color: var(--danger);
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.8rem;
}
.hint {
  margin-top: 1.5rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.76rem;
  color: var(--text-secondary);
}
.hint code {
  font-family: 'JetBrains Mono', monospace;
  color: var(--accent-2);
}
.foot {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}
</style>
