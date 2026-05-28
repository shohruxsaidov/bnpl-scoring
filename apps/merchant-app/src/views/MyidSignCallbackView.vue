<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientApi } from '@/composables/useClientApi'
import { useDealStore } from '@/stores/deal'
import { useClientScoringStore } from '@/stores/clientScoring'

const router = useRouter()
const { myidSignCompleteMutation } = useClientApi()
const deal = useDealStore()
const scoring = useClientScoringStore()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('auth_code')
  const signingSessionToken = sessionStorage.getItem('myid_sign_session_token')
  const signingToken = sessionStorage.getItem('signing_token')

  // Can't proceed without all three tokens
  if (!code || !signingSessionToken || !signingToken) {
    router.replace({ name: 'deals-create' })
    return
  }

  // Validate we still have the deal data in the persisted store
  if (!deal.sessionData.client?.id || !deal.sessionData.tariff) {
    router.replace({ name: 'deals-create' })
    return
  }

  sessionStorage.removeItem('myid_sign_session_token')

  const basket = (deal.sessionData.basket ?? []).map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }))

  // Single call: verify MyID face scan + create deal atomically
  try {
    const res = await myidSignCompleteMutation.mutateAsync({
      signingSessionToken,
      myidCode: code,
      signingToken,
      clientId: deal.sessionData.client.id,
      tariffId: deal.sessionData.tariff.id,
      basket,
      paymentDay: deal.sessionData.paymentDay,
      scoreSum: scoring.scoreSum,
      scoringDecision: scoring.decision,
    })

    // Persist the deal ID so NewDealView can advance directly to StepDone
    sessionStorage.setItem('myid_sign_deal_id', res.dealId)
    sessionStorage.removeItem('signing_token')
  } catch (err) {
    console.error('myid-sign-complete failed', err)
    sessionStorage.setItem('myid_sign_failed', '1')
    router.replace({ name: 'deals-create' })
    return
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
