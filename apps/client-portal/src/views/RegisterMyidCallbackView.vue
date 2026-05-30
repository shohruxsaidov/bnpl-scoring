<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRegistrationApi } from '@/composables/useRegistrationApi'
import type { AuthUser } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const { completeMyidMutation } = useRegistrationApi()

onMounted(async () => {
  const code = new URLSearchParams(window.location.search).get('auth_code')
  const regToken = sessionStorage.getItem('myid_reg_token')

  // Missing code or token — bounce back to the wizard from the start.
  if (!code || !regToken) {
    router.replace({ name: 'register' })
    return
  }

  sessionStorage.removeItem('myid_reg_token')

  try {
    const data = await completeMyidMutation.mutateAsync({ regToken, myidCode: code })
    auth.setUser(data.user as AuthUser)
    router.replace({ name: 'home' })
  } catch (err) {
    // Surface the failure on the register screen so the user can retry.
    sessionStorage.setItem('myid_reg_failed', (err as Error).message || 'error')
    router.replace({ name: 'register' })
  }
})
</script>

<template>
  <div class="myid-callback">
    <i class="pi pi-spin pi-spinner" style="font-size: 2rem" />
  </div>
</template>

<style scoped>
.myid-callback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
</style>
