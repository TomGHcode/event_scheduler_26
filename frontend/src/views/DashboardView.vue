<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-5xl mx-auto">
      <!-- Galvene -->
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Informācijas panelis</h1>
        <div class="flex items-center gap-4">
          <span class="text-gray-600 font-medium">Sveiki, {{ authStore.user?.username }}!</span>
          <button @click="logout" class="text-gray-500 hover:text-red-600 font-medium transition">Iziet</button>
        </div>
      </div>

      <!-- Kļūdu un paziņojumu lauki -->
      <div v-if="actionMessage" class="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700">
        {{ actionMessage }}
      </div>
      <div v-if="actionError" class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
        {{ actionError }}
      </div>

      <!-- Darbību paneļi (Izveidot / Pievienoties Pasākumam) -->
      <div v-if="showCreateEvent" class="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 mb-8">
        <h3 class="font-bold text-lg mb-4 text-blue-800">Izveidot Jaunu Pasākumu</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input v-model="newEventName" type="text" maxlength="64" placeholder="Pasākuma nosaukums" class="px-4 py-2 border rounded-lg focus:ring-blue-500" />
          <input v-model="newEventDesc" type="text" maxlength="1500" placeholder="Apraksts (neobligāts)" class="px-4 py-2 border rounded-lg focus:ring-blue-500" />
        </div>
        <div class="flex gap-2">
          <button @click="createEvent" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700">Izveidot</button>
          <button @click="showCreateEvent = false" class="text-gray-500 px-4 py-2">Atcelt</button>
        </div>
      </div>

      <div v-if="showJoinEvent" class="bg-white p-6 rounded-2xl shadow-sm border border-green-200 mb-8">
        <h3 class="font-bold text-lg mb-4 text-green-800">Pievienoties Pasākumam</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input v-model="inviteKey" type="text" placeholder="Ielūguma atslēga (Invite Key)" class="px-4 py-2 border rounded-lg focus:ring-green-500" />
          
          <select v-model="selectedTableId" class="px-4 py-2 border rounded-lg focus:ring-green-500">
            <option :value="null">Nepiesaistīt tabulu (Tikai skatīties)</option>
            <option v-for="table in tables" :key="table.id" :value="table.id">{{ table.name }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <input v-model="joinAsPrivate" type="checkbox" id="privateCheck" class="w-4 h-4 text-green-600" />
          <label for="privateCheck" class="text-sm text-gray-700">Pievienoties anonīmi (citi neredzēs manu vārdu)</label>
        </div>
        <div class="flex gap-2">
          <button @click="joinEvent" class="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700">Pievienoties</button>
          <button @click="showJoinEvent = false" class="text-gray-500 px-4 py-2">Atcelt</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Kreisā Puse: Pieejamības Tabulas -->
        <!-- Pievienojam min-w-0 galvenajam baltajam blokam -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
          <div class="flex justify-between items-center mb-6 gap-4">
            <h2 class="text-xl font-bold text-gray-700 truncate">Manas Tabulas</h2>
            <button @click="$router.push('/create-table')" class="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm">
              + Jauna Tabula
            </button>
          </div>
          
          <div v-if="tables.length === 0" class="text-gray-500 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            Tev vēl nav nevienas pieejamības tabulas.
          </div>
          
          <div v-else class="flex flex-col gap-3">
            <!-- Pievienots min-w-0 iekšējam karšu elementam -->
            <div v-for="table in tables" :key="table.id" class="p-4 border border-gray-200 rounded-xl flex justify-between items-center bg-gray-50 gap-4 min-w-0">
              
              <!-- flex-1 un min-w-0 ļauj tekstam lūzt, neizbīdot malas -->
              <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-800 break-words">{{ table.name }}</div>
              </div>
              
              <!-- shrink-0 neļauj pogai saspiesties -->
              <router-link :to="`/edit-table/${table.id}`" class="shrink-0 text-blue-600 text-sm font-semibold hover:underline">
                Rediģēt
              </router-link>
            </div>
          </div>
        </div>

        <!-- Labā Puse: Mani Pasākumi -->
        <!-- Pievienojam min-w-0 galvenajam baltajam blokam -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
          <div class="flex justify-between items-center mb-6 gap-4">
            <h2 class="text-xl font-bold text-gray-700 truncate">Mani Pasākumi</h2>
            <div class="flex gap-2 shrink-0">
              <button @click="toggleJoin" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold transition">
                Pievienoties
              </button>
              <button @click="toggleCreate" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition">
                + Jauns
              </button>
            </div>
          </div>
          
          <div v-if="events.length === 0" class="text-gray-500 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            Tu vēl nepiedalies nevienā pasākumā.
          </div>
          
          <div v-else class="flex flex-col gap-3">
            <div v-for="event in events" :key="event.id" class="p-4 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-gray-50 gap-4 min-w-0">
              
              <!-- Kreisā puse: Teksts un Atslēga -->
              <!-- Pievienots flex-1 min-w-0 w-full drošībai -->
              <div class="flex-1 min-w-0 w-full text-left">
                <div class="font-bold text-gray-800 break-words">{{ event.name }}</div>
                <div class="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                  <span class="bg-gray-200 px-2 py-0.5 rounded shrink-0">{{ event.role_type }}</span>
                  
                  <!-- Paslēpta / Atklāta Atslēga -->
                  <span v-if="event.role_type === 'Owner'" class="text-blue-600 flex flex-wrap items-center gap-2">
                    <span class="shrink-0">Atslēga:</span> 
                    <span v-if="!revealedKeys.has(event.id)">
                      <button @click="revealedKeys.add(event.id)" class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded transition font-medium">Atklāt</button>
                    </span>
                    <span v-else class="flex items-center gap-2 flex-wrap min-w-0">
                      <!-- break-all drošībai, ja atslēga nejauši kļūst pārāk gara -->
                      <span class="font-mono bg-blue-50 px-1 rounded break-all">{{ event.invite_key }}</span>
                      <button @click="regenerateKey(event.id)" class="shrink-0 bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded transition" title="Ģenerēt jaunu atslēgu">↻</button>
                      <button @click="revealedKeys.delete(event.id)" class="shrink-0 text-gray-400 hover:text-gray-600 px-1">✕</button>
                    </span>
                  </span>
                </div>
              </div>
              
              <!-- Labā puse: Pogas -->
              <div class="flex flex-col gap-2 shrink-0 mt-2 sm:mt-0">
                <router-link :to="`/event/${event.id}`" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition">
                  Siltumkarte
                </router-link>
                <!-- Dzēst vai Pamest -->
                <button v-if="event.role_type === 'Owner'" @click="deleteEvent(event.id)" class="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-semibold border border-red-200 transition">Dzēst</button>
                <button v-else @click="leaveEvent(event.id)" class="text-orange-500 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-sm font-semibold border border-orange-200 transition">Pamest</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

// Datu stāvokļi
const tables = ref<any[]>([])
const events = ref<any[]>([])

// UI stāvokļi
const revealedKeys = ref(new Set<number>());
const showCreateEvent = ref(false)
const showJoinEvent = ref(false)
const actionMessage = ref('')
const actionError = ref('')

// Formu modeļi
const newEventName = ref('')
const newEventDesc = ref('')
const inviteKey = ref('')
const selectedTableId = ref<number | null>(null)
const joinAsPrivate = ref(false)

onMounted(async () => {
  const isAuthenticated = await authStore.checkAuth()
  if (!isAuthenticated) {
    router.push('/login')
    return
  }
  await fetchData()
})

const fetchData = async () => {
  try {
    const [tablesRes, eventsRes] = await Promise.all([
      fetch('/api/availability'),
      fetch('/api/events')
    ])
    
    if (tablesRes.ok) tables.value = (await tablesRes.json()).tables
    if (eventsRes.ok) events.value = (await eventsRes.json()).events
  } catch (error) {
    console.error('Datu ielādes kļūda')
  }
}

const toggleCreate = () => { showCreateEvent.value = true; showJoinEvent.value = false; clearMsgs() }
const toggleJoin = () => { showJoinEvent.value = true; showCreateEvent.value = false; clearMsgs() }
const clearMsgs = () => { actionMessage.value = ''; actionError.value = '' }

const createEvent = async () => {
  clearMsgs()
  if (!newEventName.value) { actionError.value = 'Nosaukums ir obligāts'; return }
  
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newEventName.value, description: newEventDesc.value })
    })
    
    const data = await res.json()
    if (res.ok) {
      actionMessage.value = `Pasākums izveidots! Ielūguma atslēga (Invite Key) citiem dalībniekiem: ${data.inviteKey}`
      showCreateEvent.value = false
      newEventName.value = ''; newEventDesc.value = ''
      await fetchData()
    } else {
      actionError.value = data.error || 'Neizdevās izveidot pasākumu'
    }
  } catch (e) {
    actionError.value = 'Servera kļūda'
  }
}

