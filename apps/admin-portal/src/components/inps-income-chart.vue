<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, annotationPlugin)

const props = defineProps<{
  incomes: Array<{ period: string; orgname: string; income_summa: string }>
  avgMonthlyIncome: number | null
}>()

const sorted = computed(() =>
  [...props.incomes].sort((a, b) => a.period.localeCompare(b.period))
)

const chartData = computed(() => ({
  labels: sorted.value.map(r => r.period),
  datasets: [{
    label: 'Daromad (so\'m)',
    data: sorted.value.map(r => Number(r.income_summa)),
    backgroundColor: 'rgba(123,104,238,0.65)',
    borderColor: 'rgba(123,104,238,0.9)',
    borderWidth: 1,
    borderRadius: 4,
    hoverBackgroundColor: 'rgba(123,104,238,0.85)',
  }]
}))

// avgMonthlyIncome is in tiyin → divide by 100 for som
const avgSom = computed(() =>
  props.avgMonthlyIncome != null ? props.avgMonthlyIncome / 100 : null
)

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) =>
          `${Number(ctx.raw).toLocaleString('uz-UZ')} so'm`,
      },
    },
    annotation: {
      annotations: avgSom.value != null ? {
        avgLine: {
          type: 'line' as const,
          yMin: avgSom.value,
          yMax: avgSom.value,
          borderColor: 'rgba(157,78,221,0.85)',
          borderWidth: 1.5,
          borderDash: [6, 3],
          label: {
            display: true,
            content: 'Ort. oylik',
            position: 'end' as const,
            color: '#9d4edd',
            backgroundColor: 'transparent',
            font: { size: 10, weight: 'bold' as const },
            yAdjust: -10,
          },
        },
      } : {},
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#9090b0' },
    },
    y: {
      ticks: {
        font: { size: 10 },
        color: '#9090b0',
        callback: (v: any) => {
          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`
          if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
          return v
        },
      },
      grid: { color: 'rgba(123,104,238,0.10)' },
    },
  },
}))
</script>

<template>
  <div class="chart-wrap">
    <Bar :data="chartData" :options="(chartOptions as any)" />
  </div>
</template>

<style scoped>
.chart-wrap {
  height: 200px;
  width: 100%;
}
</style>
