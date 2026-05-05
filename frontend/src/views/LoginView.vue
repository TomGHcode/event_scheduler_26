<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
      <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Pieslēgties</h2>
      
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Lietotājvārds</label>
          <input 
            v-model="username" 
            type="text" 
            required
            maxlength="32"
            class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Parole</label>
          <input 
            v-model="password" 
            type="password" 
            required 
            maxlength="128"
            class="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div v-if="authStore.error" class="text-red-500 text-sm text-center">
          {{ authStore.error }}
        </div>

        <button 
          type="submit" 
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
        >
          Ienākt
        </button>
      </form>
      <!-- Reģistrācijas links -->
      <div class="mt-4 text-center text-sm text-gray-600">
        Nav konta? 
        <router-link to="/register" class="text-blue-600 hover:underline font-semibold">Reģistrējies šeit</router-link>
      </div>

      <!-- DISCORD POGA -->
      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-gray-500">Vai</span>
          </div>
        </div>

        <div class="mt-6">
          <a 
            href="/api/auth/discord/login" 
            class="w-full flex justify-center items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            <!-- SVG Discord Logo -->
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 127.14 96.36">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            Pieslēgties ar Discord
          </a>
        </div>
      </div>
      <!-- BEIDZAS DISCORD POGA -->

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const username = ref('')
const password = ref('')
const authStore = useAuthStore()
const router = useRouter()

const handleLogin = async () => {
  const success = await authStore.login(username.value, password.value)
  if (success) {
    // Ja veiksmīgi, pārvirzām uz sākumlapu vai paneļa skatu
    router.push('/')
  }
}
</script>