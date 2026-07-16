<script setup lang="ts">
import { computed } from 'vue'
import { formatSomShort } from '@/utils/money'

const props = withDefaults(
  defineProps<{
    /** value in som */
    value: number
    gradient?: boolean
    size?: 'sm' | 'md' | 'lg'
    suffix?: string
  }>(),
  { gradient: false, size: 'md', suffix: "so'm" },
)

const display = computed(() => formatSomShort(props.value))
const fontSize = computed(() => ({ sm: '0.8rem', md: '0.95rem', lg: '1.4rem' })[props.size])
</script>

<template>
  <span
    class="mono-amount font-mono"
    :class="{ 'text-gradient': gradient }"
    :style="{ fontSize }"
  >
    {{ display }}<span v-if="suffix" class="suffix">&nbsp;{{ suffix }}</span>
  </span>
</template>

<style scoped>
.mono-amount {
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.suffix {
  font-size: 0.7em;
  font-weight: 600;
  opacity: 0.7;
}
</style>
