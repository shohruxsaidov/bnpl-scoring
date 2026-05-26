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
  function sendPhone(phoneDigits: string): Promise<{ devOtp?: string }> {
    return post('/auth/client/register/phone', { phone: phoneDigits })
  }

  function verifyOtp(phone: string, code: string): Promise<{ regToken: string }> {
    return post('/auth/client/register/otp', { phone, code })
  }

  function submitPinfl(
    regToken: string,
    pinfl: string,
  ): Promise<{ regToken: string; iframeUrl?: string; mock?: boolean }> {
    return post('/auth/client/register/pinfl', { regToken, pinfl })
  }

  function completeMyid(regToken: string, myidCode?: string): Promise<{ user: AuthUser }> {
    return post('/auth/client/register/complete', { regToken, myidCode: myidCode ?? 'mock' })
  }

  return { sendPhone, verifyOtp, submitPinfl, completeMyid }
}
