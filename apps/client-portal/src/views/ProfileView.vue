<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { maskPinfl } from '@/utils/money'
import type { LinkedCard } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const client = computed(() => auth.client)

const initials = computed(() => {
  const n = client.value?.fullName ?? ''
  return n
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const cards: LinkedCard[] = [
  { id: 'card_1', brand: 'UZCARD', pan: '8600 **** **** 4417' },
  { id: 'card_2', brand: 'HUMO', pan: '9860 **** **** 0192' },
]

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div v-if="client" class="profile">
    <header class="ph surface-card">
      <div class="avatar">{{ initials }}</div>
      <div class="ph-name">{{ client.fullName }}</div>
      <div class="ph-phone font-mono">{{ client.phone }}</div>
    </header>

    <section class="block surface-card">
      <h2 class="block-title">Personal information</h2>
      <div class="row">
        <span class="row-label">Full name</span>
        <span class="row-value">{{ client.fullName }}</span>
      </div>
      <div class="row">
        <span class="row-label">Phone</span>
        <span class="row-value font-mono">{{ client.phone }}</span>
      </div>
      <div class="row">
        <span class="row-label">PINFL</span>
        <span class="row-value font-mono">{{
          maskPinfl(client.pinfl)
        }}</span>
      </div>
      <div class="row">
        <span class="row-label">Passport</span>
        <span class="row-value font-mono">{{
          client.passportSerial
        }}</span>
      </div>
    </section>

    <section class="block surface-card">
      <h2 class="block-title">Linked cards</h2>
      <div v-for="c in cards" :key="c.id" class="card-row">
        <span class="card-icon"><i class="pi pi-credit-card" /></span>
        <div class="card-info">
          <span class="card-brand">{{ c.brand }}</span>
          <span class="card-pan font-mono">{{ c.pan }}</span>
        </div>
      </div>
    </section>

    <section class="block surface-card">
      <h2 class="block-title">Preferences</h2>
      <div class="row toggle-row">
        <div>
          <span class="row-value">Appearance</span>
          <span class="row-hint">Switch between light and dark</span>
        </div>
        <ThemeToggle />
      </div>
    </section>

    <button class="logout" @click="logout">
      <i class="pi pi-sign-out" /> Log out
    </button>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ph {
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  text-align: center;
}
.avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--gradient-hero);
  color: #fff;
  font-size: 1.7rem;
  font-weight: 800;
  display: grid;
  place-items: center;
  margin-bottom: 0.4rem;
}
.ph-name {
  font-size: 1.3rem;
  font-weight: 800;
}
.ph-phone {
  font-size: 0.88rem;
  color: var(--text-secondary);
}
.block {
  padding: 1.3rem;
}
.block-title {
  margin: 0 0 1rem;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.row:first-of-type {
  padding-top: 0;
}
.row-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 600;
}
.row-value {
  font-size: 0.9rem;
  font-weight: 700;
  text-align: right;
}
.toggle-row {
  align-items: center;
}
.row-hint {
  display: block;
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-top: 0.2rem;
}
.card-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--border-subtle);
}
.card-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.card-row:first-of-type {
  padding-top: 0;
}
.card-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: var(--bg-surface);
  color: var(--accent-2);
  display: grid;
  place-items: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.card-brand {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.card-pan {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 14px;
  padding: 0.95rem;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.logout:hover {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
}
</style>
