import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch } from '@/utils/apiFetch'

export interface IntegrationLogListItem {
  id: string
  integration: string
  methodName: string
  methodType: string
  status: number | null
  hasError: boolean
  responseTimeInMs: number | null
  requestTimestamp: string | null
  responseTimestamp: string | null
}

export interface IntegrationLogDetail extends IntegrationLogListItem {
  errorMessage: string | null
  request: unknown
  response: unknown
  createdAt: string
}

export interface IntegrationLogFilters {
  from?: string
  to?: string
  integration?: string | null
  result?: 'success' | 'error' | null
  limit: number
  offset: number
}

export const useIntegrationLogsStore = defineStore('integrationLogs', () => {
  const logs = ref<IntegrationLogListItem[]>([])
  const total = ref(0)
  const integrations = ref<string[]>([])
  const detail = ref<IntegrationLogDetail | null>(null)
  const loading = ref(false)
  const detailLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchList(filters: IntegrationLogFilters): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const qs = new URLSearchParams()
      if (filters.from) qs.set('from', filters.from)
      if (filters.to) qs.set('to', filters.to)
      if (filters.integration) qs.set('integration', filters.integration)
      if (filters.result) qs.set('result', filters.result)
      qs.set('limit', String(filters.limit))
      qs.set('offset', String(filters.offset))

      const data = await apiFetch<{ logs: IntegrationLogListItem[]; total: number }>(
        `/admin/integration-logs?${qs}`,
      )
      logs.value = data.logs
      total.value = data.total
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      loading.value = false
    }
  }

  async function fetchIntegrations(): Promise<void> {
    try {
      const data = await apiFetch<{ integrations: string[] }>(
        '/admin/integration-logs/integrations',
      )
      integrations.value = data.integrations
    } catch {
      // dropdown silently falls back to empty — the list itself still loads
    }
  }

  async function fetchDetail(id: string): Promise<void> {
    detailLoading.value = true
    detail.value = null

    try {
      const data = await apiFetch<{ log: IntegrationLogDetail }>(`/admin/integration-logs/${id}`)
      detail.value = data.log
    } catch (err: any) {
      error.value = err?.message ?? 'error'
    } finally {
      detailLoading.value = false
    }
  }

  return {
    logs,
    total,
    integrations,
    detail,
    loading,
    detailLoading,
    error,
    fetchList,
    fetchIntegrations,
    fetchDetail,
  }
})
