<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col mt-6">
    
    <!-- Rīku un kontroles josla -->
    <div class="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      
      <!-- Režīmu pārslēdzējs -->
      <div class="flex flex-wrap bg-gray-200/50 p-1 rounded-lg gap-1">
        <button 
          @click="viewMode = 'daily'" 
          class="px-3 md:px-2 py-1.5 text-sm font-semibold rounded-md transition-all"
          :class="viewMode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          Pa Dienām
        </button>
        <button 
          @click="viewMode = 'slots'" 
          class="px-3 md:px-2 py-1.5 text-sm font-semibold rounded-md transition-all"
          :class="viewMode === 'slots' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          Top Intervāli
        </button>
        <button 
          @click="viewMode = 'users'" 
          class="px-3 md:px-2 py-1.5 text-sm font-semibold rounded-md transition-all"
          :class="viewMode === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
        >
          Dalībnieki
        </button>
      </div>

      <!-- Filtri un Kārtošana -->
      <div class="flex items-center gap-4">
        <!-- Poga tagad redzama gan slots, gan users režīmā -->
        <button 
          v-if="viewMode === 'slots' || viewMode === 'users'" 
          @click="toggleSort" 
          class="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-blue-600 transition bg-white px-2 py-1 rounded border border-gray-200 shadow-sm"
        >
          <span v-if="sortOrder === 'desc'">⬇ Dilstoši</span>
          <span v-else>⬆ Augoši</span>
        </button>

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
    </div>

    <!-- 1. REŽĪMS: Labākās dienas -->
    <div v-if="viewMode === 'daily'" class="p-6 relative h-[280px] flex flex-col justify-end">
      <div class="absolute inset-0 px-6 py-6 flex flex-col justify-between pointer-events-none">
        <div class="border-b border-dashed border-gray-200 w-full h-0 relative"><span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">{{ activeParticipants }}</span></div>
        <div class="border-b border-dashed border-gray-200 w-full h-0 relative"><span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">{{ Math.ceil(activeParticipants / 2) }}</span></div>
        <div class="border-b border-gray-300 w-full h-0 relative"><span class="absolute -top-3 -left-2 text-xs text-gray-400 bg-white pr-1">0</span></div>
      </div>
      <div class="relative flex items-end justify-between gap-2 md:gap-6 h-full z-10 pl-4">
        <div v-for="(dayScore, index) in dailyMaxScores" :key="index" class="relative flex flex-col items-center flex-1 h-full group">
          <div class="absolute -top-10 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            Maks. pieejami: {{ dayScore }}
          </div>
          <div class="w-full max-w-[48px] bg-blue-50 rounded-t-md flex items-end justify-center h-full">
            <div class="w-full bg-blue-500 rounded-t-md transition-all duration-500 ease-out hover:bg-blue-600 cursor-pointer" :style="{ height: `${getBarHeight(dayScore)}%` }"></div>
          </div>
          <div class="mt-3 text-sm font-semibold text-gray-600">{{ days[index] }}</div>
        </div>
      </div>
    </div>

