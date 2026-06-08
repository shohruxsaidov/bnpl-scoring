import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Region } from '@/types'
import { useI18n } from 'vue-i18n'

export function useRegions() {
  const { locale } = useI18n()

  const { data: regionsData } = useQuery({
    queryKey: ['/merchant/regions'],
    queryFn: () => apiFetch<Region[]>('/merchant/regions'),
    staleTime: 10 * 60 * 1000,
  })

  const districtsUpperId = ref<number | null>(null)
  const { data: districtsData } = useQuery({
    queryKey: computed(() => ['/merchant/regions', 'districts', districtsUpperId.value]),
    queryFn: () => apiFetch<Region[]>(`/merchant/regions?upperId=${districtsUpperId.value}`),
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

  return {
    regionOptions,
    districtOptions,
    districtsUpperId,
    onRegionChange,
  }
}
