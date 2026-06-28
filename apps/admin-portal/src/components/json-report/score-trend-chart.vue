<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { type Json, dateSortKey, isObject } from '@/utils/json-report'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

const props = defineProps<{
  // The `dynamics_of_scoring_ball` wrapper: { periods: [...] }.
  value: unknown
}>()

const points = computed<{ label: string; score: number }[]>(() => {
  const v = props.value
  const arr = Array.isArray(v) ? v : isObject(v) ? (v as Json).periods : null
  if (!Array.isArray(arr)) return []
  return (arr.filter(isObject) as Json[])
    .map((p) => ({
      label: String(p.period ?? p.score_date ?? ''),
      sort: dateSortKey(p.score_date ?? p.period),
      score: Number(p.score_point),
    }))
    .filter((p) => Number.isFinite(p.score))
    .sort((a, b) => a.sort.localeCompare(b.sort))
})

const chartData = computed(() => ({
  labels: points.value.map((p) => p.label),
  datasets: [
    {
      label: 'Score',
      data: points.value.map((p) => p.score),
      borderColor: 'rgba(123,104,238,0.9)',
      backgroundColor: 'rgba(123,104,238,0.15)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: 'rgba(123,104,238,1)',
      tension: 0.3,
      fill: true,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9090b0' } },
    y: {
      ticks: { font: { size: 10 }, color: '#9090b0' },
      grid: { color: 'rgba(123,104,238,0.10)' },
    },
  },
}
</script>

<template>
  <div v-if="points.length" class="chart-wrap">
    <Line :data="chartData" :options="(chartOptions as any)" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 220px;
  width: 100%;
}
</style>
