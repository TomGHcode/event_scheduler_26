<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">Rediģēt Tabulu</h1>
        <button @click="$router.push('/')" class="text-gray-500 hover:text-gray-800">Atpakaļ</button>
      </div>

      <div v-if="isLoading" class="text-center py-10 text-gray-500">Ielādē datus...</div>

      <div v-else class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Tabulas nosaukums</label>
          <input 
            v-model="tableName" 
            type="text"
            maxlength="64" 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <AvailabilityGrid ref="gridRef" />

        <div v-if="errorMsg" class="mt-4 text-red-500 text-sm">{{ errorMsg }}</div>

        <div class="mt-8 flex justify-between items-center pt-4 border-t border-gray-100">
          <!-- Dzēšanas poga -->
          <button 
            @click="deleteTable" 
            class="text-red-600 hover:bg-red-50 font-bold py-2 px-4 rounded-lg transition"
          >
            Dzēst tabulu
          </button>
          
          <!-- Saglabāšanas poga -->
          <button 
            @click="updateTable" 
            :disabled="isSaving"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            {{ isSaving ? 'Saglabā...' : 'Saglabāt izmaiņas' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AvailabilityGrid from '../components/AvailabilityGrid.vue'

const router = useRouter()
const route = useRoute()
const tableId = route.params.id

const tableName = ref('')
const gridRef = ref<InstanceType<typeof AvailabilityGrid> | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  try {
    const response = await fetch(`/api/availability/${tableId}`)
    if (response.ok) {
      const data = await response.json()
      tableName.value = data.table.name
      // Pēc nelielas aiztures, lai komponente paspēj ielādēties, ieliekam intervālus
      setTimeout(() => {
        gridRef.value?.loadIntervals(data.intervals)
      }, 50)
    } else {
      errorMsg.value = 'Neizdevās ielādēt tabulu.'
    }
  } catch (error) {
    errorMsg.value = 'Savienojuma kļūda.'
  } finally {
    isLoading.value = false
  }
})

const updateTable = async () => {
  if (!tableName.value) {
    errorMsg.value = 'Lūdzu ievadiet tabulas nosaukumu!'
    return
  }
  isSaving.value = true
  const intervals = gridRef.value?.compileIntervals() || []

  try {
    const response = await fetch(`/api/availability/${tableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tableName.value, is_active: true, intervals })
    })

    if (response.ok) router.push('/')
    else errorMsg.value = 'Neizdevās atjaunināt tabulu.'
  } catch (error) {
    errorMsg.value = 'Savienojuma kļūda.'
  } finally {
    isSaving.value = false
  }
}

const deleteTable = async () => {
  if (!confirm('Vai tiešām vēlaties dzēst šo tabulu? Šo darbību nevar atsaukt!')) return

  try {
    const response = await fetch(`/api/availability/${tableId}`, { method: 'DELETE' })
    if (response.ok) router.push('/')
    else errorMsg.value = 'Neizdevās izdzēst tabulu.'
  } catch (error) {
    errorMsg.value = 'Savienojuma kļūda.'
  }
}
</script>