<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientApi } from '@/composables/useClientApi'
import { useDealStore } from '@/stores/deal'

const router = useRouter()
const route = useRoute()
const deal = useDealStore()
const { completeMyidMutation } = useClientApi()

onMounted(async () => {

  const code = route.query.auth_code as string

  const regToken = sessionStorage.getItem('myid_reg_token')
  if (!code || !regToken) {
    router.replace({ name: 'deals-create' })
    return
  }

  sessionStorage.removeItem('myid_reg_token')

  try {
    const data = await completeMyidMutation.mutateAsync({ regToken, myidCode: code })
    deal.setClient(data.client, { isNew: true, myidVerified: true })
    sessionStorage.setItem('myid_callback_complete', '1')
  } catch (err) {
    console.error('MyID verification failed', err)
    // on failure, deal flow lands on client step with no client — Agent starts over
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
