<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import {
  BANNER_ASPECT_RATIO,
  BANNER_ASPECT_TOLERANCE,
  MIN_BANNER_IMAGE_WIDTH,
  useBannersStore,
  type Banner,
  type BannerActionType,
  type BannerImageInput,
} from '@/stores/banners'
import { useMerchantsStore } from '@/stores/merchants'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const store = useBannersStore()
const merchantsStore = useMerchantsStore()

const isNew = computed(() => route.name === 'banner-new')
const bannerId = computed(() => (isNew.value ? null : Number(route.params.id)))

const loading = ref(!isNew.value)
const saving = ref(false)
const existing = ref<Banner | null>(null)

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp']

interface ImageSlot {
  /** Existing art, shown until a replacement is picked. */
  currentUrl: string | null
  file: File | null
  previewUrl: string | null
  width: number | null
  height: number | null
  error: string | null
}

function emptySlot(): ImageSlot {
  return { currentUrl: null, file: null, previewUrl: null, width: null, height: null, error: null }
}

const images = reactive<Record<'uz' | 'ru', ImageSlot>>({ uz: emptySlot(), ru: emptySlot() })

const form = reactive({
  title: '',
  actionType: 'none' as BannerActionType,
  actionUrl: '',
  merchantId: null as string | null,
  isActive: true,
  startsAt: null as Date | null,
  endsAt: null as Date | null,
  sortOrder: 0,
})

const actionOptions = computed(() => [
  { value: 'none' as const, label: t('banners.action.none') },
  { value: 'external_url' as const, label: t('banners.action.externalUrl') },
  { value: 'merchant' as const, label: t('banners.action.merchant') },
])

/* ── Merchant picker ────────────────────────────────────────────────────────
 * A banner-only admin may not hold view_merchants, in which case the list request
 * 403s. That is not an error worth blocking the form for — fall back to typing the
 * id, which is what the API validates anyway.
 */
const merchantListAvailable = ref(true)
const merchantOptions = computed(() =>
  merchantsStore.merchants
    .filter((m) => m.active && m.visibleInClientApp)
    .map((m) => ({ value: m.id, label: m.name })),
)

onMounted(async () => {
  merchantsStore.fetchAll().catch(() => {
    merchantListAvailable.value = false
  })

  if (isNew.value) return
  try {
    const banner = await store.fetchOne(bannerId.value!)
    existing.value = banner
    form.title = banner.title
    form.actionType = banner.actionType
    form.actionUrl = banner.actionType === 'external_url' ? (banner.actionValue ?? '') : ''
    form.merchantId = banner.actionType === 'merchant' ? banner.actionValue : null
    form.isActive = banner.isActive
    form.startsAt = banner.startsAt ? new Date(banner.startsAt) : null
    form.endsAt = banner.endsAt ? new Date(banner.endsAt) : null
    form.sortOrder = banner.sortOrder
    images.uz.currentUrl = banner.imageUrlUz
    images.ru.currentUrl = banner.imageUrlRu
  } catch {
    toast.add({ severity: 'error', summary: t('banners.loadFailed'), life: 3000 })
    router.push({ name: 'banners' })
  } finally {
    loading.value = false
  }
})

/* ── Image picking ──────────────────────────────────────────────────────────
 * Validated here as well as on the server. The server's check is the one that
 * counts; this one exists so the admin learns the export is the wrong shape
 * before uploading five megabytes to be told so.
 */
async function pickImage(e: Event, lang: 'uz' | 'ru') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  const slot = images[lang]
  slot.error = null

  if (!file) return

  if (!ALLOWED_MIMES.includes(file.type)) {
    slot.error = t('banners.errImageType')
    return
  }

  const size = await readImageSize(file).catch(() => null)
  debugger
  if (!size) {
    slot.error = t('banners.errImageUnreadable')
    return
  }
  if (size.width < MIN_BANNER_IMAGE_WIDTH) {
    slot.error = t('banners.errTooSmall', { min: MIN_BANNER_IMAGE_WIDTH })
    return
  }
  // if (
  //   Math.abs(size.width / size.height - BANNER_ASPECT_RATIO) >
  //   BANNER_ASPECT_RATIO * BANNER_ASPECT_TOLERANCE
  // ) {
  //   slot.error = t('banners.errAspect', { w: size.width, h: size.height })
  //   return
  // }

  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  slot.file = file
  slot.previewUrl = URL.createObjectURL(file)
  slot.width = size.width
  slot.height = size.height
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

