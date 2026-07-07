import { ref } from 'vue'
import { defineStore } from 'pinia'

import { apiFetch as api } from '@/utils/apiFetch'

export interface PublicOfferVersion {
  id: number
  version: number
  label: string | null
  createdAt: string
  createdByName: string | null
  downloadUrlUz: string
  downloadUrlRu: string
}

export const usePublicOffersStore = defineStore('public-offers', () => {
  const versions = ref<PublicOfferVersion[]>([])
  const loaded = ref(false)

  async function fetchAll(): Promise<void> {
    const body = await api<{ versions: PublicOfferVersion[] }>('/admin/public-offers')
    versions.value = body.versions
    loaded.value = true
  }

  // Upload the PDF straight through the backend as multipart form data; the API
  // stores it and returns the objectKey to reference when publishing.
  async function uploadPdf(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const { objectKey } = await api<{ objectKey: string; originalName: string | null }>(
      '/admin/public-offers/upload-url',
      { method: 'POST', body: form },
    )
    return objectKey
  }

  // Upload both PDFs first, then publish the version — the API only creates a
  // version once both files exist.
  async function publish(input: {
    label: string | null
    fileUz: File
    fileRu: File
  }): Promise<PublicOfferVersion> {
    const [keyUz, keyRu] = await Promise.all([uploadPdf(input.fileUz), uploadPdf(input.fileRu)])
    const body = await api<{
      id: number
      version: number
      label: string | null
      createdAt: string
      createdByName: string | null
      downloadUrlUz: string
      downloadUrlRu: string
    }>('/admin/public-offers', {
      method: 'POST',
      body: JSON.stringify({
        label: input.label,
        fileUz: { objectKey: keyUz, originalName: input.fileUz.name },
        fileRu: { objectKey: keyRu, originalName: input.fileRu.name },
      }),
    })
    versions.value = [body, ...versions.value]
    return body
  }

  return { versions, loaded, fetchAll, publish }
})
