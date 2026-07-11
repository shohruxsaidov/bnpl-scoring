<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="settings-hub">
    <!-- Each card carries its own gate: the hub itself is reachable with either
         manage_settings or manage_scoring_model. -->
    <router-link
      v-if="auth.can('manage_settings')"
      class="surface-card hub-card"
      :to="{ name: 'settings-organization' }"
    >
      <div class="hub-icon">
        <i class="pi pi-building" />
      </div>
      <div class="hub-text">
        <span class="hub-title">{{ $t('settings.organizationInfo') }}</span>
        <span class="hub-desc">{{ $t('settings.organizationInfoDesc') }}</span>
      </div>
      <i class="pi pi-chevron-right hub-arrow" />
    </router-link>

    <router-link
      v-if="auth.can('manage_settings')"
      class="surface-card hub-card"
      :to="{ name: 'settings-public-offer' }"
    >
      <div class="hub-icon">
        <i class="pi pi-file-pdf" />
      </div>
      <div class="hub-text">
        <span class="hub-title">{{ $t('settings.publicOffer') }}</span>
        <span class="hub-desc">{{ $t('settings.publicOfferDesc') }}</span>
      </div>
      <i class="pi pi-chevron-right hub-arrow" />
    </router-link>

    <!-- manage_settings is not enough to reach this one — see the route's feature gate. -->
    <router-link
      v-if="auth.can('manage_scoring_model')"
      class="surface-card hub-card"
      :to="{ name: 'settings-scoring' }"
    >
      <div class="hub-icon">
        <i class="pi pi-sliders-h" />
      </div>
      <div class="hub-text">
        <span class="hub-title">{{ $t('settings.scoring') }}</span>
        <span class="hub-desc">{{ $t('settings.scoringDesc') }}</span>
      </div>
      <i class="pi pi-chevron-right hub-arrow" />
    </router-link>

    <router-link
      v-if="auth.can('manage_settings')"
      class="surface-card hub-card"
      :to="{ name: 'settings-interface' }"
    >
      <div class="hub-icon">
        <i class="pi pi-palette" />
      </div>
      <div class="hub-text">
        <span class="hub-title">{{ $t('settings.interface') }}</span>
        <span class="hub-desc">{{ $t('settings.interfaceDesc') }}</span>
      </div>
      <i class="pi pi-chevron-right hub-arrow" />
    </router-link>
  </div>
</template>

<style scoped>
.settings-hub {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  max-width: 720px;
}
.hub-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.1rem;
  text-decoration: none;
  color: var(--text-primary);
  transition:
    border-color 0.12s ease,
    background 0.12s ease;
}
.hub-card:hover {
  border-color: var(--accent-1);
  background: color-mix(in srgb, var(--accent-1) 4%, transparent);
}
.hub-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  flex-shrink: 0;
}
.hub-icon .pi {
  font-size: 1.15rem;
  color: var(--accent-1);
}
.hub-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.hub-title {
  font-weight: 700;
  font-size: 0.95rem;
}
.hub-desc {
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.hub-arrow {
  font-size: 0.8rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}
</style>