<!-- 2. REŽĪMS: Top Intervāli -->
    <div v-else-if="viewMode === 'slots'" class="p-6 h-[280px] overflow-y-auto custom-scrollbar">
      <div v-if="processedSlots.length === 0" class="text-center text-gray-400 mt-16 font-medium">Nav atrasts neviens atbilstošs laiks.</div>
      <div v-else class="flex flex-col gap-3">
        <div v-for="(slot, i) in processedSlots" :key="i" class="flex items-center gap-3 text-sm group cursor-pointer">
          <div class="w-40 text-right font-medium text-gray-700 shrink-0">
            {{ slot.day }}, 
            <span class="text-gray-500">
              {{ formatHour(slot.start, authStore.user?.settings?.timeFormat || '24h') }} - 
              {{ formatHour(slot.end, authStore.user?.settings?.timeFormat || '24h') }}
            </span>
          </div>
          <div class="flex-1 bg-blue-50 rounded-md h-8 relative flex items-center">
            <div class="bg-blue-500 hover:bg-blue-600 rounded-md h-8 transition-all duration-700 ease-out" :style="{ width: `${getBarHeight(slot.score)}%` }"></div>
            <span class="absolute left-3 font-bold text-white drop-shadow-sm pointer-events-none">{{ slot.score }} cilv.</span>
            <div class="hidden group-hover:block absolute z-20 bg-gray-800 text-white text-xs p-2 rounded shadow-xl -mt-14 left-4 whitespace-nowrap pointer-events-none">
              Pieejamības indekss: {{ slot.score }} no {{ activeParticipants }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. REŽĪMS: Dalībnieki -->
    <div v-else-if="viewMode === 'users'" class="p-6 h-[280px] overflow-y-auto custom-scrollbar">
      <div v-if="userStats.length === 0" class="text-center text-gray-400 mt-16 font-medium">Nav datu par dalībniekiem.</div>
      <div v-else class="flex flex-col gap-5">
        <div v-for="(user, i) in userStats" :key="i" class="flex flex-col gap-1">
          <div class="flex justify-between items-end">
            <div class="font-bold text-gray-700 flex items-center gap-2">
              {{ sortOrder === 'desc' ? i + 1 : userStats.length - i }}. {{ user.username }}
              <span v-if="user.role === 'Owner'" class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.2 rounded border border-gray-300">Īpašnieks</span>
            </div>
            <div class="text-sm font-bold text-indigo-600">{{ user.totalScore }}h <span class="text-gray-400 font-medium text-xs">nedēļā</span></div>
          </div>
          
          <div class="w-full bg-indigo-50 rounded-md h-3 relative flex items-center overflow-hidden">
            <div class="bg-indigo-400 rounded-md h-3 transition-all duration-700 ease-out" :style="{ width: `${(user.totalScore / maxUserScore) * 100}%` }"></div>
          </div>

          <div class="flex flex-wrap gap-2 mt-1">
            <span class="text-xs text-gray-400 font-medium py-0.5">Top dienas:</span>
            <span v-for="(td, j) in user.topDays" :key="j" class="text-xs bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
              {{ td.day }} ({{ td.score }}h)
            </span>
          </div>
        </div>
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
const fullDays = ['Pirmdiena', 'Otrdiena', 'Trešdiena', 'Ceturtdiena', 'Piektdiena', 'Sestdiena', 'Svētdiena']

const includeMaybe = ref(true)
const viewMode = ref<'daily' | 'slots' | 'users'>('daily')
const sortOrder = ref<'desc' | 'asc'>('desc')

const toggleSort = () => { sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc' }

const activeParticipants = computed(() => {
  if (!props.heatmapData) return 0;
  return props.heatmapData.filter(p => p.intervals && p.intervals.length > 0).length;
})

const gridData = computed(() => {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ available: 0, maybe: 0 })))
  if (!props.heatmapData) return grid;
  
  // Reaktīvs laika zonas mainīgais
  const timezone = authStore.user?.timezone || 'UTC'

  props.heatmapData.forEach(participant => {
    if (!participant.intervals) return;
    participant.intervals.forEach((inv: any) => {
      // 1. Pārvēršam intervālu no UTC uz Local
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

      // 2. Apstrādājam pāreju pāri pusnaktij
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

const dailyMaxScores = computed(() => {
  return gridData.value.map(dayHours => {
    let maxScore = 0;
    dayHours.forEach(hour => {
      let score = hour.available + (includeMaybe.value ? hour.maybe * 0.5 : 0);
      if (score > maxScore) maxScore = score;
    });
    return maxScore;
  });
})

const processedSlots = computed(() => {
  const slots: { day: string, start: number, end: number, score: number }[] = [];
  for (let d = 0; d < 7; d++) {
    let currentStart: number | null = null;
    let currentScore = 0;
    for (let h = 0; h <= 24; h++) {
      let score = 0;
      if (h < 24) score = gridData.value[d][h].available + (includeMaybe.value ? gridData.value[d][h].maybe * 0.5 : 0);
      if (score !== currentScore) {
        if (currentScore > 0 && currentStart !== null) {
          slots.push({ 
            day: fullDays[d], 
            start: currentStart, 
            end: h, 
            score: currentScore 
          });
        }
        currentStart = h;
        currentScore = score;
      }
    }
  }
  slots.sort((a, b) => sortOrder.value === 'desc' 
    ? b.score - a.score || fullDays.indexOf(a.day) - fullDays.indexOf(b.day)
    : a.score - b.score || fullDays.indexOf(a.day) - fullDays.indexOf(b.day)
  );
  return slots;
})

const getBarHeight = (score: number) => {
  const max = activeParticipants.value;
  if (max === 0) return 0;
  return (score / max) * 100;
}

const userStats = computed(() => {
  if (!props.heatmapData) return [];

  const stats = props.heatmapData.map(participant => {
    let totalScore = 0;
    const dayScores = [0, 0, 0, 0, 0, 0, 0];

    if (participant.intervals) {
      participant.intervals.forEach((inv: any) => {
        const startHour = inv.start / 60;
        const endHour = inv.end / 60;

        for (let i = startHour; i < endHour; i++) {
          const d = Math.floor(i / 24);
          if (d >= 0 && d < 7) {
            let multiplier = 0;
            if (inv.status === 'Pieejams') multiplier = 1;
            else if (inv.status === 'Varbut' && includeMaybe.value) multiplier = 0.5;

            totalScore += multiplier;
            dayScores[d] += multiplier;
          }
        }
      });
    }

    const topDays = dayScores
      .map((score, index) => ({ day: fullDays[index], score }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      username: participant.username,
      role: participant.role,
      totalScore,
      topDays
    };
  });

  // Pievienota kārtošanas loģika atkarībā no 'sortOrder'
  return stats.filter(u => u.totalScore > 0).sort((a, b) => {
    if (sortOrder.value === 'desc') {
      return b.totalScore - a.totalScore;
    } else {
      return a.totalScore - b.totalScore;
    }
  });
})

const maxUserScore = computed(() => {
  if (userStats.value.length === 0) return 1;
  return Math.max(...userStats.value.map(u => u.totalScore));
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>