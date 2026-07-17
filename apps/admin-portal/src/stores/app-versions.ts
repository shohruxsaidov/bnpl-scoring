import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

export type AppPlatform = 'ios' | 'android'

export interface AppVersionRevision {
  id: number
  platform: AppPlatform
  version: number
  minSupportedVersion: string
  latestVersion: string
  storeUrl: string
  messageUz: string
  messageRu: string
  label: string | null
  createdAt: string
  createdByName: string | null
}

export interface FleetImpactBucket {
  appVersion: string
  devices: number
  lockedOut: boolean
}

export interface FleetImpact {
  activeDevices: number
  lockedOut: number
  lockedOutPercent: number
  unknownVersion: number
  days: number
  distribution: FleetImpactBucket[]
}

export interface PublishAppVersionInput {
  platform: AppPlatform
  minSupportedVersion: string
  latestVersion: string
  storeUrl: string
  messageUz: string
  messageRu: string
  label: string | null
}

export const useAppVersionsStore = defineStore('app-versions', () => {
  const revisions = ref<AppVersionRevision[]>([])
  const loaded = ref(false)

  async function fetchAll(): Promise<void> {
    const body = await api<{ revisions: AppVersionRevision[] }>('/admin/app-versions')
    revisions.value = body.revisions
    loaded.value = true
  }

  // Blast-radius preview: how many recently-active devices a candidate floor
  // would lock out. Fetched on demand (not stored) so a stale preview never
  // outlives the input that produced it.
  async function fetchFleetImpact(params: {
    platform: AppPlatform
    minSupportedVersion: string
    days?: number
  }): Promise<FleetImpact> {
    const query = new URLSearchParams({
      platform: params.platform,
      minSupportedVersion: params.minSupportedVersion,
    })
    if (params.days != null) query.set('days', String(params.days))
    return api<FleetImpact>(`/admin/app-versions/fleet-impact?${query.toString()}`)
  }

  // `confirm` must repeat minSupportedVersion verbatim — the API's guard against
  // a mistyped lockout. The human gesture is the confirm dialog in the view;
  // this echoes the value the operator just acknowledged.
  async function publish(input: PublishAppVersionInput): Promise<AppVersionRevision> {
    const body = await api<AppVersionRevision>('/admin/app-versions', {
      method: 'POST',
      body: JSON.stringify({ ...input, confirm: input.minSupportedVersion }),
    })
    revisions.value = [body, ...revisions.value]
    return body
  }

  return { revisions, loaded, fetchAll, fetchFleetImpact, publish }
})
