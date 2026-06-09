import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch as api } from '@/utils/apiFetch'
import type { CriterionResult } from './scoring-model'

export type ApprovalOutcome = 'approved' | 'partial' | 'denied' | 'rejected'

export interface ScoringTestCase {
  id: string
  name: string
  description: string | null
  inputs: Record<string, unknown>
  expectedOutcome: ApprovalOutcome
  createdAt: string
  updatedAt: string
}

export interface TestRunResult {
  testCaseId: string
  name: string
  expectedOutcome: ApprovalOutcome
  actualOutcome: ApprovalOutcome
  pass: boolean
  totalScore: number | null
  coefficient: number | null
  stopFactor: string | null
  breakdown: CriterionResult[] | null
}

export interface TestRun {
  id: string
  modelRevisionId: number
  ranAt: string
  passCount: number
  failCount: number
  results: TestRunResult[]
}

export const useScoringTestCasesStore = defineStore('scoringTestCases', () => {
  const cases = ref<ScoringTestCase[]>([])
  const loading = ref(false)
  const running = ref(false)
  const lastRun = ref<TestRun | null>(null)

  async function fetchAll(): Promise<void> {
    loading.value = true
    try {
      const body = await api<{ testCases: ScoringTestCase[] }>('/admin/scoring-test-cases')
      cases.value = body.testCases
    } finally {
      loading.value = false
    }
  }

  async function create(data: {
    name: string
    description?: string
    inputs: Record<string, unknown>
    expectedOutcome: ApprovalOutcome
  }): Promise<void> {
    const row = await api<ScoringTestCase>('/admin/scoring-test-cases', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    cases.value.unshift(row)
  }

  async function update(
    id: string,
    data: Partial<{ name: string; description: string; inputs: Record<string, unknown>; expectedOutcome: ApprovalOutcome }>,
  ): Promise<void> {
    const row = await api<ScoringTestCase>(`/admin/scoring-test-cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    const idx = cases.value.findIndex((c) => c.id === id)
    if (idx !== -1) cases.value[idx] = row
  }

  async function remove(id: string): Promise<void> {
    await api(`/admin/scoring-test-cases/${id}`, { method: 'DELETE' })
    cases.value = cases.value.filter((c) => c.id !== id)
  }

  async function runSuite(modelRevisionId: number): Promise<TestRun> {
    running.value = true
    try {
      const run = await api<TestRun>('/admin/scoring-test-cases/runs', {
        method: 'POST',
        body: JSON.stringify({ modelRevisionId }),
      })
      lastRun.value = run
      return run
    } finally {
      running.value = false
    }
  }

  async function captureBaseline(runId: string): Promise<void> {
    await api(`/admin/scoring-test-cases/runs/${runId}/capture`, { method: 'POST' })
    if (lastRun.value?.id === runId) {
      for (const result of lastRun.value.results) {
        const tc = cases.value.find((c) => c.id === result.testCaseId)
        if (tc) tc.expectedOutcome = result.actualOutcome
      }
    }
  }

  return { cases, loading, running, lastRun, fetchAll, create, update, remove, runSuite, captureBaseline }
})
