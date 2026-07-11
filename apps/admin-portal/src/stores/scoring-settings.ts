import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { ConfigurablePipeline, PipelineSetting } from '@/types'

import { apiFetch as api } from '@/utils/apiFetch'

export const useScoringSettingsStore = defineStore('scoring-settings', () => {
  const pipelines = ref<PipelineSetting[]>([])
  const loaded = ref(false)

  async function fetch(): Promise<PipelineSetting[]> {
    const body = await api<{ pipelines: PipelineSetting[] }>('/admin/scoring-settings/pipelines')
    pipelines.value = body.pipelines
    loaded.value = true
    return pipelines.value
  }

  async function setEnabled(type: ConfigurablePipeline, enabled: boolean): Promise<void> {
    const body = await api<{ pipeline: PipelineSetting }>(
      `/admin/scoring-settings/pipelines/${type}`,
      { method: 'PUT', body: JSON.stringify({ enabled }) },
    )
    pipelines.value = pipelines.value.map((p) => (p.type === type ? body.pipeline : p))
  }

  return { pipelines, loaded, fetch, setEnabled }
})
