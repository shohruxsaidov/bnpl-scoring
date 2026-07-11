<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapPin {
  id: string
  name: string
  lat: number
  lng: number
}

const props = defineProps<{
  /** Draft position of the branch being edited. Null → nothing to drag yet. */
  modelValue: [number, number] | null
  /** Saved pins of the merchant's other branches, for context. */
  others: MapPin[]
  center: [number, number]
}>()

const emit = defineEmits<{ 'update:modelValue': [[number, number]] }>()

// Yandex's raster tiles carry a pinned build stamp in the URL, and Yandex retires
// those without notice — at which point every tile 404s and the map goes blank.
// Keeping the URL in an env var means that outage is fixed by a redeploy, not by
// a code change.
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ??
  'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&v=22.05.23-0-b220520184800&x={x}&y={y}&z={z}&scale=2&lang=ru_RU'

const el = ref<HTMLDivElement>()
let map: L.Map | undefined
let draftMarker: L.Marker | undefined
const othersLayer = L.layerGroup()

// Leaflet's default marker resolves its icon from a relative image path, which
// Vite's bundling breaks. A divIcon has no assets to lose — and it lets the
// active pin differ from the context pins by a class rather than a second PNG.
function pinIcon(variant: 'active' | 'muted') {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin map-pin--${variant}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  })
}

function drawOthers() {
  othersLayer.clearLayers()
  for (const p of props.others) {
    L.marker([p.lat, p.lng], { icon: pinIcon('muted'), interactive: false })
      .bindTooltip(p.name, { direction: 'top', offset: [0, -20] })
      .addTo(othersLayer)
  }
}

function drawDraft() {
  const pos = props.modelValue
  if (!pos) {
    draftMarker?.remove()
    draftMarker = undefined
    return
  }
  if (!draftMarker) {
    draftMarker = L.marker(pos, { icon: pinIcon('active'), draggable: true, zIndexOffset: 1000 })
      .on('dragend', () => {
        const { lat, lng } = draftMarker!.getLatLng()
        emit('update:modelValue', [lat, lng])
      })
      .addTo(map!)
  } else {
    draftMarker.setLatLng(pos)
  }
}

// Imperative on purpose: the parent flies the map when the admin picks a branch
// or pastes coordinates, but must NOT fly it when the admin has just dragged the
// pin — a watcher on `center` couldn't tell those apart.
function flyTo(lat: number, lng: number, zoom = 16) {
  map?.flyTo([lat, lng], zoom, { duration: 0.6 })
}
defineExpose({ flyTo })

onMounted(async () => {
  map = L.map(el.value!, { center: props.center, zoom: 12, zoomControl: true })
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: '© Яндекс' }).addTo(map)
  othersLayer.addTo(map)
  map.on('click', (e: L.LeafletMouseEvent) => {
    emit('update:modelValue', [e.latlng.lat, e.latlng.lng])
  })
  drawOthers()
  drawDraft()
  // The tab panel is v-if'd in, so the container may still be laying out on the
  // frame the map is created: without this the tiles render into a 0×0 box.
  await nextTick()
  map.invalidateSize()
})

onBeforeUnmount(() => {
  map?.remove()
  map = undefined
  draftMarker = undefined
})

watch(() => props.others, drawOthers, { deep: true })
watch(() => props.modelValue, drawDraft)
</script>

<template>
  <div ref="el" class="branch-map" />
</template>

<style>
/* Unscoped: Leaflet builds the marker element outside Vue, so a scoped selector
   would never match it. */
.map-pin {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgb(0 0 0 / 35%);
}

.map-pin--active {
  background: var(--accent-2, #6366f1);
}

.map-pin--muted {
  background: #94a3b8;
  opacity: 0.85;
}
</style>

<style scoped>
.branch-map {
  height: 460px;
  width: 100%;
  border-radius: 10px;
  z-index: 0;
}
</style>
