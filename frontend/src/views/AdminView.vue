<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-6xl mx-auto">
      
      <!-- Galvene -->
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-bold text-gray-800">Sistēmas Administrēšana</h1>
          <span class="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase">Admin</span>
        </div>
        <button @click="$router.push('/')" class="text-gray-500 hover:text-gray-800 font-medium transition">Atpakaļ uz paneli</button>
      </div>

      <div v-if="errorMsg" class="mb-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
        {{ errorMsg }}
      </div>

      <!-- Lietotāju tabula -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-700 border-b border-gray-200 text-sm">
                <th class="p-4 font-bold">ID</th>
                <th class="p-4 font-bold">Lietotājvārds</th>
                <th class="p-4 font-bold">Discord ID</th>
                <th class="p-4 font-bold">Laika zona</th>
                <th class="p-4 font-bold text-center">Loma</th>
                <th class="p-4 font-bold text-right">Darbības</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading" class="border-b border-gray-100"><td colspan="6" class="p-4 text-center text-gray-500">Ielādē datus...</td></tr>
              
              <tr v-else v-for="user in users" :key="user.id" class="border-b border-gray-100 hover:bg-gray-50 transition">
                <td class="p-4 text-gray-500 text-sm">{{ user.id }}</td>
                <td class="p-4 font-bold text-gray-800">
                  {{ user.username }}
                  <span v-if="user.id === authStore.user?.userId" class="ml-2 text-xs text-blue-500 font-normal">(Tu)</span>
                </td>
                <td class="p-4 text-gray-500 text-sm">{{ user.discord_id || 'Nav piesaistīts' }}</td>
                <td class="p-4 text-gray-500 text-sm">{{ user.timezone }}</td>
                
                <td class="p-4 text-center">
                  <span 
                    class="px-2 py-1 rounded text-xs font-bold uppercase"
                    :class="user.role === 'Administrator' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'"
                  >
                    {{ user.role }}
                  </span>
                </td>

                <td class="p-4 text-right">
                  <div class="flex justify-end gap-2" v-if="user.id !== authStore.user?.userId">
                    <button 
                      @click="toggleRole(user)"
                      class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded transition font-medium border border-indigo-100"
                    >
                      {{ user.role === 'Administrator' ? 'Padarīt par User' : 'Padarīt par Admin' }}
                    </button>
                    <button 
                      @click="deleteUser(user.id, user.username)"
                      class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded transition font-medium border border-red-100"
                    >
                      Dzēst kontu
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
const users = ref<any[]>([])
const isLoading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  const isAuth = await authStore.checkAuth();
  if (!isAuth || authStore.user?.role !== 'Administrator') {
    router.push('/'); // Izmetam laukā, ja nav admin
    return;
  }
  await fetchUsers();
})

const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      users.value = data.users;
    } else {
      errorMsg.value = 'Neizdevās ielādēt lietotājus.';
    }
  } catch (error) {
    errorMsg.value = 'Savienojuma kļūda.';
  } finally {
    isLoading.value = false;
  }
}

const toggleRole = async (user: any) => {
  const newRole = user.role === 'Administrator' ? 'User' : 'Administrator';
  if (!confirm(`Vai tiešām vēlaties mainīt lietotāja ${user.username} lomu uz ${newRole}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    if (res.ok) await fetchUsers();
    else errorMsg.value = 'Neizdevās nomainīt lomu.';
  } catch (e) {
    errorMsg.value = 'Savienojuma kļūda.';
  }
}

const deleteUser = async (id: number, username: string) => {
  const answer = prompt(`UZMANĪBU! \nLietotājs un visi viņa dati (tabulas, pasākumi) tiks DZĒSTI! \n\nLai apstiprinātu, ierakstiet lietotājvārdu: ${username}`);
  if (answer !== username) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchUsers();
    else errorMsg.value = 'Neizdevās izdzēst lietotāju.';
  } catch (e) {
    errorMsg.value = 'Savienojuma kļūda.';
  }
}
</script>