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
          
          <!-- Pasākuma Apraksts -->
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
              <div class="bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
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
              <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
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
                    <span v-if="p.role === 'Owner'" title="Īpašnieks" class="shrink-0 text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded border border-gray-300 flex items-center justify-center leading-none">★</span>
                    <span v-if="p.role === 'Helper'" title="Palīgs" class="shrink-0 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 flex items-center justify-center leading-none">H</span>
                    
                    <div class="flex items-center gap-2 ml-auto">
                      <!-- Lomas maiņa (Tikai Owner) -->
                      <button 
                        v-if="myRole === 'Owner' && p.userId !== myUserId" 
                        @click="toggleRole(p.userId, p.role)" 
                        :title="p.role === 'Helper' ? 'Noņemt Palīga lomu' : 'Sniegt Palīga lomu'"
                        class="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded transition font-bold"
                      >
                        {{ p.role === 'Helper' ? '↓' : '↑' }}
                      </button>

                      <!-- Izmešanas poga (Owner var izmest visus, Helper var izmest tikai User) -->
                      <button 
                        v-if="p.userId !== myUserId && (myRole === 'Owner' || (myRole === 'Helper' && p.role === 'User'))" 
                        @click="kickParticipant(p.userId)" 
                        class="shrink-0 text-xs text-red-500 hover:bg-red-50 border border-red-100 px-2 py-0.5 rounded transition"
                        title="Izmest no pasākuma"
                      >
                        X
                      </button>
                    </div>
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

              <!-- Plānotie Pasākumi -->
              <div class="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex flex-col mt-6">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="font-bold text-lg text-purple-800">Plānotie Pasākumi</h3>
                  <button 
                    v-if="myRole === 'Owner' || myRole === 'Helper'" 
                    @click="showAddEventForm = !showAddEventForm"
                    class="text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-1 rounded transition"
                  >
                    {{ showAddEventForm ? 'Atcelt' : '+ Pievienot' }}
                  </button>
                </div>

                <!-- Forma jauna pasākuma pievienošanai -->
                <div v-if="showAddEventForm" class="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100 flex flex-col gap-3">
                  <input v-model="newPlannedEvent.title" type="text" maxlength="50" placeholder="Pasākuma nosaukums" class="w-full text-sm px-3 py-2 border border-purple-200 rounded bg-white" />
                  
                  <div class="flex flex-col sm:flex-row lg:flex-col gap-2">
                    <div class="flex-1">
                      <label class="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Sākums</label>
                      <input v-model="newPlannedEvent.start" type="datetime-local" class="w-full text-xs px-2 py-1.5 border border-purple-200 rounded bg-white" />
                    </div>
                    <div class="flex-1">
                      <label class="text-[10px] text-gray-500 font-bold uppercase mb-1 block">Beigas</label>
                      <input v-model="newPlannedEvent.end" type="datetime-local" class="w-full text-xs px-2 py-1.5 border border-purple-200 rounded bg-white" />
                    </div>
                  </div>
                  
                  <div class="flex flex-col gap-1">
                    <textarea v-model="newPlannedEvent.description" maxlength="370" placeholder="Apraksts (nav obligāts)" rows="2" class="w-full text-sm px-3 py-2 border border-purple-200 rounded bg-white"></textarea>
                    <div class="text-right text-[10px] text-purple-400 font-medium">{{ newPlannedEvent.description.length }}/370</div>
                  </div>
                  
                  <button @click="addPlannedEvent" class="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold py-2 rounded mt-1 transition">Saglabāt pasākumu</button>
                </div>

                <!-- Pasākumu saraksts -->
                <div v-if="plannedEvents.length === 0 && !showAddEventForm" class="text-sm text-gray-500 text-center py-4">Nav ieplānots neviens pasākums.</div>
                
                <ul class="flex flex-col gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  <li v-for="pe in plannedEvents" :key="pe.id" class="bg-gray-50 border border-gray-200 rounded-lg p-3 relative group transition hover:border-purple-300">
                    <div class="font-bold text-gray-800 text-sm pr-6 text-left">{{ pe.metadata?.title || 'Bez nosaukuma' }}</div>
                    
                    <!-- Taimeris -->
                    <div class="text-xs text-purple-600 font-semibold mb-2 text-left">{{ getCountdown(pe.start_time, pe.end_time) }}</div>
                    
                    <!-- Datuma un laika vizualizācija -->
                    <div class="text-[11px] text-gray-600 flex flex-col gap-0.5">
                      <div class="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100">
                        <span class="font-semibold text-gray-500">Sākums:</span> 
                        <span>{{ formatDateText(pe.start_time) }} <span class="font-bold ml-1 text-gray-700">{{ formatTimeText(pe.start_time) }}</span></span>
                      </div>
                      <div class="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100">
                        <span class="font-semibold text-gray-500">Beigas:</span> 
                        <span>{{ formatDateText(pe.end_time) }} <span class="font-bold ml-1 text-gray-700">{{ formatTimeText(pe.end_time) }}</span></span>
                      </div>
                    </div>
                    
                    <!-- Apraksts -->
                    <div v-if="pe.metadata?.description" class="text-[11px] text-gray-500 mt-2 italic border-t border-gray-200 pt-2 break-words">
                      {{ pe.metadata.description }}
                    </div>
                    
                    <button 
                      v-if="myRole === 'Owner' || myRole === 'Helper'" 
                      @click="deletePlannedEvent(pe.id)"
                      class="absolute top-2 right-2 text-red-400 hover:text-red-600 hidden group-hover:flex items-center justify-center w-6 h-6 bg-white border border-gray-200 rounded shadow-sm transition"
                      title="Dzēst pasākumu"
                    >
                      ✕
                    </button>
                  </li>
                </ul>
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
import { fromZonedTime } from 'date-fns-tz';

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
const plannedEvents = ref<any[]>([])
const showAddEventForm = ref(false)
const newPlannedEvent = ref({ title: '', description: '', start: '', end: '' })

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
        // Kāds izmainīja savu tabulu vai pievienojās, Ielādējam datus klusajā režīmā.
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
      const plannedRes = await fetch(`/api/events/${eventId}/planned-events`)
      if (plannedRes.ok) {
        const pData = await plannedRes.json()
        plannedEvents.value = pData.plannedEvents
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
      // WebSocket automātiski atjaunos ekrānu, bets papildus, drošības pēc, varam izsaukt loadEventData(true)
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
      // dati paši pārlādēsies. Papildus, drošības pēc, varam pārlādēt arī manuāli:
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

// Taimeris
const getCountdown = (startString: string, endString: string) => {
  const now = new Date().getTime();
  const start = new Date(startString).getTime();
  const end = new Date(endString).getTime();

  // Ja pasākums jau ir pilnībā noslēdzies
  if (now > end) return '🔴 Beidzies';

  let diff;
  let prefix = '';
  let suffix = '';

  // Ja pasākums notiek tieši tagad
  if (now >= start && now <= end) {
    diff = end - now;
    prefix = '🟢 Notiek pašlaik (beigsies pēc ';
    suffix = ')';
  } else {
    // Ja pasākums vēl tikai būs
    diff = start - now;
    prefix = 'Pēc ';
  }

  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / 1000 / 60) % 60);

  // Rādām tikai to, kas nav nulle
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`); // Minūtes

  return `${prefix}${parts.join(' ')}${suffix}`;
}

// -- Palīgfunkcija: Pārbīda datumu uz lietotāja izvēlēto laika zonu --
const getShiftedDate = (dateString: string) => {
  const d = new Date(dateString);
  const tz = authStore.user?.timezone || 'UTC';
  // Ar trika palīdzību izveido jaunu Date objektu, kura "lokālie" laiki 
  // (getHours, getDate u.c.) atbildīs tieši izvēlētajai laika zonai.
  return new Date(d.toLocaleString('en-US', { timeZone: tz }));
}

// -- Datuma formāts, ņemot vērā lietotāja laika zonu --
const formatDateText = (dateString: string) => {
  const d = getShiftedDate(dateString); // Izmantojam pārbīdīto datumu
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jūn', 'jūl', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
}

// -- Laika formāts, ņemot vērā lietotāja laika zonu un 12h/24h --
const formatTimeText = (dateString: string) => {
  const d = getShiftedDate(dateString); // Izmantojam pārbīdīto datumu
  const hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const format = authStore.user?.settings?.timeFormat || '24h';
  
  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${mins}`;
  } else {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${mins} ${ampm}`;
  }
}

// Lomas maiņa (Tikai Owner)
const toggleRole = async (targetId: number, currentRole: string) => {
  const newRole = currentRole === 'Helper' ? 'User' : 'Helper';
  if (!confirm(`Vai mainīt šī lietotāja lomu uz ${newRole}?`)) return;
  
  try {
    const res = await fetch(`/api/events/${eventId}/participants/${targetId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_role: newRole })
    });
    if (res.ok) await loadEventData(true);
  } catch (error) {
    console.error(error);
  }
}

