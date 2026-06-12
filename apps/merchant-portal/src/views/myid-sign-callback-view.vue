<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientApi } from '@/composables/use-client-api'
import { useDealStore } from '@/stores/deal'

const router = useRouter()
const { myidSignCompleteMutation } = useClientApi()
const deal = useDealStore()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('auth_code')
  const signingSessionToken = sessionStorage.getItem('myid_sign_session_token')
  const signingToken = sessionStorage.getItem('signing_token')
  // The deal is built FROM the Deal Session (ADR-0024); its id survived the
  // redirect in the persisted wizard store
  const dealSessionId = deal.dealSessionId

  // Can't proceed without all the pieces
  if (!code || !signingSessionToken || !signingToken || !dealSessionId) {
    router.replace({ name: 'deals-create' })
    return
  }

  sessionStorage.removeItem('myid_sign_session_token')

  // Single call: verify MyID face scan + create deal atomically
  try {
    const res = await myidSignCompleteMutation.mutateAsync({
      signingSessionToken,
      myidCode: code,
      signingToken,
      dealSessionId,
    })

    // Persist the deal ID so NewDealView can advance directly to StepDone
    sessionStorage.setItem('myid_sign_complete', '1')
    sessionStorage.setItem('myid_sign_deal_id', res.dealId)
    sessionStorage.setItem('myid_sign_deal_number', res.dealNumber)
    sessionStorage.removeItem('signing_token')
  } catch (err) {
    console.error('myid-sign-complete failed', err)
    sessionStorage.setItem('myid_sign_failed', '1')
    router.replace({ name: 'deals-create' })
    return
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
