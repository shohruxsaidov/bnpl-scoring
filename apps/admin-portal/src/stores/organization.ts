import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { Organization } from '@/types'

import { apiFetch as api } from '@/utils/apiFetch'

export interface OrganizationInput {
  name: string
  legalName: string
  address: string
  phone: string
  inn: string
  mfo: string
  accountNumber: string
  bankName: string
}

export const useOrganizationStore = defineStore('organization', () => {
  const organization = ref<Organization | null>(null)
  const loaded = ref(false)

  async function fetch(): Promise<Organization | null> {
    const body = await api<{ organization: Organization | null }>('/admin/organization')
    organization.value = body.organization
    loaded.value = true
    return organization.value
  }

  async function save(input: OrganizationInput): Promise<void> {
    const body = await api<{ organization: Organization }>('/admin/organization', {
      method: 'PUT',
      body: JSON.stringify(input),
    })
    organization.value = body.organization
  }

  return { organization, loaded, fetch, save }
})
