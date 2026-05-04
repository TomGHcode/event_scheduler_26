<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-6xl mx-auto">
      
      <!-- Galvene ar nosaukumu un rediģēšanu -->
      <div class="flex flex-col md:flex-row text-left items-start md:items-center mb-6 gap-4">
        <div class="flex-1 w-full">
          <!-- Skatīšanās režīms -->
          <div v-if="!isEditingEvent" class="flex items-center gap-3">
            <h1 class="text-3xl font-bold text-gray-800 break-words max-w-xs lg:max-w-[800px] sm:max-w-[500px] md:max-w-[560px]">{{ eventName || 'Pasākums' }}</h1>
            <button v-if="myRole === 'Owner'" @click="enterEditMode" class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition text-gray-700">Rediģēt</button>
          </div>
          <!-- Rediģēšanas režīms -->
          <div v-else class="flex flex-col sm:flex-row gap-2 w-full max-w-xl">
            <input v-model="editEventName" type="text" maxlength="64" class="flex-1 px-3 py-2 border rounded-lg focus:ring-blue-500 font-bold" />
            <div class="flex gap-2">
              <button @click="saveEventDetails" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Saglabāt</button>
              <button @click="isEditingEvent = false" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm">Atcelt</button>
            </div>
          </div>
        </div>
        
        <button @click="$router.push('/')" class="text-gray-500 hover:text-gray-800 max-w-xs flex-1 shrink-0">Atpakaļ uz paneli</button>
      </div>

      <div v-if="isLoading" class="text-center py-10 text-gray-500">Ielādē datus...</div>
      <div v-else-if="errorMsg" class="text-center py-10 text-red-500">{{ errorMsg }}</div>
        <div v-else class="space-y-6">
          
          <!-- JAUNS: Pasākuma Apraksts (Tagad pilnā platumā augšpusē) -->
          <div v-if="eventDescription || isEditingEvent" class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 class="font-bold text-lg text-gray-800 mb-2">Apraksts</h3>
            
            <div v-if="!isEditingEvent" class="text-sm text-gray-600 whitespace-pre-wrap break-words">
              {{ eventDescription }}
            </div>
            
            <div v-else>
              <textarea 
                v-model="editEventDescription" 
                maxlength="1500" 
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 text-sm"
                placeholder="Pievieno aprakstu (maksimums 1500 simboli)"
              ></textarea>
              <div class="text-right text-xs text-gray-400 mt-1">{{ editEventDescription.length }}/1500</div>
            </div>
          </div>

          <!-- Apakšējais sadalījums (Tabula un Dalībnieki pa kreisi, Siltumkarte pa labi) -->
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            <!-- Kreisā kolonna -->
            <div class="lg:col-span-1 space-y-6">
              
              <!-- Mana tabula -->
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
                <h3 class="font-bold text-lg text-blue-800 mb-4">Mana Tabula</h3>
                <div class="mb-4">
                  <select v-model="selectedTableId" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 text-sm">
                    <option :value="null">-- Nepiesaistīt nevienu --</option>
                    <option v-for="t in myTables" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </div>
                <button 
                  @click="updateMyTable" 
                  :disabled="isSavingTable"
                  class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm transition"
                >
                  {{ isSavingTable ? 'Saglabā...' : 'Saglabāt izvēli' }}
                </button>
                <div v-if="updateMessage" class="mt-2 text-xs text-green-600 text-center">{{ updateMessage }}</div>
              </div>

              <!-- Dalībnieku saraksts -->
              <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="font-bold text-lg text-gray-800">Dalībnieki <span class="text-gray-500 text-sm font-normal">({{ heatmapData.length }})</span></h3>
                </div>
                
                <!-- Ja isParticipantsExpanded ir true, uzliekam max-augstumu un ritināšanas joslu -->
                <ul 
                  class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2 transition-all"
                  :class="{ 'max-h-[624px] overflow-y-auto custom-scrollbar pr-2': isParticipantsExpanded }"
                >
                  <li 
                    v-for="p in (isParticipantsExpanded ? heatmapData : heatmapData.slice(0, 12))" 
                    :key="p.username" 
                    class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100"
                  >
                    <span class="w-2 h-2 rounded-full shrink-0" :class="p.intervals.length > 0 ? 'bg-green-500' : 'bg-gray-300'"></span>
                    <span class="flex-1 min-w-0 truncate cursor-help" :title="p.username">{{ p.username }}</span>
                    <span v-if="p.role === 'Owner'" :title="p.role" class="shrink-0 text-[10px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded border border-gray-300 cursor-help flex items-center justify-center leading-none">★</span>
                    
                    <!-- Izmešanas poga -->
                    <button 
                      v-if="myRole === 'Owner' && p.userId !== myUserId" 
                      @click="kickParticipant(p.userId)" 
                      class="shrink-0 text-xs text-red-500 hover:bg-red-100 px-2 py-0.5 rounded transition"
                      title="Izmest no pasākuma"
                    >
                      X
                    </button>
                  </li>
                </ul>

                <!-- Vairāk / Mazāk pogas -->
                <button 
                  v-if="heatmapData.length > 16 && !isParticipantsExpanded" 
                  @click="isParticipantsExpanded = true" 
                  class="mt-4 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold py-2 rounded-lg transition border border-blue-100"
                >
                  Vairāk ({{ heatmapData.length - 12 }})
                </button>
                <button 
                  v-if="isParticipantsExpanded" 
                  @click="isParticipantsExpanded = false" 
                  class="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 rounded-lg transition"
                >
                  Rādīt mazāk
                </button>
              </div>
            </div>

            <!-- Labā kolonna: Siltumkarte -->
            <div class="lg:col-span-3">
             <TimeSettings :showFormat="true" :showTimezone="true" />
              <HeatmapGrid :heatmapData="heatmapData" :totalParticipants="totalParticipants" />
              <AvailabilityGraph :heatmapData="heatmapData" :totalParticipants="totalParticipants" />
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import TimeSettings from '../components/TimeSettings.vue'
import HeatmapGrid from '../components/HeatmapGrid.vue'
import AvailabilityGraph from '../components/AvailabilityGraph.vue'

