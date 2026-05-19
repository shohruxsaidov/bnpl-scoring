import { ref, onMounted } from 'vue'

export function usePageLoad(baseMs = 800) {
  const loading = ref(true)
  onMounted(() => {
    const delay = baseMs + Math.random() * 400
    setTimeout(() => { loading.value = false }, delay)
  })
  return { loading }
}
