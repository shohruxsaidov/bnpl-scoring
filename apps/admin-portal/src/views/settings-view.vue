<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

function setLang(lang: 'uz' | 'ru') {
  locale.value = lang
  localStorage.setItem('lang', lang)
}

const isDark = ref(false)

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
  isDark.value = theme === 'dark'
}

onMounted(() => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
})
</script>

<template>
  <div class="settings">
    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.language') }}</h3>
      </header>
      <div class="option-group">
        <button class="option-btn" :class="{ active: locale === 'uz' }" @click="setLang('uz')">
          <span class="opt-flag">🇺🇿</span>
          <div class="opt-text">
            <span class="opt-name">O'zbek</span>
            <span class="opt-code">uz</span>
          </div>
          <i v-if="locale === 'uz'" class="pi pi-check check-icon" />
        </button>
        <button class="option-btn" :class="{ active: locale === 'ru' }" @click="setLang('ru')">
          <span class="opt-flag">🇷🇺</span>
          <div class="opt-text">
            <span class="opt-name">Русский</span>
            <span class="opt-code">ru</span>
          </div>
          <i v-if="locale === 'ru'" class="pi pi-check check-icon" />
        </button>
      </div>
    </section>

    <section class="surface-card panel">
      <header class="panel-head">
        <h3 class="section-title">{{ $t('settings.theme') }}</h3>
      </header>
      <div class="option-group">
        <button class="option-btn" :class="{ active: !isDark }" @click="setTheme('light')">
          <i class="pi pi-sun opt-icon" />
          <div class="opt-text">
            <span class="opt-name">{{ $t('settings.themeLight') }}</span>
          </div>
          <i v-if="!isDark" class="pi pi-check check-icon" />
        </button>
        <button class="option-btn" :class="{ active: isDark }" @click="setTheme('dark')">
          <i class="pi pi-moon opt-icon" />
          <div class="opt-text">
            <span class="opt-name">{{ $t('settings.themeDark') }}</span>
          </div>
          <i v-if="isDark" class="pi pi-check check-icon" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
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
.option-group {
  display: flex;
  flex-direction: column;
}
.option-btn {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.85rem 1.1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  color: var(--text-primary);
}
.option-btn:last-child {
  border-bottom: none;
}
.option-btn:hover {
  background: var(--bg-surface);
}
.option-btn.active {
  background: color-mix(in srgb, var(--accent-1) 8%, transparent);
}
.opt-flag {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}
.opt-icon {
  font-size: 1.1rem;
  color: var(--text-secondary);
  width: 1.4rem;
  text-align: center;
  flex-shrink: 0;
}
.option-btn.active .opt-icon {
  color: var(--accent-1);
}
.opt-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.opt-name {
  font-weight: 600;
  font-size: 0.9rem;
}
.opt-code {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
}
.check-icon {
  color: var(--accent-1);
  font-size: 0.85rem;
  flex-shrink: 0;
}
</style>