const route = useRoute()
const router = useRouter()
const eventId = route.params.id
const authStore = useAuthStore()
const myUserId = authStore.user?.userId

// Pasākuma detaļu stāvokļi
const eventName = ref('')
const eventDescription = ref('')
const isEditingEvent = ref(false)
const editEventName = ref('')
const editEventDescription = ref('')

// Datu stāvokļi
const heatmapData = ref<any[]>([])
const totalParticipants = ref(0)
const myTables = ref<any[]>([])
const selectedTableId = ref<number | null>(null)

// UI stāvokļi
const isLoading = ref(true)
const isSavingTable = ref(false)
const errorMsg = ref('')
const updateMessage = ref('')
const myRole = ref('')
const isParticipantsExpanded = ref(false)

// WebSocket mainīgais
let ws: WebSocket | null = null;

onMounted(async () => {
  // pārbaudam auth pārbaudi pirms lādējam datus
  const isAuthenticated = await authStore.checkAuth()
  if (!isAuthenticated) {
    router.push('/login')
    return
  }
  
  await loadEventData()
  connectWebSocket()
})

onUnmounted(() => {
  // Kad izejam no lapas, laužam savienojumu, lai netērētu servera resursus
  if (ws) {
    ws.close()
  }
})

const connectWebSocket = () => {
  // Automātiski nosakām protokolu (ws:// lokāli, wss:// ja ir HTTPS produkcijā)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Izmantojam window.location.host, lai tas strādātu neatkarīgi no porta (mūsu gadījumā 80)
  const wsUrl = `${protocol}//${window.location.host}/api/events/${eventId}/ws`;
  
  ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'HEATMAP_UPDATED') {
        // Kāds izmainīja savu tabulu vai pievienojās! Ielādējam datus klusajā režīmā.
        loadEventData(true);
      }
    } catch (e) {
      console.error("Kļūda apstrādājot WebSocket ziņu:", e);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket savienojums pārtraukts");
  };
}

// Pievienots isSilent = false parametrs. Ja tas ir true, mēs nerādām "Ielādē datus..." uzrakstu
const loadEventData = async (isSilent = false) => {
  if (!isSilent) isLoading.value = true
  
  try {
    const heatmapRes = await fetch(`/api/events/${eventId}/heatmap`)
    if (!heatmapRes.ok) throw new Error('Neizdevās ielādēt pasākumu')
    const hData = await heatmapRes.json()
    
    heatmapData.value = hData.data
    totalParticipants.value = hData.totalParticipants
    myRole.value = hData.myRole
    eventName.value = hData.eventName
    eventDescription.value = hData.eventDescription

    // Lai lietotājs nezaudētu savu izvēlni, kamēr pats kaut ko maina
    if (!isSilent) {
      selectedTableId.value = hData.myTableId
    }

    if (!isSilent) {
      const tablesRes = await fetch('/api/availability')
      if (tablesRes.ok) {
        const tData = await tablesRes.json()
        myTables.value = tData.tables
      }
    }
  } catch (error) {
    if (!isSilent) errorMsg.value = 'Savienojuma kļūda vai jums nav piekļuves.'
  } finally {
    if (!isSilent) isLoading.value = false
  }
}

const enterEditMode = () => {
  editEventName.value = eventName.value;
  editEventDescription.value = eventDescription.value || '';
  isEditingEvent.value = true;
}

const saveEventDetails = async () => {
  if (!editEventName.value) return; // Nedrīkst būt tukšs
  
  try {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: editEventName.value, 
        description: editEventDescription.value 
      })
    });
    
    if (res.ok) {
      isEditingEvent.value = false;
      await loadEventData(true); // Pārlādē datus klusajā režīmā
    }
  } catch (error) {
    console.error("Neizdevās atjaunināt pasākumu:", error);
  }
}

const kickParticipant = async (targetId: number) => {
  if (!confirm('Izmest šo dalībnieku no pasākuma?')) return;
  try {
    const res = await fetch(`/api/events/${eventId}/participants/${targetId}`, { method: 'DELETE' });
    if (res.ok) {
      // WebSocket automātiski atjaunos ekrānu, bet sirdsmieram varam izsaukt loadEventData(true)
      await loadEventData(true);
    }
  } catch (error) {
    console.error(error);
  }
}

const updateMyTable = async () => {
  isSavingTable.value = true
  updateMessage.value = ''
  try {
    const res = await fetch(`/api/events/${eventId}/my-table`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability_table_id: selectedTableId.value })
    })

    if (res.ok) {
      updateMessage.value = 'Tabula atjaunināta!'
      // Izsaucam backend, tas nosūtīs HEATMAP_UPDATED pa WebSocket,
      // dati paši pārlādēsies. Papildus varam pārlādēt arī manuāli:
      await loadEventData(true) 
      setTimeout(() => { updateMessage.value = '' }, 3000)
    } else {
      updateMessage.value = 'Kļūda saglabājot.'
    }
  } catch (e) {
    updateMessage.value = 'Savienojuma kļūda.'
  } finally {
    isSavingTable.value = false
  }
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>