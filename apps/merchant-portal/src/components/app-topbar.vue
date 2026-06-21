<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineProps<{ showMenuBtn?: boolean }>()
const emit = defineEmits<{ (e: 'menu'): void }>()

const route = useRoute()
const { t } = useI18n()

const title = computed(() => {
  const key = route.meta.titleKey as string | undefined
  return key ? t(key) : t('topbar.scoring')
})
const breadcrumb = computed(() => {
  const keys = (route.meta.breadcrumbKeys as string[]) ?? []
  return keys.map((k) => t(k))
})

</script>

<template>
  <header class="topbar">
    <div class="left">

      <button v-if="showMenuBtn" class="menu-btn" @click="emit('menu')">
        <i class="pi pi-bars" />
      </button>
      <div>
        <h1 class="page-title">{{ title }}</h1>
        <nav v-if="breadcrumb.length" class="crumbs">
          <template v-for="(c, i) in breadcrumb" :key="i">
            <span :class="{ current: i === breadcrumb.length - 1 }">{{ c }}</span>
            <i v-if="i < breadcrumb.length - 1" class="pi pi-angle-right sep" />
          </template>
        </nav>
      </div>
    </div>

    <div class="right"></div>
  </header>
</template>

<style scoped>
.topbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.6rem;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar .left {
  display: flex;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  line-height: 1.1;
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
  font-weight: 600;
}

.crumbs .current {
  color: var(--accent-2);
}

.sep {
  font-size: 0.65rem;
  opacity: 0.6;
}

.right {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.date {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.menu-btn {
  margin-right: 1.2rem;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .date {
    display: none;
  }

  .topbar {
    padding: 0 1rem;
  }

  .right {
    gap: 0.5rem;
  }

}
</style>
