import { ref } from 'vue';
import { defineStore } from 'pinia';

import { apiFetch as api } from '@/utils/apiFetch';

export type BannerActionType = 'none' | 'external_url' | 'merchant';

export interface Banner {
  id: number;
  /** Admin-side handle only — clients never see it; their headline is inside the image. */
  title: string;
  imageUrlUz: string;
  imageUrlRu: string;
  actionType: BannerActionType;
  actionValue: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  viewCount: number;
  /** Server's verdict on "would a client see this right now" — isActive alone is not it. */
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface BannerImageInput {
  objectKey: string;
  originalName?: string;
  mimeType: string;
}

export interface BannerPayload {
  title: string;
  imageUz?: BannerImageInput;
  imageRu?: BannerImageInput;
  actionType: BannerActionType;
  actionValue: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
}

// Kept in step with db/banners.ts on the API side. Duplicated rather than
// fetched because the upload form has to reject a wrong-shaped file before it
// spends a round trip discovering the server agrees.
export const BANNER_ASPECT_RATIO = 2;
export const BANNER_ASPECT_TOLERANCE = 0.02;
export const MIN_BANNER_IMAGE_WIDTH = 300;

export const useBannersStore = defineStore('banners', () => {
  const banners = ref<Banner[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  // Sticky across visits: an admin auditing what ran last quarter should not have
  // to re-tick the box every time they come back from a detail page.
  const includeInactive = ref(false);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      const query = includeInactive.value ? '?includeInactive=true' : '';
      const body = await api<{ banners: Banner[] }>(`/admin/banners${query}`);
      banners.value = body.banners;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: number): Promise<Banner> {
    const body = await api<{ banner: Banner }>(`/admin/banners/${id}`);
    return body.banner;
  }

  // Straight through the backend as multipart: the server is the one that decides
  // these bytes really are an image of the right shape, and it answers with the
  // dimensions it measured so the form can show them.
  async function uploadImage(
    file: File,
  ): Promise<BannerImageInput & { width: number; height: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await api<{
      objectKey: string;
      originalName: string | null;
      width: number;
      height: number;
    }>('/admin/banners/upload', { method: 'POST', body: form });
    return {
      objectKey: res.objectKey,
      originalName: res.originalName ?? file.name,
      mimeType: file.type,
      width: res.width,
      height: res.height,
    };
  }

  async function create(payload: BannerPayload): Promise<Banner> {
    const body = await api<{ banner: Banner }>('/admin/banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    loaded.value = false;
    return body.banner;
  }

  async function update(id: number, payload: Partial<BannerPayload>): Promise<Banner> {
    const body = await api<{ banner: Banner }>(`/admin/banners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    // Patch in place so the list reflects the edit without a refetch.
    const idx = banners.value.findIndex((b) => b.id === id);
    if (idx !== -1) banners.value[idx] = body.banner;
    return body.banner;
  }

  /** Deactivating is how a banner is removed — the API has no delete. */
  function setActive(id: number, isActive: boolean) {
    return update(id, { isActive });
  }

  return {
    banners,
    loading,
    loaded,
    includeInactive,
    fetchAll,
    fetchOne,
    uploadImage,
    create,
    update,
    setActive,
  };
});
