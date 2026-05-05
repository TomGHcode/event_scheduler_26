<template>
  <div class="flex flex-wrap gap-4 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
    
    <!-- Laika formāta komponente -->
    <div v-if="showFormat" class="flex items-center gap-2">
      <label class="text-sm font-semibold text-gray-700">Laika formāts:</label>
      <div class="bg-gray-100 p-1 rounded-lg flex gap-1">
        <button 
          @click="changeFormat('24h')" 
          :class="localFormat === '24h' ? 'bg-white shadow text-blue-600' : 'text-gray-500'"
          class="px-3 py-1 text-sm font-medium rounded-md transition"
        >24h</button>
        <button 
          @click="changeFormat('12h')" 
          :class="localFormat === '12h' ? 'bg-white shadow text-blue-600' : 'text-gray-500'"
          class="px-3 py-1 text-sm font-medium rounded-md transition"
        >12h</button>
      </div>
    </div>

    <!-- Laika zonas komponente -->
    <div v-if="showTimezone" class="flex items-center gap-2">
      <label class="text-sm font-semibold text-gray-700">Laika zona:</label>
      <select 
        v-model="localTimezone" 
        @change="saveSettings"
        class="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 max-w-[200px]"
      >
        <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
      </select>
    </div>

    <div v-if="isSaving" class="text-xs text-gray-400">Saglabā...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  showTimezone?: boolean;
  showFormat?: boolean;
}>()

const authStore = useAuthStore()
const localFormat = ref<'12h'|'24h'>('24h')
const localTimezone = ref('Europe/Riga')
const isSaving = ref(false)


const commonTimezones = [
  // Universālais laiks
  'UTC',

  // Eiropa
  'Europe/London',       // Apvienotā Karaliste, Īrija, Portugāle
  'Europe/Paris',        // Centrāleiropa (Francija, Spānija, Vācija u.c.)
  'Europe/Riga',         // Baltija, Austrumeiropa (EET/EEST)
  'Europe/Kyiv',         // Ukraina
  'Europe/Istanbul',     // Turcija

  // Ziemeļamerika
  'America/Los_Angeles', // Pacific Time (PT)
  'America/Denver',      // Mountain Time (MT)
  'America/Chicago',     // Central Time (CT)
  'America/New_York',    // Eastern Time (ET)
  'America/Toronto',     // Kanāda (Austrumi)
  'America/Mexico_City', // Meksika

  // Dienvidamerika
  'America/Sao_Paulo',   // Brazīlija
  'America/Buenos_Aires',// Argentīna
  'America/Santiago',    // Čīle

  // Āfrika
  'Africa/Cairo',        // Ēģipte
  'Africa/Lagos',        // Rietumāfrika (Nigērija)
  'Africa/Johannesburg', // Dienvidāfrika

  // Āzija
  'Asia/Jerusalem',      // Izraēla
  'Asia/Dubai',          // AAE
  'Asia/Karachi',        // Pakistāna
  'Asia/Kolkata',        // Indija
  'Asia/Bangkok',        // Taizeme, Vjetnama
  'Asia/Singapore',      // Singapūra, Malaizija
  'Asia/Shanghai',       // Ķīna
  'Asia/Tokyo',          // Japāna
  'Asia/Seoul',          // Dienvidkoreja

  // Austrālija un Klusais okeāns
  'Australia/Perth',     // Austrālija (Rietumi)
  'Australia/Sydney',    // Austrālija (Austrumi)
  'Pacific/Auckland',    // Jaunzēlande
  'Pacific/Honolulu'     // Havaju salas
]

onMounted(() => {
  if (authStore.user) {
    localFormat.value = authStore.user.settings?.timeFormat || '24h'
    localTimezone.value = authStore.user.timezone || 'Europe/Riga'
    
    // Ja lietotāja zona nav sarakstā, pievienojam to
    if (!commonTimezones.includes(localTimezone.value)) {
      commonTimezones.push(localTimezone.value)
    }
  }
})

const changeFormat = async (format: '12h'|'24h') => {
  localFormat.value = format
  await saveSettings()
}

const saveSettings = async () => {
  isSaving.value = true
  await authStore.updateSettings(localTimezone.value, localFormat.value)
  // Šeit varētu izsaukt event, lai pārējās komponentes (grid) atjauninās
  window.dispatchEvent(new Event('settings-updated'))
  isSaving.value = false
}
</script>