function clearPick(lang: 'uz' | 'ru') {
  const slot = images[lang]
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  slot.file = null
  slot.previewUrl = null
  slot.width = null
  slot.height = null
  slot.error = null
}

/* ── Save ───────────────────────────────────────────────────────────────────*/

const actionValue = computed<string | null>(() => {
  if (form.actionType === 'external_url') return form.actionUrl.trim() || null
  if (form.actionType === 'merchant') return form.merchantId
  return null
})

const validationError = computed<string | null>(() => {
  if (!form.title.trim()) return t('banners.errTitleRequired')
  if (isNew.value && (!images.uz.file || !images.ru.file)) return t('banners.errBothImages')
  if (form.actionType !== 'none' && !actionValue.value) return t('banners.errActionValue')
  if (form.actionType === 'external_url' && !/^https:\/\//i.test(form.actionUrl.trim())) {
    return t('banners.errHttps')
  }
  if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) return t('banners.errWindow')
  return null
})

const canSave = computed(() => !validationError.value && !saving.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    // Upload first: a banner is only created once its art exists in storage.
    const [imageUz, imageRu] = await Promise.all([
      images.uz.file ? store.uploadImage(images.uz.file) : Promise.resolve(undefined),
      images.ru.file ? store.uploadImage(images.ru.file) : Promise.resolve(undefined),
    ])

    const payload = {
      title: form.title.trim(),
      ...(imageUz ? { imageUz: toImageInput(imageUz) } : {}),
      ...(imageRu ? { imageRu: toImageInput(imageRu) } : {}),
      actionType: form.actionType,
      actionValue: actionValue.value,
      isActive: form.isActive,
      startsAt: form.startsAt ? form.startsAt.toISOString() : null,
      endsAt: form.endsAt ? form.endsAt.toISOString() : null,
      sortOrder: form.sortOrder,
    }

    if (isNew.value) {
      await store.create(payload)
      toast.add({ severity: 'success', summary: t('banners.created'), life: 2000 })
    } else {
      await store.update(bannerId.value!, payload)
      toast.add({ severity: 'success', summary: t('banners.saved'), life: 2000 })
    }
    router.push({ name: 'banners' })
  } catch (e: any) {
    // The API answers with a code (invalid_aspect_ratio, merchant_not_found, …);
    // show its own words when we have a translation, and a generic failure when
    // we do not, rather than swallowing the reason.
    const code = e?.message
    const key = `banners.apiError.${code}`
    const translated = t(key)
    toast.add({
      severity: 'error',
      summary: translated === key ? t('banners.saveFailed') : translated,
      life: 4000,
    })
  } finally {
    saving.value = false
  }
}

function toImageInput(uploaded: BannerImageInput & { width: number; height: number }) {
  return {
    objectKey: uploaded.objectKey,
    originalName: uploaded.originalName,
    mimeType: uploaded.mimeType,
  }
}
</script>

