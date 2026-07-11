<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { useMerchantsStore } from '@/stores/merchants'
import { formatDate } from '@/utils/money'
import type { Merchant } from '@/types'

const merchants = useMerchantsStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

onMounted(() => {
  merchants.fetchAll().catch(() => {
    toast.add({
      severity: 'error',
      summary: t('merchants.loadFailed'),
      life: 3000,
    })
  })
})

function openAdd() {
  router.push('/onboarding/new')
}

async function toggleStatus(merchant: Merchant) {
  try {
    await merchants.update(merchant.id, { active: !merchant.active })
    toast.add({
      severity: 'info',
      summary: merchant.active ? t('merchants.merchantSuspended') : t('merchants.merchantActivated'),
      detail: merchant.name,
      life: 2000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('merchants.updateFailed'),
      life: 3000,
    })
  }
}
</script>

<template>
  <div class="merchants">
    <div class="head">
      <p class="muted count">
        {{ $t('merchants.summary', { total: merchants.merchants.length }) }}
      </p>
      <button class="btn-gradient" @click="openAdd">
        <i class="pi pi-plus" /> {{ $t('merchants.addMerchant') }}
      </button>
    </div>

    <div class="surface-card table-wrap">
      <DataTable
        :value="merchants.merchants"
        data-key="id"
        :loading="merchants.loading"
        :paginator="merchants.merchants.length > 10"
        :rows="10"
        size="small"
      >
        <Column :header="$t('merchants.name')" sortable field="name">
          <template #body="{ data }">
            <div class="name-cell">
              <img v-if="data.logoUrl" :src="data.logoUrl" :alt="data.name" class="row-logo" />
              <span v-else class="row-logo row-logo-empty">{{ data.name.charAt(0) }}</span>
              <span class="t-name">{{ data.name }}</span>
            </div>
          </template>
        </Column>
        <Column :header="$t('merchants.inn')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.inn }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.phone')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ data.phone }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.active')">
          <template #body="{ data }">
            <ToggleSwitch
              :model-value="data.active"
              @update:model-value="toggleStatus(data)"
            />
          </template>
        </Column>
        <Column :header="$t('merchants.created')">
          <template #body="{ data }">
            <span class="font-mono muted">{{ formatDate(data.createdAt) }}</span>
          </template>
        </Column>
        <Column :header="$t('merchants.actions')">
          <template #body="{ data }">
            <div class="actions">
              <button
                class="icon-btn"
                :title="$t('merchants.view')"
                @click="router.push(`/merchants/${data.id}`)"
              >
                <i class="pi pi-eye" />
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.merchants {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.count {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 600;
}
.table-wrap {
  padding: 0;
  overflow: hidden;
}
@media (max-width: 600px) { .table-wrap { overflow-x: auto; } }
.t-name {
  font-weight: 700;
  font-size: 0.86rem;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.row-logo {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}
.row-logo-empty {
  display: grid;
  place-items: center;
  background: var(--gradient-hero);
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
}
.actions {
  display: flex;
  gap: 0.35rem;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 0.78rem;
  transition: all 0.12s ease;
}
.icon-btn:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
</style>
