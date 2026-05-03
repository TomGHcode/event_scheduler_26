<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
    
    <!-- Rīku josla / Filtrēšana -->
    <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
      <div class="text-sm text-gray-700 font-medium">
        Aktīvie dalībnieki (ar tabulām): <span class="font-bold text-blue-600">{{ activeParticipants }}</span> / {{ totalParticipants }}
      </div>
      <div class="flex items-center gap-2">
        <input 
          type="checkbox" 
          id="includeMaybe" 
          v-model="includeMaybe" 
          class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
        />
        <label for="includeMaybe" class="text-sm text-gray-700 font-medium cursor-pointer select-none">
          Pieskaitīt "Varbūt" (dod 0.5 punktus)
        </label>
      </div>
    </div>

    <!-- Kalendāra režģis -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-center border-collapse">
        <thead>
          <tr>
            <th class="p-2 border border-gray-200 bg-gray-50 w-16">Laiks</th>
            <th v-for="day in days" :key="day" class="p-2 border border-gray-200 bg-gray-50 font-semibold text-gray-700">
              {{ day }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hour in 24" :key="hour">
            <td class="p-2 border border-gray-200 bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
              <!-- formatHour no util -->
              {{ formatHour(hour - 1, authStore.user?.settings?.timeFormat || '24h') }}
            </td>
            <td 
              v-for="dayIndex in 7" 
              :key="dayIndex" 
              class="border border-gray-200 h-10 transition-all duration-300 relative group cursor-pointer"
              :style="getCellStyle(dayIndex - 1, hour - 1)"
            >
              <!-- Info lodziņš (Tooltip) -->
              <div class="hidden group-hover:block absolute z-20 bg-gray-800 text-white text-xs p-3 rounded shadow-xl -mt-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none">
                <div class="font-bold border-b border-gray-600 pb-1 mb-1">{{ days[dayIndex - 1] }} {{ formatHour(hour - 1, authStore.user?.settings?.timeFormat || '24h') }} - {{ formatHour(hour, authStore.user?.settings?.timeFormat || '24h') }}</div>
                <div class="flex items-center gap-2 text-green-400">
                  <span class="w-2 h-2 rounded-full bg-green-400"></span>
                  Pieejami: {{ getCellData(dayIndex - 1, hour - 1).available }} / {{ activeParticipants }}
                </div>
                <div class="flex items-center gap-2 text-yellow-300 mt-1">
                  <span class="w-2 h-2 rounded-full bg-yellow-300"></span>
                  Varbūt: {{ getCellData(dayIndex - 1, hour - 1).maybe }} / {{ activeParticipants }}
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-between text-sm text-gray-600 items-center">
      <div class="italic text-xs text-gray-500">*Cilvēki bez piesaistītas tabulas netiek ņemti vērā aprēķinā.</div>
      <div class="flex items-center gap-2">
        <span>Tukšs</span>
        <div class="w-32 h-3 rounded-full bg-gradient-to-r from-gray-100 to-green-500 border border-gray-300"></div>
        <span>Visi</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { formatHour, utcToLocal } from '../utils/time'

const props = defineProps<{
  heatmapData: any[];
  totalParticipants: number;
}>()

const authStore = useAuthStore()
const days = ['Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se', 'Sv']
const includeMaybe = ref(true) // Pēc noklusējuma rādām arī "Varbūt"

// Saskaitām tikai tos, kuriem reāli ir intervāli (piesaistīta tabula)
const activeParticipants = computed(() => {
  if (!props.heatmapData) return 0;
  return props.heatmapData.filter(p => p.intervals && p.intervals.length > 0).length;
})

// Aprēķinām datus
const gridData = computed(() => {
  const grid = Array.from({ length: 7 }, () => 
    Array.from({ length: 24 }, () => ({ available: 0, maybe: 0 }))
  )

  if (!props.heatmapData) return grid;
  const timezone = authStore.user?.timezone || 'UTC'

  props.heatmapData.forEach(participant => {
    if (!participant.intervals) return;
    
    participant.intervals.forEach((inv: any) => {
      // Pārvēršam no UTC uz Local (līdzīgi kā AvailabilityGrid)
      const localStartMinute = utcToLocal(inv.start, timezone)
      let localEndMinute = utcToLocal(inv.end, timezone)
      if (localEndMinute === 0 && inv.end !== 0) localEndMinute = 10080;

      const startHourTotal = localStartMinute / 60;
      const endHourTotal = localEndMinute / 60;
      
      const applyScore = (start: number, end: number) => {
         for (let i = start; i < end; i++) {
            const d = Math.floor(i / 24);
            const h = i % 24;
            if (d < 7 && h < 24) {
              if (inv.status === 'Pieejams') grid[d][h].available += 1;
              if (inv.status === 'Varbut') grid[d][h].maybe += 1;
            }
          }
      }

      if (startHourTotal > endHourTotal) {
         applyScore(startHourTotal, 168)
         applyScore(0, endHourTotal)
      } else {
         applyScore(startHourTotal, endHourTotal)
      }
    })
  })

  return grid;
})

const getCellData = (day: number, hour: number) => {
  return gridData.value[day][hour];
}

// Ģenerējam krāsu
const getCellStyle = (day: number, hour: number) => {
  const cell = gridData.value[day][hour];
  const maxScore = activeParticipants.value;
  
  if (maxScore === 0) return { backgroundColor: '#f9fafb' }; // bg-gray-50
  
  // Rēķinām rezultātu. Ja includeMaybe ir true, pieskaitām "Varbūt" kā 0.5
  let score = cell.available;
  if (includeMaybe.value) {
    score += (cell.maybe * 0.5);
  }

  if (score === 0) return { backgroundColor: '#f9fafb' };
  
  const ratio = Math.min(score / maxScore, 1); // Nodrošinām, ka nepārsniedz 1 (jeb 100%)
  
  // Zaļā krāsa ar dinamisku caurspīdīgumu
  return { backgroundColor: `rgba(34, 197, 94, ${ratio})` };
}
</script>