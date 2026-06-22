import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

export interface ScoringModelListItem {
  id: number
  name: string
  isGlobal: boolean
  merchantCount: number
  revisionCount: number
  createdAt: string
}

export interface ScoringModelInfo {
  id: number
  name: string
  isGlobal: boolean
  createdAt: string
}

export interface ScoringModelRevision {
  id: number
  scoringModelId: number
  name: string
  version: string
  params: Record<string, unknown>
  createdAt: string
}

export interface ScoringModelHistoryItem {
  id: number
  name: string
  version: string
  createdAt: string
}

export const useScoringModelStore = defineStore('scoringModel', () => {
  const models = ref<ScoringModelListItem[]>([])
  const model = ref<ScoringModelInfo | null>(null)
  const revision = ref<ScoringModelRevision | null>(null)
  const history = ref<ScoringModelHistoryItem[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function fetchModels(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const body = await api<{ models: ScoringModelListItem[] }>('/admin/scoring-model/models')
      models.value = body.models
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createModel(name: string): Promise<ScoringModelInfo> {
    const body = await api<{ model: ScoringModelInfo }>('/admin/scoring-model/models', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    return body.model
  }

  async function setGlobal(modelId: number): Promise<void> {
    await api<{ model: ScoringModelInfo }>(`/admin/scoring-model/models/${modelId}/global`, {
      method: 'POST',
    })
    models.value = models.value.map((m) => ({ ...m, isGlobal: m.id === modelId }))
    if (model.value) model.value = { ...model.value, isGlobal: model.value.id === modelId }
  }

  async function fetchModel(modelId: number): Promise<void> {
    loading.value = true

    try {
      const body = await api<{ model: ScoringModelInfo; activeRevision: ScoringModelRevision | null }>(
        `/admin/scoring-model/models/${modelId}`,
      )
      model.value = body.model
      revision.value = body.activeRevision
    } finally {
      loading.value = false
    }
  }

  async function fetchModelHistory(modelId: number): Promise<void> {
    const body = await api<{ revisions: ScoringModelHistoryItem[] }>(
      `/admin/scoring-model/models/${modelId}/history`,
    )
    history.value = body.revisions
  }

  // Params of the Global Model's active revision, used to seed the editor
  // of a model that has no revisions yet. Does not touch store state.
  async function fetchGlobalTemplateParams(): Promise<Record<string, unknown> | null> {
    const list = await api<{ models: ScoringModelListItem[] }>('/admin/scoring-model/models')
    const global = list.models.find((m) => m.isGlobal)
    if (!global) return null
    const body = await api<{ model: ScoringModelInfo; activeRevision: ScoringModelRevision | null }>(
      `/admin/scoring-model/models/${global.id}`,
    )
    return body.activeRevision?.params ?? null
  }

  async function loadRevision(revisionId: number): Promise<void> {
    loading.value = true

    try {
      const body = await api<ScoringModelRevision>(`/admin/scoring-model/${revisionId}`)
      revision.value = body
    } finally {
      loading.value = false
    }
  }

  async function save(
    modelId: number,
    name: string,
    version: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    saving.value = true

    try {
      const body = await api<ScoringModelRevision>(`/admin/scoring-model/models/${modelId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, version, params }),
      })
      revision.value = body
      history.value.unshift({ id: body.id, name: body.name, version: body.version, createdAt: body.createdAt })
    } finally {
      saving.value = false
    }
  }

  return {
    models,
    model,
    revision,
    history,
    loading,
    saving,
    error,
    fetchModels,
    createModel,
    setGlobal,
    fetchModel,
    fetchModelHistory,
    fetchGlobalTemplateParams,
    loadRevision,
    save,
  }
})
