<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { usePublicOffersStore } from '@/stores/public-offers'
import { formatDateTime } from '@/utils/money'

const { t } = useI18n()
const toast = useToast()
const store = usePublicOffersStore()

const label = ref('')
const fileUz = ref<File | null>(null)
const fileRu = ref<File | null>(null)
const publishing = ref(false)
const loading = ref(false)

const current = computed(() => store.versions[0] ?? null)
const canPublish = computed(() => !!fileUz.value && !!fileRu.value && !publishing.value)

function pickPdf(e: Event, lang: 'uz' | 'ru') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (file && file.type !== 'application/pdf') {
    toast.add({ severity: 'error', summary: t('publicOffer.notPdf'), life: 3000 })
    input.value = ''
    return
  }
  if (lang === 'uz') fileUz.value = file
  else fileRu.value = file
}

async function submit() {
  if (!fileUz.value || !fileRu.value) return
  publishing.value = true
  try {
    await store.publish({ label: label.value.trim() || null, fileUz: fileUz.value, fileRu: fileRu.value })
    toast.add({ severity: 'success', summary: t('publicOffer.published'), life: 2000 })
    label.value = ''
    fileUz.value = null
    fileRu.value = null
  } catch {
    toast.add({ severity: 'error', summary: t('publicOffer.publishFailed'), life: 3000 })
  } finally {
    publishing.value = false
  }
}

onMounted(async () => {
  if (store.loaded) return
  loading.value = true
  await store.fetchAll().catch(() => null)
  loading.value = false
})
</script>

<template>
  <div class="settings-page">
    <router-link class="back-link" :to="{ name: 'settings' }">
      <i class="pi pi-arrow-left" />
      {{ $t('settings.backToSettings') }}
    </router-link>

    <!-- Current active version -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('publicOffer.current') }}</h3>
        <p class="section-hint">{{ $t('publicOffer.currentHint') }}</p>
      </header>
      <div class="panel-body">
        <div v-if="current" class="current-row">
          <div class="version-badge">v{{ current.version }}</div>
          <div class="current-meta">
            <span v-if="current.label" class="current-label">{{ current.label }}</span>
            <span class="current-date">{{ formatDateTime(current.createdAt) }}</span>
          </div>
          <div class="current-links">
            <a :href="current.downloadUrlUz" target="_blank" rel="noopener" class="pdf-link">
              <i class="pi pi-file-pdf" /> UZ
            </a>
            <a :href="current.downloadUrlRu" target="_blank" rel="noopener" class="pdf-link">
              <i class="pi pi-file-pdf" /> RU
            </a>
          </div>
        </div>
        <p v-else class="empty">{{ $t('publicOffer.none') }}</p>
      </div>
    </section>

    <!-- Publish new version -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('publicOffer.publishNew') }}</h3>
        <p class="section-hint">{{ $t('publicOffer.publishHint') }}</p>
      </header>
      <div class="panel-body form">
        <div class="field">
          <label class="field-label">{{ $t('publicOffer.label') }}</label>
          <InputText v-model="label" :placeholder="$t('publicOffer.labelPlaceholder')" maxlength="500" />
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label">{{ $t('publicOffer.pdfUz') }}</label>
            <label class="file-drop" :class="{ 'has-file': fileUz }">
              <input type="file" accept="application/pdf" class="file-native" @change="pickPdf($event, 'uz')" />
              <i :class="fileUz ? 'pi pi-file-pdf' : 'pi pi-upload'" />
              <span class="file-drop-text">{{ fileUz ? fileUz.name : $t('publicOffer.browse') }}</span>
            </label>
          </div>
          <div class="field">
            <label class="field-label">{{ $t('publicOffer.pdfRu') }}</label>
            <label class="file-drop" :class="{ 'has-file': fileRu }">
              <input type="file" accept="application/pdf" class="file-native" @change="pickPdf($event, 'ru')" />
              <i :class="fileRu ? 'pi pi-file-pdf' : 'pi pi-upload'" />
              <span class="file-drop-text">{{ fileRu ? fileRu.name : $t('publicOffer.browse') }}</span>
            </label>
          </div>
        </div>
        <div class="actions">
          <button class="btn-gradient" :disabled="!canPublish" @click="submit">
            <i v-if="publishing" class="pi pi-spin pi-spinner" />
            {{ $t('publicOffer.publish') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Version history -->
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('publicOffer.history') }}</h3>
      </header>
      <div class="panel-body">
        <table v-if="store.versions.length" class="history-table">
          <thead>
            <tr>
              <th>{{ $t('publicOffer.colVersion') }}</th>
              <th>{{ $t('publicOffer.colLabel') }}</th>
              <th>{{ $t('publicOffer.colDate') }}</th>
              <th>{{ $t('publicOffer.colAuthor') }}</th>
              <th>{{ $t('publicOffer.colFiles') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in store.versions" :key="v.id">
              <td><span class="version-badge sm">v{{ v.version }}</span></td>
              <td>{{ v.label || '—' }}</td>
              <td>{{ formatDateTime(v.createdAt) }}</td>
              <td>{{ v.createdByName || '—' }}</td>
              <td class="files-cell">
                <a :href="v.downloadUrlUz" target="_blank" rel="noopener" class="pdf-link sm">UZ</a>
                <a :href="v.downloadUrlRu" target="_blank" rel="noopener" class="pdf-link sm">RU</a>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!loading" class="empty">{{ $t('publicOffer.none') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  width: fit-content;
}
.back-link:hover {
  color: var(--text-primary);
}
.back-link .pi {
  font-size: 0.75rem;
}
.panel {
  padding: 0;
  overflow: hidden;
}
.panel-head {
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--border-subtle);
}
.section-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.section-hint {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.panel-body {
  padding: 1rem 1.1rem 1.1rem;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.form :deep(.p-inputtext) {
  width: 100%;
}
.field {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.35rem;
}
.field-row {
  display: flex;
  gap: 0.85rem;
}
.file-drop {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  border: 1px dashed var(--border-subtle);
  border-radius: 0.6rem;
  cursor: pointer;
  background: color-mix(in srgb, var(--accent-1) 3%, transparent);
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
  min-width: 0;
}
.file-drop:hover {
  border-color: var(--accent-1);
  background: color-mix(in srgb, var(--accent-1) 8%, transparent);
}
.file-drop.has-file {
  border-style: solid;
  border-color: color-mix(in srgb, var(--accent-1) 45%, transparent);
}
.file-drop .pi {
  font-size: 0.95rem;
  color: var(--accent-1);
  flex-shrink: 0;
}
.file-drop-text {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-native {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
.current-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.version-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  padding: 0.3rem 0.5rem;
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--accent-1);
  background: color-mix(in srgb, var(--accent-1) 12%, transparent);
}
.version-badge.sm {
  min-width: auto;
  font-size: 0.75rem;
  padding: 0.15rem 0.4rem;
}
.current-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.current-label {
  font-weight: 600;
  font-size: 0.9rem;
}
.current-date {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.current-links {
  display: flex;
  gap: 0.5rem;
}
.pdf-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--accent-1);
  text-decoration: none;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
}
.pdf-link:hover {
  border-color: var(--accent-1);
}
.pdf-link.sm {
  padding: 0.15rem 0.45rem;
  font-size: 0.72rem;
}
.empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.history-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.history-table td {
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border-subtle);
}
.files-cell {
  display: flex;
  gap: 0.4rem;
}
</style>
