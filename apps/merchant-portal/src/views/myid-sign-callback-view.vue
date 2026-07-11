<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientApi } from '@/composables/use-client-api'
import { useDealStore } from '@/stores/deal'

const router = useRouter()
const { myidSignCompleteMutation } = useClientApi()
const deal = useDealStore()

/**
 * Return leg of the signing face-scan. It only VERIFIES — the deal is not created
 * here: the client still has to give their акцепт by OTP back in the wizard, which
 * is what makes the consent cover the final terms. The server stamps the proof
 * onto the Deal Session, so nothing needs carrying back but a "go look at it" flag.
 */
onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('auth_code')
  const signingSessionToken = sessionStorage.getItem('myid_sign_session_token')
  // The session id survived the redirect in the persisted wizard store
  const dealSessionId = deal.dealSessionId

  if (!code || !signingSessionToken || !dealSessionId) {
    sessionStorage.setItem('myid_sign_failed', 'myid_incomplete')
    router.replace({ name: 'deals-create' })
    return
  }

  sessionStorage.removeItem('myid_sign_session_token')

  try {
    await myidSignCompleteMutation.mutateAsync({ dealSessionId, signingSessionToken, myidCode: code })
    sessionStorage.setItem('myid_sign_done', '1')
  } catch (err: any) {
    // apiFetch surfaces the server's error code as the message — StepVerification
    // tells a scan-by-the-wrong-person apart from a plain liveness failure.
    console.error('myid-sign/complete failed', err)
    sessionStorage.setItem('myid_sign_failed', err?.message ?? 'myid_failed')
  }

  router.replace({ name: 'deals-create' })
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
