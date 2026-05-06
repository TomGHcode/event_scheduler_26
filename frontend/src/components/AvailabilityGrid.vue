<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-center border-collapse">
        <thead>
          <tr>
            <th class="p-2 border border-gray-200 bg-gray-50 w-20">Laiks</th>
            <th v-for="day in days" :key="day" class="p-2 border border-gray-200 bg-gray-50 font-semibold text-gray-700">
              {{ day }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hour in 24" :key="hour">
            <!-- Formatējam stundu, izmantojot palīgfunkciju un store datus -->
            <td class="p-2 border border-gray-200 bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
              {{ formatHour(hour - 1, authStore.user?.settings?.timeFormat || '24h') }}
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
import { useAuthStore } from '../stores/auth'
import { formatHour, localToUtc, utcToLocal } from '../utils/time'

const days = ['Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se', 'Sv']
type Status = 'Nav pieejams' | 'Pieejams' | 'Varbut'

// 7 dienas x 24 stundas
const grid = ref<Status[][]>(Array.from({ length: 7 }, () => Array(24).fill('Nav pieejams')))

// Peles vilkšanas loģika ērtai iezīmēšanai
const isDragging = ref(false)
const dragStatus = ref<Status>('Pieejams')
const authStore = useAuthStore()

// Klausāmies uz eventu, lai pārveidotu stundas, gadījumā ja iestatījumi mainās
onMounted(() => {
  window.addEventListener('mouseup', stopDrag)
})
onUnmounted(() => {
  window.removeEventListener('mouseup', stopDrag)
})

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


// --- LAIKA ZONU LOĢIKA SŪTĪŠANAI (Local -> UTC) ---
const compileIntervals = () => {
  const timezone = authStore.user?.timezone || 'UTC'
  
  // 1. Iegūstam visus "jēlos" (raw) intervālus lokālajā laikā pa stundām
  const rawIntervals: { start: number, end: number, status: Status }[] = []
  
  for (let d = 0; d < 7; d++) {
    let currentStart = null
    let currentStatus = null
    
    for (let h = 0; h <= 24; h++) {
      const status = h < 24 ? grid.value[d][h] : 'Nav pieejams'
      
      if (status !== currentStatus) {
        if (currentStatus !== null && currentStatus !== 'Nav pieejams' && currentStart !== null) {
          rawIntervals.push({
            start: d * 24 * 60 + currentStart * 60,
            end: d * 24 * 60 + h * 60,
            status: currentStatus
          })
        }
        currentStart = h
        currentStatus = status
      }
    }
  }

  // 2. Sapludinām (merge) blakus esošos intervālus ar vienādu statusu
  if (rawIntervals.length === 0) return []
  
  const mergedIntervals = [rawIntervals[0]]
  for (let i = 1; i < rawIntervals.length; i++) {
    const last = mergedIntervals[mergedIntervals.length - 1]
    const current = rawIntervals[i]
    
    // Ja iepriekšējais beidzas turpat, kur sākas jaunais, UN tiem ir vienāds statuss
    if (last.end === current.start && last.status === current.status) {
      last.end = current.end // Sapludinām vienā lielā blokā
    } else {
      mergedIntervals.push(current)
    }
  }

  // 3. Pārbaudām nedēļas robežu (Ja Svētdienas beigas savienojas ar Pirmdienas sākumu)
  if (mergedIntervals.length > 1) {
    const first = mergedIntervals[0]
    const last = mergedIntervals[mergedIntervals.length - 1]
    
    // 10080 ir nedēļas beigas (7 * 24 * 60)
    if (last.end === 10080 && first.start === 0 && last.status === first.status) {
      last.end = first.end // Šis radīs intervālu, kur start_minute > end_minute
      mergedIntervals.shift() // Izdzēšam pirmo, jo tas ir pievienots pēdējam
    }
  }

  // 4. Konvertējam apstrādātos intervālus uz UTC un atgriežam backendam
  return mergedIntervals.map(inv => ({
    start_minute: localToUtc(inv.start, timezone),
    end_minute: localToUtc(inv.end, timezone),
    status_level: inv.status
  }))
}

// saņemam datus no datubāzes un pārvēršam tos atpakaļ režģī
// --- LAIKA ZONU LOĢIKA IELĀDEI (UTC -> Local) ---
const loadIntervals = (intervals: any[]) => {
  const timezone = authStore.user?.timezone || 'UTC'

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.value[d][h] = 'Nav pieejams'
    }
  }
  
  intervals.forEach(inv => {
    // Pārvēršam no datubāzes UTC uz lietotāja vietējo laiku
    const localStartMinute = utcToLocal(inv.start_minute, timezone)
    // Beigu minūte var pārlekt pāri nedēļai, ja tā beidzas pusnaktī
    let localEndMinute = utcToLocal(inv.end_minute, timezone)
    if (localEndMinute === 0 && inv.end_minute !== 0) {
        localEndMinute = 10080; // Svētdienas beigas (7 * 24 * 60)
    }

    const startHourTotal = localStartMinute / 60
    const endHourTotal = localEndMinute / 60
    
    // ja intervāls pēc pārrēķina šķērso pusnakti starp Svētdienu un Pirmdienu
    if (startHourTotal > endHourTotal) {
       // Sadalām divās daļās: līdz nedēļas beigām un no nedēļas sākuma
       fillGrid(startHourTotal, 168, inv.status_level) // 168h nedēļā
       fillGrid(0, endHourTotal, inv.status_level)
    } else {
       fillGrid(startHourTotal, endHourTotal, inv.status_level)
    }
  })
}

const fillGrid = (startHourTotal: number, endHourTotal: number, status: Status) => {
    for (let i = startHourTotal; i < endHourTotal; i++) {
      const d = Math.floor(i / 24)
      const h = i % 24
      if (d < 7 && h < 24) {
        grid.value[d][h] = status
      }
    }
}

// Ļaujam vecākkomponentei piekļūt šai funkcijai + loadintervals
defineExpose({ compileIntervals, loadIntervals })
</script>