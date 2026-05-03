<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
      <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Reģistrēties</h2>
      
      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Lietotājvārds</label>
          <input 
            v-model="username" 
            type="text" 
            required 
            minlength="3"
            class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Parole</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            minlength="6"
            class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div v-if="authStore.error" class="text-red-500 text-sm text-center">
          {{ authStore.error }}
        </div>

        <button 
          type="submit" 
          :disabled="isSubmitting"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {{ isSubmitting ? 'Reģistrējas...' : 'Izveidot kontu' }}
        </button>
      </form>

      <div class="mt-4 text-center text-sm text-gray-600">
        Jau ir konts? 
        <router-link to="/login" class="text-blue-600 hover:underline font-semibold">Pieslēgties šeit</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const username = ref('')
const password = ref('')
const isSubmitting = ref(false)
const authStore = useAuthStore()
const router = useRouter()

const handleRegister = async () => {
  isSubmitting.value = true
  const success = await authStore.register(username.value, password.value)
  isSubmitting.value = false
  if (success) {
    router.push('/')
  }
}
</script>