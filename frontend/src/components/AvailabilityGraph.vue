<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col mt-6">
    
    <!-- Rīku josla -->
    <div class="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
      <h3 class="font-bold text-gray-700">Labākā pieejamība pa dienām</h3>
      <div class="flex items-center gap-2">
        <input 
          type="checkbox" 
          id="graphIncludeMaybe" 
          v-model="includeMaybe" 
          class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
        />
        <label for="graphIncludeMaybe" class="text-sm text-gray-700 font-medium cursor-pointer select-none">
          Pieskaitīt "Varbūt" (0.5)
        </label>
      </div>
    </div>

    <!-- Diagramma -->
    <div class="p-6 relative h-64 flex flex-col justify-end">
      <!-- Y-ass (Fona līnijas) -->
      <div class="absolute inset-0 px-6 py-6 flex flex-col justify-between pointer-events-none">
        <div class="border-b border-dashed border-gray-200 w-full h-0 relative">
          <span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">{{ activeParticipants }}</span>
        </div>
        <div class="border-b border-dashed border-gray-200 w-full h-0 relative">
          <span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">{{ Math.ceil(activeParticipants / 2) }}</span>
        </div>
        <div class="border-b border-gray-300 w-full h-0 relative">
          <span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">0</span>
        </div>
      </div>

      <!-- Stabiņi -->
      <div class="relative flex items-end justify-between gap-2 md:gap-6 h-full z-10 pl-4">
        <div 
          v-for="(dayScore, index) in dailyMaxScores" 
          :key="index"
          class="relative flex flex-col items-center flex-1 h-full group"
        >
          <!-- Info Lodziņš (Tooltip) -->
          <div class="absolute -top-10 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            Maks. pieejami: {{ dayScore }}
          </div>
          
          <!-- Pats stabiņš -->
          <div class="w-full max-w-[48px] bg-blue-50 rounded-t-md flex items-end justify-center h-full">
            <div 
              class="w-full bg-blue-500 rounded-t-md transition-all duration-500 ease-out hover:bg-blue-600 cursor-pointer"
              :style="{ height: `${getBarHeight(dayScore)}%` }"
            ></div>
          </div>
          
          <!-- Dienas nosaukums -->
          <div class="mt-3 text-sm font-semibold text-gray-600">{{ days[index] }}</div>
        </div>
      </div>
    </div>
    
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  heatmapData: any[];
  totalParticipants: number;
}>()

const days = ['Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se', 'Sv']
const includeMaybe = ref(true)

// Saskaitām tikai tos, kuriem reāli ir tabulas
const activeParticipants = computed(() => {
  if (!props.heatmapData) return 0;
  return props.heatmapData.filter(p => p.intervals && p.intervals.length > 0).length;
})

// Aprēķinām katras dienas vislabāko rezultātu (stundu, kurā var ierasties visvairāk cilvēku)
const dailyMaxScores = computed(() => {
  const grid = Array.from({ length: 7 }, () => 
    Array.from({ length: 24 }, () => ({ available: 0, maybe: 0 }))
  )

  if (!props.heatmapData) return Array(7).fill(0);

  // 1. Aizpildām režģi tāpat kā Heatmap komponentē
  props.heatmapData.forEach(participant => {
    if (!participant.intervals) return;
    
    participant.intervals.forEach((inv: any) => {
      const startHour = inv.start / 60;
      const endHour = inv.end / 60;
      
      for (let i = startHour; i < endHour; i++) {
        const d = Math.floor(i / 24);
        const h = i % 24;
        if (d < 7 && h < 24) {
          if (inv.status === 'Pieejams') grid[d][h].available += 1;
          if (inv.status === 'Varbut') grid[d][h].maybe += 1;
        }
      }
    })
  })

  // 2. Katrai dienai atrodam stundu ar vislielāko rezultātu
  return grid.map(dayHours => {
    let maxScore = 0;
    dayHours.forEach(hour => {
      let score = hour.available;
      if (includeMaybe.value) {
        score += (hour.maybe * 0.5);
      }
      if (score > maxScore) maxScore = score;
    });
    return maxScore;
  });
})

// Aprēķinām stabiņa augstumu procentos
const getBarHeight = (score: number) => {
  const max = activeParticipants.value;
  if (max === 0) return 0;
  return (score / max) * 100;
}
</script>