const joinEvent = async () => {
  clearMsgs()
  if (!inviteKey.value) { actionError.value = 'Ielūguma atslēga ir obligāta'; return }

  try {
    const res = await fetch('/api/events/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        invite_key: inviteKey.value, 
        availability_table_id: selectedTableId.value,
        is_private: joinAsPrivate.value
      })
    })
    
    const data = await res.json()
    if (res.ok) {
      actionMessage.value = 'Veiksmīgi pievienojāties pasākumam!'
      showJoinEvent.value = false
      inviteKey.value = ''; selectedTableId.value = null; joinAsPrivate.value = false
      await fetchData()
    } else {
      actionError.value = data.error || 'Neizdevās pievienoties'
    }
  } catch (e) {
    actionError.value = 'Servera kļūda'
  }
}

const regenerateKey = async (eventId: number) => {
  if (!confirm('Vai tiešām vēlaties ģenerēt jaunu ielūguma atslēgu? Vecā atslēga vairs nedarbosies!')) return;
  
  try {
    const res = await fetch(`/api/events/${eventId}/invite-key`, {
      method: 'PATCH'
    });
    
    if (res.ok) {
      actionMessage.value = 'Ielūguma atslēga ir veiksmīgi nomainīta!';
      await fetchData(); // Pārlādējam datus, lai parādītu jauno atslēgu
      setTimeout(() => { actionMessage.value = '' }, 4000);
    } else {
      const data = await res.json();
      actionError.value = data.error || 'Neizdevās nomainīt atslēgu';
    }
  } catch (e) {
    actionError.value = 'Savienojuma kļūda';
  }
}

const deleteEvent = async (id: number) => {
  if (!confirm('Vai tiešām vēlaties dzēst šo pasākumu visiem dalībniekiem?')) return;
  try {
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  } catch (e) { console.error(e); }
}

const leaveEvent = async (id: number) => {
  if (!confirm('Vai tiešām vēlaties pamest šo pasākumu?')) return;
  try {
    // Lietotājs izmet pats sevi (padodam viņa ID)
    const res = await fetch(`/api/events/${id}/participants/${authStore.user?.userId}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  } catch (e) { console.error(e); }
}


const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>