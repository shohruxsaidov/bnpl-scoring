<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() => (route.meta.title as string) ?? 'Scoring')
const breadcrumb = computed(() => (route.meta.breadcrumb as string[]) ?? [])
</script>

<template>
  <header class="topbar">
    <div class="left">
      <h1 class="page-title">{{ title }}</h1>
      <nav v-if="breadcrumb.length" class="crumbs">
        <template v-for="(c, i) in breadcrumb" :key="i">
          <span :class="{ current: i === breadcrumb.length - 1 }">{{ c }}</span>
          <i v-if="i < breadcrumb.length - 1" class="pi pi-angle-right sep" />
        </template>
      </nav>
    </div>

    <div class="right">
      <div class="search">
        <i class="pi pi-search" />
        <input type="text" placeholder="Search tenants, deals, employees…" />
      </div>
      <button class="bell" title="Notifications">
        <i class="pi pi-bell" />
        <span class="badge">2</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.4rem;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}
.page-title {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0;
  line-height: 1.1;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 0.12rem;
  font-weight: 600;
}
.crumbs .current {
  color: var(--accent-2);
}
.sep {
  font-size: 0.6rem;
  opacity: 0.6;
}
.right {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 9px;
  padding: 0.45rem 0.75rem;
  width: 320px;
}
.search i {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.search input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-family: inherit;
  font-size: 0.82rem;
  color: var(--text-primary);
}
.search input::placeholder {
  color: var(--text-secondary);
}
.bell {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s ease;
}
.bell:hover {
  color: var(--accent-2);
  border-color: var(--accent-2);
}
.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--danger);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  padding: 0 4px;
}
</style>
