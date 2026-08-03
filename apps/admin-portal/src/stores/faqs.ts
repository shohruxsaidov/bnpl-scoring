import { ref } from 'vue';
import { defineStore } from 'pinia';

import { apiFetch as api } from '@/utils/apiFetch';

/**
 * The sections of the client app's help screen.
 *
 * Kept in step with db/faqs.ts on the API side, and duplicated rather than
 * fetched for the same reason the banner aspect ratio is: the form has to render
 * a dropdown before it has spoken to the server. Order here is only the order of
 * the admin's dropdown and of the groups on this screen — the CLIENT APP decides
 * what order the sections appear in on a phone, and holds their labels.
 */
export const FAQ_CATEGORIES = ['general', 'limits', 'payments', 'deals', 'account'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export interface Faq {
  id: number;
  category: FaqCategory;
  questionUz: string;
  questionRu: string;
  /** Plain text with newlines — never markdown or HTML. See db/faqs.ts. */
  answerUz: string;
  answerRu: string;
  isActive: boolean;
  /** Position within its category. Only ever written by reorder(). */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
}

export interface FaqPayload {
  category: FaqCategory;
  questionUz: string;
  questionRu: string;
  answerUz: string;
  answerRu: string;
  isActive: boolean;
}

export const useFaqsStore = defineStore('faqs', () => {
  const faqs = ref<Faq[]>([]);
  const loading = ref(false);
  const loaded = ref(false);

  // Active and inactive together — unlike the banner archive there is no
  // includeInactive flag, because this list is the authoring surface and an
  // answer switched off last week should be visible, not behind a checkbox.
  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      const body = await api<{ faqs: Faq[] }>('/admin/faqs');
      faqs.value = body.faqs;
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function create(payload: FaqPayload): Promise<Faq> {
    const body = await api<{ faq: Faq }>('/admin/faqs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Appended, matching where the server put it (bottom of its category).
    faqs.value.push(body.faq);
    return body.faq;
  }

  async function update(id: number, payload: Partial<FaqPayload>): Promise<Faq> {
    const body = await api<{ faq: Faq }>(`/admin/faqs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const idx = faqs.value.findIndex((f) => f.id === id);
    if (idx !== -1) faqs.value[idx] = body.faq;
    return body.faq;
  }

  /** Permanent. `isActive: false` is the reversible one. */
  async function remove(id: number): Promise<void> {
    await api(`/admin/faqs/${id}`, { method: 'DELETE' });
    faqs.value = faqs.value.filter((f) => f.id !== id);
  }

  /**
   * Renumbers one category. `ids` must be every entry in it, in display order —
   * the server rejects a partial or stale list rather than ordering around the
   * gap, so a 400 here means someone else changed the list and the screen should
   * be refetched.
   */
  async function reorder(category: FaqCategory, ids: number[]): Promise<void> {
    const body = await api<{ faqs: Faq[] }>('/admin/faqs/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ category, ids }),
    });
    // The response is the whole category, freshly ordered; splice it back over
    // the rows we hold so sortOrder stays truthful without a full refetch.
    const updated = new Map(body.faqs.map((f) => [f.id, f]));
    faqs.value = faqs.value.map((f) => updated.get(f.id) ?? f);
  }

  return { faqs, loading, loaded, fetchAll, create, update, remove, reorder };
});
