<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, type Plugin } from 'chart.js'

ChartJS.register(ArcElement)

const props = defineProps<{
  score: number
  maxScore?: number
}>()

const max = computed(() => props.maxScore ?? 500)

const ZONES = [
  { label: 'E',  size: 100, color: '#e74c3c' },
  { label: 'D',  size: 100, color: '#e67e22' },
  { label: 'C',  size: 100, color: '#f1c40f' },
  { label: 'B',  size: 100, color: '#2ecc71' },
  { label: 'A',  size: 50,  color: '#27ae60' },
  { label: 'A1', size: 50,  color: '#1a8a4a' },
]

const chartData = computed(() => ({
  datasets: [{
    data: ZONES.map(z => z.size),
    backgroundColor: ZONES.map(z => z.color),
    borderWidth: 0,
    hoverOffset: 0,
  }]
}))

// rotation:180° = left (9 o'clock); circumference:180° clockwise → left→top→right (∩ shape)
// canvas angle at fraction frac: Math.PI * (1 + frac)
const needlePlugin: Plugin<'doughnut'> = {
  id: 'gaugeNeedle',
  afterDraw(chart) {
    const meta = chart.getDatasetMeta(0)
    if (!meta.data.length) return
    const arc = meta.data[0] as any
    const { x: cx, y: cy, innerRadius, outerRadius } = arc
    const { ctx } = chart

    const frac = Math.min(Math.max(props.score / max.value, 0), 1)
    const angle = Math.PI * (1 + frac) // π(left) → 1.5π(top) → 2π(right)

    // Zone labels outside the arc
    let cumFrac = 0
    ZONES.forEach(zone => {
      const zoneFrac = zone.size / max.value
      const midFrac = cumFrac + zoneFrac / 2
      const a = Math.PI * (1 + midFrac)
      const lr = outerRadius + 14
      const lx = cx + lr * Math.cos(a)
      const ly = cy + lr * Math.sin(a)
      ctx.save()
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.fillStyle = zone.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(zone.label, lx, ly)
      ctx.restore()
      cumFrac += zoneFrac
    })

    // Needle
    const needleLen = innerRadius * 0.88
    const nx = cx + needleLen * Math.cos(angle)
    const ny = cy + needleLen * Math.sin(angle)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(nx, ny)
    ctx.strokeStyle = 'rgba(55,65,81,0.9)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(55,65,81,0.9)'
    ctx.fill()

    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-primary').trim() || '#1a1a2e'
    ctx.font = 'bold 20px system-ui, sans-serif'
    ctx.fillStyle = textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(props.score), cx, cy - 2)
    ctx.restore()
  }
}

const chartOptions = computed(() => ({
  rotation: -90,
  circumference: 180,
  cutout: '65%',
  maintainAspectRatio: false,
  plugins: {
    tooltip: { enabled: false },
    legend: { display: false },
  },
  events: [] as string[],
  layout: { padding: { top: 10, left: 22, right: 22, bottom: 2 } },
}))
</script>

<template>
  <div class="gauge-wrap">
    <Doughnut :data="chartData" :options="(chartOptions as any)" :plugins="[needlePlugin]" />
  </div>
</template>

<style scoped>
.gauge-wrap {
  width: 100%;
  max-width: 260px;
  height: 150px;
}
</style>
