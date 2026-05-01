import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ userId: number; username?: string; role: string } | null>(null)
  const error = ref<string | null>(null)

  const login = async (username: string, password: string) => {
    error.value = null
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        error.value = data.error || 'Pieslēgšanās neizdevās'
        return false
      }
      // Saglabājam lietotāju no atbildes
      user.value = { userId: data.user.id, username: data.user.username, role: data.user.role }
      return true
    } catch (err) {
      error.value = 'Neizdevās savienoties ar serveri'
      return false
    }
  }

  // Funkcija sesijas pārbaudei pārlādējot lapu
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        user.value = data.currentUser
        return true
      }
      user.value = null
      return false
    } catch (e) {
      user.value = null
      return false
    }
  }

  return { user, error, login, checkAuth }
})