import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { apiFetch } from '@/utils/apiFetch'
import type { Region } from '@/types'
import { useI18n } from 'vue-i18n'

export function useRegions() {
  const { locale } = useI18n()

  const { data: regionsData } = useQuery({
    queryKey: ['/admin/regions'],
    queryFn: () => apiFetch<Region[]>('/admin/regions'),
    staleTime: 10 * 60 * 1000,
  })

  const { data: allRegionsData } = useQuery({
    queryKey: ['/admin/regions', 'flat'],
    queryFn: () => apiFetch<Region[]>('/admin/regions?flat=true'),
    staleTime: 10 * 60 * 1000,
  })

  const districtsUpperId = ref<number | null>(null)
  const { data: districtsData } = useQuery({
    queryKey: computed(() => ['/admin/regions', 'districts', districtsUpperId.value]),
    queryFn: () => apiFetch<Region[]>(`/admin/regions?upperId=${districtsUpperId.value}`),
    enabled: computed(() => districtsUpperId.value !== null),
    staleTime: 10 * 60 * 1000,
  })

  function label(r: Region): string {
    return locale.value === 'uz' ? r.nameUz : r.nameRu
  }

  const regionOptions = computed(() =>
    (regionsData.value ?? []).map((r) => ({ label: label(r), value: r.id })),
  )

  const districtOptions = computed(() =>
    (districtsData.value ?? []).map((r) => ({ label: label(r), value: r.id })),
  )

  function lookupName(id: number | null | undefined): string | null {
    if (!id) return null
    const found = (allRegionsData.value ?? []).find((r) => r.id === id)
    return found ? label(found) : null
  }

  function lookupParent(id: number | null | undefined): Region | null {
    if (!id) return null
    const region = (allRegionsData.value ?? []).find((r) => r.id === id)
    if (!region?.upperId) return null
    return (allRegionsData.value ?? []).find((r) => r.id === region.upperId) ?? null
  }

  function onRegionChange(regionId: number | null, setDistrict: (v: number | null) => void) {
    districtsUpperId.value = regionId
    setDistrict(null)
  }

  return {
    regionOptions,
    districtOptions,
    districtsUpperId,
    onRegionChange,
    lookupName,
    lookupParent,
    allRegions: computed(() => allRegionsData.value ?? []),
    regionsRaw: computed(() => regionsData.value ?? []),
  }
}
