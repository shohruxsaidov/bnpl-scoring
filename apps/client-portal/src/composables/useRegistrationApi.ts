import { useMutation } from '@tanstack/vue-query'
import { API_URL } from '@/stores/auth'
import type { AuthUser } from '@/types'

async function post<T = any>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.code ?? 'error')
  return data
}

export function useRegistrationApi() {
  const sendPhoneMutation = useMutation({
    mutationFn: (phoneDigits: string) =>
      post<{ devOtp?: string }>('/auth/client/register/phone', { phone: phoneDigits }),
  })

  const verifyOtpMutation = useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      post<{ regToken: string }>('/auth/client/register/otp', { phone, code }),
  })

  const submitPinflMutation = useMutation({
    mutationFn: ({ regToken, pinfl }: { regToken: string; pinfl: string }) =>
      post<{ regToken: string; iframeUrl?: string; mock?: boolean }>('/auth/client/register/pinfl', { regToken, pinfl }),
  })

  const completeMyidMutation = useMutation({
    mutationFn: ({ regToken, myidCode }: { regToken: string; myidCode?: string }) =>
      post<{ user: AuthUser }>('/auth/client/register/complete', { regToken, myidCode: myidCode ?? 'mock' }),
  })

  return {
    sendPhoneMutation,
    verifyOtpMutation,
    submitPinflMutation,
    completeMyidMutation,
  }
}
