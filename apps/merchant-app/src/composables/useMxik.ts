import { ref } from 'vue'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface MxikPackage { code: number; name: string }
export interface MxikEntry {
  mxikCode: string
  mxikName: string | null
  label: number
  packages: MxikPackage[] | null
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

export function useMxik(pathPrefix: string) {
  const mxikSuggestions = ref<MxikEntry[]>([])
  const mxikSearchLoading = ref(false)
  const mxikLookupLoading = ref(false)
  const mxikData = ref<MxikEntry | null>(null)
  let mxikSearchTimer = 0

  async function searchMxikSuggestions(q: string) {
    mxikSuggestions.value = []
    if (!q || q.length < 2) return
    mxikSearchLoading.value = true
    try {
      const { results } = await apiFetch<{ results: MxikEntry[] }>(`${pathPrefix}/search?q=${encodeURIComponent(q)}`)
      mxikSuggestions.value = results
    } catch { /* silent */ } finally {
      mxikSearchLoading.value = false
    }
  }

  async function triggerLookup(code: string) {
    if (code.length !== 17) return
    mxikLookupLoading.value = true
    mxikData.value = null
    try {
      const { mxik } = await apiFetch<{ mxik: MxikEntry }>(`${pathPrefix}/lookup?code=${encodeURIComponent(code)}`)
      mxikData.value = mxik
    } finally {
      mxikLookupLoading.value = false
    }
  }

  function onMxikInput(val: string) {
    clearTimeout(mxikSearchTimer)
    if (val.length === 17) {
      mxikSuggestions.value = []
      triggerLookup(val)
    } else {
      mxikSearchTimer = window.setTimeout(() => searchMxikSuggestions(val), 300)
    }
  }

  function selectMxikSuggestion(item: MxikEntry) {
    mxikSuggestions.value = []
    triggerLookup(item.mxikCode)
  }

  function resetMxik() {
    mxikData.value = null
    mxikSuggestions.value = []
  }

  return {
    mxikSuggestions,
    mxikSearchLoading,
    mxikLookupLoading,
    mxikData,
    onMxikInput,
    selectMxikSuggestion,
    resetMxik,
    triggerLookup,
  }
}
