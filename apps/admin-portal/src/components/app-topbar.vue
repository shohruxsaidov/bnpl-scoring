<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineProps<{ showMenuBtn?: boolean }>()
const emit = defineEmits<{ (e: 'menu'): void }>()

const route = useRoute()
const { t, locale } = useI18n()

const title = computed(() => {
  const key = route.meta.titleKey as string | undefined
  return key ? t(key) : t('topbar.scoring')
})
const breadcrumb = computed(() => {
  const keys = (route.meta.breadcrumbKeys as string[]) ?? []
  return keys.map((k) => t(k))
})

function setLang(lang: 'uz' | 'ru') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

const today = new Date().toLocaleDateString('uz-UZ', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
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

    <div class="search">
      <i class="pi pi-search" />
      <input type="text" :placeholder="$t('topbar.searchPlaceholder')" />
    </div>

    <div class="right">
      <span class="date font-mono">{{ today }}</span>
      <div class="lang-switch">
        <button class="lang-btn" :class="{ active: locale === 'uz' }" @click="setLang('uz')">
          uz
        </button>
        <span class="lang-sep">|</span>
        <button class="lang-btn" :class="{ active: locale === 'ru' }" @click="setLang('ru')">
          ru
        </button>
      </div>
    </div>
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

.left {
  display: flex;
  align-items: center;
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

.lang-switch {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  border-radius: 10px;
  padding: 0.28rem 0.5rem;
  height: 38px;
}

.lang-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-weight: 700;
  font-size: 0.76rem;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0.15rem 0.3rem;
  border-radius: 6px;
  transition: color 0.15s ease;
}

.lang-btn:hover {
  color: var(--text-primary);
}

.lang-btn.active {
  color: var(--accent-2);
}

.lang-sep {
  color: var(--border-subtle);
  font-size: 0.76rem;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 38px;
  padding: 0 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-muted);
  font-size: 0.85rem;
  transition: all 0.15s ease;
  min-width: 280px;
}

.search:focus-within {
  border-color: var(--accent-1);
}

.search i {
  font-size: 0.85rem;
  color: var(--accent-1);
  flex-shrink: 0;
}

.search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

.search input::placeholder {
  color: var(--text-muted);
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

  .search {
    display: none;
  }
}
</style>
