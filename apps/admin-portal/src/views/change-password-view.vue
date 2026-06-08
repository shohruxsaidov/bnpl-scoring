<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import Password from 'primevue/password'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()

const schema = toTypedSchema(
  z
    .object({
      currentPassword: z.string().min(1, t('changePassword.currentRequired')),
      newPassword: z.string().min(8, t('changePassword.newMin')),
      confirmPassword: z.string().min(1, t('changePassword.confirmRequired')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t('changePassword.mismatch'),
      path: ['confirmPassword'],
    }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})

const [currentPassword, currentPasswordAttrs] = defineField('currentPassword')
const [newPassword, newPasswordAttrs] = defineField('newPassword')
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword')

const error = ref('')
const loading = ref(false)

const onSubmit = handleSubmit(async (values) => {
  error.value = ''
  loading.value = true
  try {
    await auth.changePassword(values.currentPassword, values.newPassword)
    router.push('/')
  } catch (e: any) {
    error.value =
      e?.message === 'invalid_current_password'
        ? t('changePassword.invalidCurrent')
        : t('changePassword.error')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="cp-page">
    <div class="cp-card surface-card">
      <div class="cp-icon">
        <i class="pi pi-lock" />
      </div>
      <h2>{{ $t('changePassword.title') }}</h2>
      <p class="sub">{{ $t('changePassword.subtitle') }}</p>

      <form @submit="onSubmit">
        <div class="field">
          <label class="field-label" for="currentPassword">{{ $t('changePassword.current') }}</label>
          <Password
            id="currentPassword"
            v-model="currentPassword"
            v-bind="currentPasswordAttrs"
            :feedback="false"
            toggle-mask
            :invalid="!!errors.currentPassword"
            input-class="w-full"
            fluid
          />
          <span v-if="errors.currentPassword" class="field-error">{{ errors.currentPassword }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="newPassword">{{ $t('changePassword.new') }}</label>
          <Password
            id="newPassword"
            v-model="newPassword"
            v-bind="newPasswordAttrs"
            :feedback="false"
            toggle-mask
            :invalid="!!errors.newPassword"
            input-class="w-full"
            fluid
          />
          <span v-if="errors.newPassword" class="field-error">{{ errors.newPassword }}</span>
        </div>

        <div class="field">
          <label class="field-label" for="confirmPassword">{{ $t('changePassword.confirm') }}</label>
          <Password
            id="confirmPassword"
            v-model="confirmPassword"
            v-bind="confirmPasswordAttrs"
            :feedback="false"
            toggle-mask
            :invalid="!!errors.confirmPassword"
            input-class="w-full"
            fluid
          />
          <span v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</span>
        </div>

        <p v-if="error" class="form-error">
          <i class="pi pi-exclamation-triangle" /> {{ error }}
        </p>

        <button type="submit" class="btn-gradient submit" :disabled="loading">
          {{ loading ? $t('changePassword.saving') : $t('changePassword.save') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.cp-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--bg-base);
}

.cp-card {
  width: 100%;
  max-width: 400px;
  padding: 2.2rem;
  text-align: center;
}

.cp-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #4c3dd0, #9d4edd);
  display: grid;
  place-items: center;
  margin: 0 auto 1.2rem;
}

.cp-icon i {
  font-size: 1.4rem;
  color: #fff;
}

.cp-card h2 {
  margin: 0 0 0.3rem;
  font-size: 1.4rem;
  font-weight: 800;
}

.sub {
  margin: 0 0 1.8rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.field {
  margin-bottom: 1.1rem;
  text-align: left;
}

.field :deep(.p-password) {
  width: 100%;
}

.form-error {
  color: var(--danger);
  font-size: 0.82rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.8rem;
  text-align: left;
}

.submit {
  width: 100%;
  margin-top: 0.4rem;
}
</style>
