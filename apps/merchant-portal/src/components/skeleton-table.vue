<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

withDefaults(defineProps<{
  rows?: number
  cols?: number
  hasActions?: boolean
  hasHeader?: boolean
}>(), {
  rows: 7,
  cols: 4,
  hasActions: true,
  hasHeader: true,
})
</script>

<template>
  <div class="sk-table surface-card">
    <!-- toolbar slot (optional) -->
    <div v-if="hasHeader" class="sk-toolbar">
      <Skeleton width="14rem" height="2.2rem" border-radius="10px" />
      <Skeleton width="9rem" height="2.2rem" border-radius="10px" />
    </div>

    <table class="sk-t">
      <!-- header row -->
      <thead>
        <tr>
          <th v-for="c in cols" :key="c">
            <Skeleton :width="c === 1 ? '7rem' : '5rem'" height="0.75rem" border-radius="4px" />
          </th>
          <th v-if="hasActions" class="th-actions" />
        </tr>
      </thead>

      <!-- data rows -->
      <tbody>
        <tr v-for="r in rows" :key="r">
          <td>
            <!-- first col: avatar + two lines -->
            <div class="cell-avatar">
              <Skeleton shape="circle" size="2rem" />
              <div class="cell-lines">
                <Skeleton width="8rem" height="0.8rem" border-radius="4px" />
                <Skeleton width="5rem" height="0.65rem" border-radius="4px" class="mt" />
              </div>
            </div>
          </td>
          <td v-for="c in cols - 1" :key="c">
            <Skeleton
              :width="c % 2 === 0 ? '6rem' : '4.5rem'"
              height="0.8rem"
              border-radius="4px"
            />
          </td>
          <td v-if="hasActions">
            <div class="cell-actions">
              <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
              <Skeleton width="1.8rem" height="1.8rem" border-radius="6px" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sk-table {
  border-radius: 14px;
  overflow: hidden;
}
.sk-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid var(--border-subtle);
}
.sk-t {
  width: 100%;
  border-collapse: collapse;
}
.sk-t thead tr {
  border-bottom: 1px solid var(--border-subtle);
}
.sk-t th, .sk-t td {
  padding: 0.85rem 1rem;
  text-align: left;
  vertical-align: middle;
}
.sk-t th.th-actions {
  width: 5rem;
}
.sk-t tbody tr + tr {
  border-top: 1px solid var(--border-subtle);
}
.cell-avatar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.cell-lines {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.mt {
  margin-top: 0;
}
.cell-actions {
  display: flex;
  gap: 0.4rem;
}
</style>
