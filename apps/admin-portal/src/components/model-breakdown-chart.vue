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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps<{
  breakdown: Array<{
    key: string
    name: string
    rawScore: number
    weightedScore: number
    importantLevel: number
    skipped: boolean
  }>
  totalScore: number
}>()

const chartData = computed(() => ({
  labels: props.breakdown.map(r => r.name),
  datasets: [{
    data: props.breakdown.map(r => r.skipped ? 0 : r.weightedScore),
    backgroundColor: (ctx: any) => {
      const item = props.breakdown[ctx.dataIndex]
      return item?.skipped ? 'rgba(144,144,176,0.15)' : 'rgba(123,104,238,0.70)'
    },
    borderColor: (ctx: any) => {
      const item = props.breakdown[ctx.dataIndex]
      return item?.skipped ? 'rgba(144,144,176,0.35)' : 'rgba(123,104,238,0.90)'
    },
    borderWidth: (ctx: any) => {
      const item = props.breakdown[ctx.dataIndex]
      return item?.skipped ? 1 : 0
    },
    borderRadius: 3,
    hoverBackgroundColor: (ctx: any) => {
      const item = props.breakdown[ctx.dataIndex]
      return item?.skipped ? 'rgba(144,144,176,0.25)' : 'rgba(123,104,238,0.90)'
    },
    minBarLength: 2,
  }]
}))

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const item = props.breakdown[ctx.dataIndex]
          if (!item) return ''
          return item.skipped
            ? 'Hisoblanmagan'
            : `${item.weightedScore} ball (og'irlik: ${item.importantLevel})`
        },
      },
    },
  },
  scales: {
    x: {
      max: props.totalScore || 100,
      grid: { color: 'rgba(123,104,238,0.10)' },
      ticks: { font: { size: 10 }, color: '#9090b0' },
    },
    y: {
      ticks: {
        font: { size: 11 },
        color: (ctx: any) => {
          const item = props.breakdown[ctx.index]
          return item?.skipped ? '#9090b0' : '#5c5c7e'
        },
      },
      grid: { display: false },
    },
  },
}))

const chartHeight = computed(() => `${Math.max(props.breakdown.length * 28, 200)}px`)
</script>

<template>
  <div class="chart-wrap" :style="{ height: chartHeight }">
    <Bar :data="chartData" :options="(chartOptions as any)" />
  </div>
</template>

<style scoped>
.chart-wrap {
  width: 100%;
}
</style>
