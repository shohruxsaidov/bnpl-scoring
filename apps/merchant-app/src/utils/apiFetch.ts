const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API}/auth/merchant/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.ok)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const makeRequest = () =>
    fetch(`${API}${path}`, {
      ...opts,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    })

  let res = await makeRequest()

  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      res = await makeRequest()
    } else {
      const { useAuthStore } = await import('@/stores/auth')
      await useAuthStore().logout()
      window.location.href = '/login'
      throw new Error('unauthorized')
    }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.code ?? 'error')
  return data
}

export { API }
