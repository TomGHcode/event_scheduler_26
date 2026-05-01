<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
            <td class="p-2 border border-gray-200 bg-gray-50 text-gray-500 font-medium">
              {{ `${hour - 1}:00` }}
            </td>
            <td 
              v-for="dayIndex in 7" 
              :key="dayIndex" 
              @mousedown="startDrag(dayIndex - 1, hour - 1)"
              @mouseenter="onDrag(dayIndex - 1, hour - 1)"
              @mouseup="stopDrag"
              class="border border-gray-200 cursor-pointer transition-colors duration-100 select-none h-10"
              :class="getStatusColor(grid[dayIndex - 1][hour - 1])"
            >
              <!-- Šūna bez teksta, tikai krāsa -->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Leģenda un kontroles -->
    <div class="p-4 bg-gray-50 flex items-center justify-between border-t border-gray-200">
      <div class="flex gap-4">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded bg-white border border-gray-300"></span> Nav pieejams
        </div>
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded bg-green-400 border border-green-500"></span> Pieejams
        </div>
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded bg-yellow-300 border border-yellow-400"></span> Varbūt
        </div>
      </div>
      <div class="text-sm text-gray-500">
        Klikšķini vai velc, lai mainītu statusu!
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const days = ['Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se', 'Sv']
type Status = 'Nav pieejams' | 'Pieejams' | 'Varbut'

// 7 dienas x 24 stundas
const grid = ref<Status[][]>(Array.from({ length: 7 }, () => Array(24).fill('Nav pieejams')))

// Peles vilkšanas loģika ērtai iezīmēšanai
const isDragging = ref(false)
const dragStatus = ref<Status>('Pieejams')

const getNextStatus = (current: Status): Status => {
  if (current === 'Nav pieejams') return 'Pieejams'
  if (current === 'Pieejams') return 'Varbut'
  return 'Nav pieejams'
}

const getStatusColor = (status: Status) => {
  if (status === 'Pieejams') return 'bg-green-400 hover:bg-green-500'
  if (status === 'Varbut') return 'bg-yellow-300 hover:bg-yellow-400'
  return 'bg-white hover:bg-gray-100'
}

const startDrag = (day: number, hour: number) => {
  isDragging.value = true
  const newStatus = getNextStatus(grid.value[day][hour])
  dragStatus.value = newStatus
  grid.value[day][hour] = newStatus
}

const onDrag = (day: number, hour: number) => {
  if (isDragging.value) {
    grid.value[day][hour] = dragStatus.value
  }
}

const stopDrag = () => {
  isDragging.value = false
}

// Nodrošinām, ka peles atbrīvošana ārpus tabulas apstādina vilkšanu
onMounted(() => window.addEventListener('mouseup', stopDrag))
onUnmounted(() => window.removeEventListener('mouseup', stopDrag))

// Funkcija, ko var izsaukt vecākkomponente, lai iegūtu apstrādātus intervālus
const compileIntervals = () => {
  const intervals = []
  
  for (let d = 0; d < 7; d++) {
    let currentStart = null
    let currentStatus = null
    
    // Ejam cauri visām stundām dienā, +1 papildus solis, lai "aizvērtu" pēdējo intervālu dienas beigās
    for (let h = 0; h <= 24; h++) {
      const status = h < 24 ? grid.value[d][h] : 'Nav pieejams'
      
      if (status !== currentStatus) {
        if (currentStatus !== null && currentStatus !== 'Nav pieejams' && currentStart !== null) {
          intervals.push({
            start_minute: d * 24 * 60 + currentStart * 60, //
            end_minute: d * 24 * 60 + h * 60,              //
            status_level: currentStatus                    //
          })
        }
        currentStart = h
        currentStatus = status
      }
    }
  }
  return intervals
}

// Funkcija, kas saņem datus no datubāzes un pārvērš tos atpakaļ režģī
const loadIntervals = (intervals: any[]) => {
  // 1. Notīrām režģi (visu uzstādām kā "Nav pieejams")
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.value[d][h] = 'Nav pieejams'
    }
  }
  
  // 2. Aizpildām ar saņemtajiem intervāliem
  intervals.forEach(inv => {
    // Pārvēršam minūtes atpakaļ uz stundām no nedēļas sākuma
    const startHourTotal = inv.start_minute / 60
    const endHourTotal = inv.end_minute / 60
    
    for (let i = startHourTotal; i < endHourTotal; i++) {
      const d = Math.floor(i / 24)
      const h = i % 24
      if (d < 7 && h < 24) {
        grid.value[d][h] = inv.status_level
      }
    }
  })
}

// Ļaujam vecākkomponentei piekļūt šai funkcijai + loadintervals
defineExpose({ compileIntervals, loadIntervals })
</script>