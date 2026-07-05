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

  // Two-step presigned upload: ask for a URL, PUT the file straight to storage.
  async function uploadPdf(file: File): Promise<string> {
    const { uploadUrl, objectKey } = await api<{ uploadUrl: string; objectKey: string }>(
      '/admin/public-offers/upload-url',
      { method: 'POST' },
    )
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/pdf' },
    })
    if (!putRes.ok) throw new Error('upload_failed')
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
