<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type Plugin,
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
    inputValue?: string | null
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
  layout: { padding: { right: 40 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const item = props.breakdown[ctx.dataIndex]
          if (!item) return ''
          if (item.skipped) return 'Hisoblanmagan'
          const base = `${item.weightedScore} ball (og'irlik: ${item.importantLevel})`
          return item.inputValue ? `${base} · Qiymat: ${item.inputValue}` : base
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

const hasInputValues = computed(() => props.breakdown.some(r => r.inputValue))
const chartHeight = computed(() => `${Math.max(props.breakdown.length * (hasInputValues.value ? 36 : 28), 200)}px`)

const dataLabelPlugin: Plugin<'bar'> = {
  id: 'barDataLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const meta = chart.getDatasetMeta(0)
    meta.data.forEach((bar: any, index: number) => {
      const item = props.breakdown[index]
      if (!item || item.skipped || item.weightedScore === 0) return
      const x = bar.x + 5
      const y = bar.y
      ctx.save()
      if (item.inputValue) {
        // Two-line label: score on top, input value below
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(167,150,255,0.95)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(item.weightedScore), x, y - 6)
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(144,144,176,0.85)'
        ctx.fillText(item.inputValue, x, y + 6)
      } else {
        ctx.font = 'bold 11px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(167,150,255,0.95)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(item.weightedScore), x, y)
      }
      ctx.restore()
    })
  }
}
</script>

<template>
  <div class="chart-wrap" :style="{ height: chartHeight }">
    <Bar :data="chartData" :options="(chartOptions as any)" :plugins="[dataLabelPlugin]" />
  </div>
</template>

<style scoped>
.chart-wrap {
  width: 100%;
}
</style>
