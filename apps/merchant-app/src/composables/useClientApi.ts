import type { Client } from '@/types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.code ?? 'error')
  return data
}

export function useClientApi() {
  function searchClients(q: string): Promise<{ clients: Client[] }> {
    return apiFetch(`/merchant/client/search?q=${encodeURIComponent(q)}`)
  }

  function sendOtp(phone: string): Promise<{ devOtp?: string }> {
    return apiFetch('/merchant/client/otp', { method: 'POST', body: JSON.stringify({ phone }) })
  }

  function verifyOtp(phone: string, code: string): Promise<{ regToken: string }> {
    return apiFetch('/merchant/client/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) })
  }

  function createMyidSession(
    regToken: string,
    pinfl: string,
    retry = false,
  ): Promise<{ regToken: string; iframeUrl?: string; mock?: boolean }> {
    return apiFetch('/merchant/client/myid-session', {
      method: 'POST',
      body: JSON.stringify({ regToken, pinfl, ...(retry ? { retry: true } : {}) }),
    })
  }

  function completeMyid(regToken: string, myidCode: string): Promise<{ client: Client }> {
    return apiFetch('/merchant/client/myid-complete', {
      method: 'POST',
      body: JSON.stringify({ regToken, myidCode }),
    })
  }

  return { searchClients, sendOtp, verifyOtp, createMyidSession, completeMyid }
}
