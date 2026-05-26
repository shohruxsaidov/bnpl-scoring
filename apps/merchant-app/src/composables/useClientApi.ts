import { useMutation } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Client } from '@/types'

export function useClientApi() {
  const searchClientsMutation = useMutation({
    mutationFn: (q: string) =>
      apiFetch<{ clients: Client[] }>(`/merchant/client/search?q=${encodeURIComponent(q)}`),
  })

  const sendOtpMutation = useMutation({
    mutationFn: (phone: string) =>
      apiFetch<{ devOtp?: string }>('/merchant/client/otp', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      apiFetch<{ regToken: string }>('/merchant/client/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }),
  })

  const myidSessionMutation = useMutation({
    mutationFn: ({ regToken, pinfl, retry = false }: { regToken: string; pinfl: string; retry?: boolean }) =>
      apiFetch<{ regToken: string; iframeUrl?: string; mock?: boolean }>('/merchant/client/myid-session', {
        method: 'POST',
        body: JSON.stringify({ regToken, pinfl, ...(retry ? { retry: true } : {}) }),
      }),
  })

  const completeMyidMutation = useMutation({
    mutationFn: ({ regToken, myidCode }: { regToken: string; myidCode: string }) =>
      apiFetch<{ client: Client }>('/merchant/client/myid-complete', {
        method: 'POST',
        body: JSON.stringify({ regToken, myidCode }),
      }),
  })

  return {
    searchClientsMutation,
    sendOtpMutation,
    verifyOtpMutation,
    myidSessionMutation,
    completeMyidMutation,
  }
}
