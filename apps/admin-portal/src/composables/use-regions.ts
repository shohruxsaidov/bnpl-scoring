import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Region } from '@/types'
import { useI18n } from 'vue-i18n'

function useRegionsList(url: string) {
  return useQuery({
    queryKey: [url],
    queryFn: () => apiFetch<Region[]>(url),
    staleTime: 10 * 60 * 1000,
  })
}

export function useRegions() {
  const { locale } = useI18n()

  const { data: regionsData } = useRegionsList('/admin/regions')
  const districtsUpperId = ref<number | null>(null)
  const { data: districtsData } = useQuery({
    queryKey: computed(() => ['/admin/regions', 'districts', districtsUpperId.value]),
    queryFn: () => apiFetch<Region[]>(`/admin/regions?upperId=${districtsUpperId.value}`),
    enabled: computed(() => districtsUpperId.value !== null),
    staleTime: 10 * 60 * 1000,
  })

  function label(r: Region): string {
    if (locale.value === 'uz') return r.nameUz
    return r.nameRu
  }

  const regionOptions = computed(() =>
    (regionsData.value ?? []).map((r) => ({ label: label(r), value: r.id })),
  )

  const districtOptions = computed(() =>
    (districtsData.value ?? []).map((r) => ({ label: label(r), value: r.id })),
  )

  function onRegionChange(regionId: number | null, setDistrict: (v: number | null) => void) {
    districtsUpperId.value = regionId
    setDistrict(null)
  }

  function initFromRegionId(regionId: number | null, regions: Region[]) {
    if (!regionId) return { selectedRegion: null, selectedDistrict: null }
    const isDistrict = regions.some((r) => r.id === regionId) === false
    if (isDistrict) {
      return { selectedRegion: null, selectedDistrict: regionId }
    }
    return { selectedRegion: regionId, selectedDistrict: null }
  }

  return {
    regionOptions,
    districtOptions,
    districtsUpperId,
    onRegionChange,
    initFromRegionId,
    regionsRaw: computed(() => regionsData.value ?? []),
  }
}
