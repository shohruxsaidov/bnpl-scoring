const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API}/auth/admin/refresh`, {
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
  // Let the browser set the multipart boundary itself for FormData bodies;
  // only default to JSON for other (string) bodies.
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData
  const makeRequest = () =>
    fetch(`${API}${path}`, {
      ...opts,
      credentials: 'include',
      headers: {
        ...(opts.body != null && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        // Same key vue-i18n was initialised from in main.ts — server-rendered
        // text (error messages, notification title/body) comes back in the
        // language the portal is actually showing.
        'x-lang': localStorage.getItem('lang') || 'uz',
        ...(opts.headers ?? {}),
      },
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