<template>
  <div class="banner-form-page">
    <router-link class="back-link" :to="{ name: 'banners' }">
      <i class="pi pi-arrow-left" />
      {{ t('banners.backToList') }}
    </router-link>

    <p v-if="loading" class="empty">{{ t('common.loading') }}</p>

    <template v-else>
      <!-- ── Artwork ───────────────────────────────────────────────────────── -->
      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">{{ t('banners.artwork') }}</h3>
          <p class="section-hint">{{ t('banners.artworkHint') }}</p>
        </header>
        <div class="panel-body image-grid">
          <div v-for="lang in (['uz', 'ru'] as const)" :key="lang" class="image-col">
            <label class="field-label">{{ t(`banners.image_${lang}`) }}</label>

            <label class="drop">
              <input type="file" accept="image/png,image/jpeg,image/webp" class="file-native"
                @change="pickImage($event, lang)" />
              <img v-if="images[lang].previewUrl || images[lang].currentUrl"
                :src="images[lang].previewUrl ?? images[lang].currentUrl!" alt="" />
              <span v-else class="drop-empty">
                <i class="pi pi-image" />
                {{ t('banners.chooseImage') }}
              </span>
            </label>

            <p v-if="images[lang].error" class="err">{{ images[lang].error }}</p>
            <p v-else-if="images[lang].file" class="dims">
              {{ images[lang].width }}×{{ images[lang].height }}
              <button class="link-btn" @click="clearPick(lang)">{{ t('common.cancel') }}</button>
            </p>
          </div>
        </div>
      </section>

      <!-- ── Settings ──────────────────────────────────────────────────────── -->
      <section class="surface-card panel">
        <header class="panel-head">
          <h3 class="section-title">{{ t('banners.settings') }}</h3>
        </header>
        <div class="panel-body form">
          <div class="field">
            <label class="field-label">{{ t('banners.title') }}</label>
            <InputText v-model="form.title" maxlength="200" :placeholder="t('banners.titleHint')" />
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t('banners.actionLabel') }}</label>
              <Select v-model="form.actionType" :options="actionOptions" option-label="label" option-value="value" />
            </div>

            <div v-if="form.actionType === 'external_url'" class="field">
              <label class="field-label">{{ t('banners.url') }}</label>
              <InputText v-model="form.actionUrl" placeholder="https://" />
            </div>

            <div v-else-if="form.actionType === 'merchant'" class="field">
              <label class="field-label">{{ t('banners.merchant') }}</label>
              <Select v-if="merchantListAvailable" v-model="form.merchantId" :options="merchantOptions"
                option-label="label" option-value="value" filter :placeholder="t('banners.pickMerchant')" />
              <InputText v-else v-model="form.merchantId" :placeholder="t('banners.merchantId')" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field-label">{{ t('banners.startsAt') }}</label>
              <DatePicker v-model="form.startsAt" show-time hour-format="24" show-button-bar
                :placeholder="t('banners.immediately')" />
            </div>
            <div class="field">
              <label class="field-label">{{ t('banners.endsAt') }}</label>
              <DatePicker v-model="form.endsAt" show-time hour-format="24" show-button-bar
                :placeholder="t('banners.noEnd')" />
            </div>
            <div class="field narrow">
              <label class="field-label">{{ t('banners.sortOrder') }}</label>
              <InputNumber v-model="form.sortOrder" :min="0" :max="999" show-buttons />
            </div>
          </div>

          <label class="switch-row">
            <ToggleSwitch v-model="form.isActive" />
            <span>{{ t('banners.active') }}</span>
          </label>

          <p v-if="validationError" class="err">{{ validationError }}</p>

          <div class="actions">
            <button class="btn-gradient" :disabled="!canSave" @click="save">
              <i v-if="saving" class="pi pi-spin pi-spinner" />
              {{ isNew ? t('banners.create') : t('common.save') }}
            </button>
          </div>
        </div>
      </section>

      <!-- ── Stats (edit only) ─────────────────────────────────────────────── -->
      <section v-if="existing" class="surface-card panel">
        <div class="panel-body stats-row">
          <div class="stat">
            <span class="stat-num">{{ existing.viewCount }}</span>
            <span class="stat-label">{{ t('banners.views') }}</span>
          </div>
          <div class="stat-meta">
            <span>{{ t('banners.createdBy', { name: existing.createdByName ?? '—' }) }}</span>
            <span>{{ new Date(existing.createdAt).toLocaleString('ru-RU') }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.banner-form-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
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

.image-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.image-col {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

/* The exact box the phone renders into: what you see here is the crop clients get. */
.drop {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 1;
  border: 1px dashed var(--border-subtle);
  border-radius: 0.6rem;
  overflow: hidden;
  cursor: pointer;
  background: color-mix(in srgb, var(--accent-1) 3%, transparent);
}

.drop:hover {
  border-color: var(--accent-1);
}

.drop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.drop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 100%;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.drop-empty .pi {
  font-size: 1.2rem;
  color: var(--accent-1);
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

.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.form :deep(.p-inputtext),
.form :deep(.p-select),
.form :deep(.p-datepicker),
.form :deep(.p-inputnumber) {
  width: 100%;
}

.field {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  gap: 0.35rem;
}

.field.narrow {
  max-width: 9rem;
}

.field-row {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.err {
  margin: 0;
  font-size: 0.78rem;
  color: #dc2626;
}

.dims {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.link-btn {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-1);
  cursor: pointer;
}

.empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.stat {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 1.3rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.stat-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .image-grid {
    grid-template-columns: 1fr;
  }
}
</style>
