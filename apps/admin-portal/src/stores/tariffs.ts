import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'
import type { Tariff, TariffMerchant } from '@/types'

export const useTariffsStore = defineStore('tariffs', () => {
  const tariffs = ref<Tariff[]>([])
  const tariffMerchants = ref<Record<string, TariffMerchant[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ tariffs: Tariff[] }>('/admin/tariffs')
      tariffs.value = body.tariffs
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(input: {
    name: string
    termMonths: number
    markupPercent: number
    scoringModelId?: number | null
  }): Promise<Tariff> {
    const body = await api<{ tariff: Tariff }>('/admin/tariffs', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    tariffs.value.unshift(body.tariff)
    return body.tariff
  }

  async function update(id: string, patch: Partial<Omit<Tariff, 'id'>>): Promise<Tariff> {
    const body = await api<{ tariff: Tariff }>(`/admin/tariffs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    const idx = tariffs.value.findIndex((t) => t.id === id)
    if (idx >= 0) tariffs.value[idx] = body.tariff
    return body.tariff
  }

  async function remove(id: string): Promise<void> {
    await api(`/admin/tariffs/${id}`, { method: 'DELETE' })
    tariffs.value = tariffs.value.filter((t) => t.id !== id)
  }

  async function fetchMerchants(tariffId: string): Promise<TariffMerchant[]> {
    const body = await api<{ merchants: TariffMerchant[] }>(`/admin/tariffs/${tariffId}/merchants`)
    tariffMerchants.value[tariffId] = body.merchants
    return body.merchants
  }

  function merchantsFor(tariffId: string): TariffMerchant[] {
    return tariffMerchants.value[tariffId] ?? []
  }

  return { tariffs, tariffMerchants, loading, error, fetchAll, create, update, remove, fetchMerchants, merchantsFor }
})
