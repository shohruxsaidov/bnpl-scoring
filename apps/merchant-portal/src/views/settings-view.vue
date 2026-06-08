<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale, t } = useI18n()
const isDark = ref(false)

onMounted(() => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
})

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  isDark.value = theme === 'dark'
}

function setLang(lang: 'uz' | 'ru') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-section">
      <h2 class="section-title">{{ t('settings.appearance') }}</h2>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('settings.theme') }}</span>
          <span class="setting-desc">{{ isDark ? t('settings.darkDesc') : t('settings.lightDesc') }}</span>
        </div>
        <div class="option-group">
          <button
            class="option-btn"
            :class="{ active: !isDark }"
            @click="setTheme('light')"
          >
            <i class="pi pi-sun" />
            <span>{{ t('settings.light') }}</span>
          </button>
          <button
            class="option-btn"
            :class="{ active: isDark }"
            @click="setTheme('dark')"
          >
            <i class="pi pi-moon" />
            <span>{{ t('settings.dark') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2 class="section-title">{{ t('settings.language') }}</h2>
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('settings.interfaceLang') }}</span>
          <span class="setting-desc">{{ t('settings.interfaceLangDesc') }}</span>
        </div>
        <div class="option-group">
          <button
            class="option-btn"
            :class="{ active: locale === 'uz' }"
            @click="setLang('uz')"
          >
            <span class="flag">🇺🇿</span>
            <span>O'zbek</span>
          </button>
          <button
            class="option-btn"
            :class="{ active: locale === 'ru' }"
            @click="setLang('ru')"
          >
            <span class="flag">🇷🇺</span>
            <span>Русский</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 680px;
  padding: 2rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding: 1rem 1.25rem 0.6rem;
  margin: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.85rem 1.25rem 1.1rem;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.setting-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.option-group {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-base);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.option-btn:hover {
  border-color: var(--accent-1);
  color: var(--text-primary);
}

.option-btn.active {
  background: var(--gradient-accent);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--accent-glow);
}

.flag {
  font-size: 1rem;
  line-height: 1;
}

@media (max-width: 600px) {
  .settings-page { padding: 1.2rem 1rem; }
  .setting-row { flex-direction: column; align-items: flex-start; gap: 0.8rem; }
}
</style>
