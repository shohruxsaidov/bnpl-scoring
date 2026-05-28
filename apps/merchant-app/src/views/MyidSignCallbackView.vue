<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientApi } from '@/composables/useClientApi'
import { useCreateDealMutation } from '@/composables/useDealsApi'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/clientScoring'

const router = useRouter()
const { myidSignCompleteMutation } = useClientApi()
const createDealMutation = useCreateDealMutation()
const deal = useDealStore()
const scoring = useClientScoringStore()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('auth_code')
  const signingSessionToken = sessionStorage.getItem('myid_sign_session_token')
  const signingToken = sessionStorage.getItem('signing_token')

  if (!code || !signingSessionToken) {
    router.replace({ name: 'deals-create' })
    return
  }

  sessionStorage.removeItem('myid_sign_session_token')

  // Step 1 — Verify the MyID face scan
  try {
    await myidSignCompleteMutation.mutateAsync({ signingSessionToken, myidCode: code })
  } catch (err) {
    console.error('MyID signing verification failed', err)
    sessionStorage.setItem('myid_sign_failed', '1')
    router.replace({ name: 'deals-create' })
    return
  }

  // Step 2 — Create the deal immediately (no extra button click needed)
  if (signingToken && deal.sessionData.client?.id && deal.sessionData.tariff) {
    try {
      const basket = (deal.sessionData.basket ?? []).map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      const res = await createDealMutation.mutateAsync({
        clientId: deal.sessionData.client.id,
        tariffId: deal.sessionData.tariff.id,
        basket,
        paymentDay: deal.sessionData.paymentDay,
        signingToken,
        scoreSum: scoring.scoreSum,
        scoringDecision: scoring.decision,
      })

      // Persist the deal ID so NewDealView can advance directly to StepDone
      sessionStorage.setItem('myid_sign_deal_id', res.dealId)
      sessionStorage.removeItem('signing_token')
    } catch (err) {
      console.error('Deal creation failed after MyID verification', err)
      // Fall through — agent will see myid_verified phase and can retry
    }
  }

  sessionStorage.setItem('myid_sign_complete', '1')
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
