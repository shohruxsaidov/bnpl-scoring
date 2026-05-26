import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface MxikPackage { code: number; name: string }
export interface MxikEntry {
  mxikCode: string
  mxikName: string | null
  label: number
  packages: MxikPackage[] | null
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

export function useMxik(pathPrefix: string) {
  const searchTerm = ref('')
  const selectedCode = ref('')
  let debounceTimer = 0

  const { data: searchData, isFetching: mxikSearchLoading } = useQuery({
    queryKey: computed(() => ['mxik', pathPrefix, 'search', searchTerm.value]),
    queryFn: () => get<{ results: MxikEntry[] }>(`${API}${pathPrefix}/search?q=${encodeURIComponent(searchTerm.value)}`),
    enabled: computed(() => searchTerm.value.length >= 2 && searchTerm.value.length < 17),
    staleTime: 5 * 60 * 1000,
  })

  const { data: lookupData, isFetching: mxikLookupLoading, isError: mxikLookupError } = useQuery({
    queryKey: computed(() => ['mxik', pathPrefix, 'lookup', selectedCode.value]),
    queryFn: () => get<{ mxik: MxikEntry }>(`${API}${pathPrefix}/lookup?code=${encodeURIComponent(selectedCode.value)}`),
    enabled: computed(() => selectedCode.value.length === 17),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  const mxikSuggestions = computed(() => searchData.value?.results ?? [])
  const mxikData = computed(() => lookupData.value?.mxik ?? null)

  function onMxikInput(val: string) {
    clearTimeout(debounceTimer)
    selectedCode.value = ''
    if (val.length === 17) {
      searchTerm.value = ''
      selectedCode.value = val
    } else {
      debounceTimer = window.setTimeout(() => { searchTerm.value = val }, 300)
    }
  }

  function selectMxikSuggestion(item: MxikEntry) {
    searchTerm.value = ''
    selectedCode.value = item.mxikCode
  }

  function resetMxik() {
    searchTerm.value = ''
    selectedCode.value = ''
  }

  function clearSearch() {
    searchTerm.value = ''
  }

  return {
    mxikSuggestions,
    mxikSearchLoading,
    mxikLookupLoading,
    mxikData,
    mxikLookupError,
    selectedCode,
    onMxikInput,
    selectMxikSuggestion,
    resetMxik,
    clearSearch,
  }
}