// Plānotā pasākuma pievienošana (Owner un Helper)
const addPlannedEvent = async () => {
  if (!newPlannedEvent.value.title || !newPlannedEvent.value.start || !newPlannedEvent.value.end) {
    alert("Lūdzu aizpildi visus obligātos laukus!");
    return;
  }

  try {
    // 1. Iegūstam aktīvo laika zonu (piem., 'America/New_York')
    const tz = authStore.user?.timezone || 'UTC';
    
    // 2. Interpretējam ievadīto tekstu šajā laika zonā un pārvēršam uz UTC
    // fromZonedTime paņem "2026-05-04T12:00" un saprot: "Ā, šis ir Ņujorkas laiks, tātad UTC tas būs 16:00!"
    const startUtcDate = fromZonedTime(newPlannedEvent.value.start, tz);
    const endUtcDate = fromZonedTime(newPlannedEvent.value.end, tz);

    const res = await fetch(`/api/events/${eventId}/planned-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newPlannedEvent.value.title,
        description: newPlannedEvent.value.description,
        start_time: startUtcDate.toISOString(), 
        end_time: endUtcDate.toISOString()
      })
    });

    if (res.ok) {
      showAddEventForm.value = false;
      newPlannedEvent.value = { title: '', description: '', start: '', end: '' };
      await loadEventData(true);
    } else {
      const err = await res.json();
      alert(err.error || "Kļūda saglabājot");
    }
  } catch (e) {
    console.error(e);
  }
}
const deletePlannedEvent = async (plannedId: number) => {
  if (!confirm("Tiešām dzēst šo pasākumu?")) return;
  try {
    const res = await fetch(`/api/events/${eventId}/planned-events/${plannedId}`, { method: 'DELETE' });
    if (res.ok) await loadEventData(true);
  } catch (e) { console.error(e); }
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