<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientApi } from '@/composables/useClientApi'
import { useWizardStore } from '@/stores/wizard'

const router = useRouter()
const wizard = useWizardStore()
const { completeMyidMutation } = useClientApi()

onMounted(async () => {
  debugger

  const params = new URLSearchParams(window.location.search)
  const code = params.get('auth_code')
  const regToken = sessionStorage.getItem('myid_reg_token')
  debugger
  if (!code || !regToken) {
    router.replace({ name: 'wizard' })
    return
  }

  sessionStorage.removeItem('myid_reg_token')

  try {
    const data = await completeMyidMutation.mutateAsync({ regToken, myidCode: code })
    wizard.setClient(data.client, { isNew: true, myidVerified: true })
    sessionStorage.setItem('myid_callback_complete', '1')
  } catch (err) {
    console.error('MyID verification failed', err)
    // on failure, wizard lands on client step with no client — Agent starts over
  }

  router.replace({ name: 'wizard' })
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
