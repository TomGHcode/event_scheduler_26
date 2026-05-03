<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800">Izveidot Pieejamības Tabulu</h1>
        <button @click="$router.push('/')" class="text-gray-500 hover:text-gray-800">Atpakaļ</button>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Tabulas nosaukums</label>
          <input 
            v-model="tableName" 
            type="text"
            maxlength="64" 
            placeholder="Piem., Mana studiju nedēļa" 
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div class="mb-4 flex justify-end">
          <!-- Rādām tikai formātu -->
          <TimeSettings :showFormat="true" :showTimezone="false" />
        </div>

        <!-- Pieejamības režģis -->
        <AvailabilityGrid ref="gridRef" />

        <div v-if="errorMsg" class="mt-4 text-red-500 text-sm">
          {{ errorMsg }}
        </div>

        <div class="mt-6 flex justify-end">
          <button 
            @click="saveTable" 
            :disabled="isSaving"
            class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            {{ isSaving ? 'Saglabā...' : 'Saglabāt šablonu' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TimeSettings from '../components/TimeSettings.vue'
import AvailabilityGrid from '../components/AvailabilityGrid.vue'

const router = useRouter()
const tableName = ref('')
const gridRef = ref<InstanceType<typeof AvailabilityGrid> | null>(null)
const isSaving = ref(false)
const errorMsg = ref('')

const saveTable = async () => {
  if (!tableName.value) {
    errorMsg.value = 'Lūdzu ievadiet tabulas nosaukumu!'
    return
  }

  isSaving.value = true
  errorMsg.value = ''

  // Izsaucam funkciju no bērna komponentes, kas apvieno intervālus
  const intervals = gridRef.value?.compileIntervals() || []

  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tableName.value,
        is_active: true,
        intervals: intervals
      })
    })

    if (response.ok) {
      router.push('/') // Atgriežamies uz Dashboard
    } else {
      const data = await response.json()
      errorMsg.value = data.error || 'Neizdevās saglabāt tabulu.'
    }
  } catch (error) {
    errorMsg.value = 'Savienojuma kļūda ar serveri.'
  } finally {
    isSaving.value = false
  }
}
</script>