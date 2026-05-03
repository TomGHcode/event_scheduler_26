import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserSettings {
  timeFormat: '12h' | '24h';
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ 
    userId: number; 
    username?: string; 
    role: string; 
    timezone: string; 
    settings: UserSettings 
  } | null>(null)
  
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
      
      // izsaucam checkAuth(), kas automātiski iegūst pilno profilu (ar timezone un formātu)
      return await checkAuth()

    } catch (err) {
      error.value = 'Neizdevās savienoties ar serveri'
      return false
    }
  }
  
  const register = async (username: string, password: string) => {
    error.value = null
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        // Izvelkam Zod validācijas kļūdas, ja tādas ir
        if (data.details && data.details.username) {
          error.value = data.details.username._errors[0]
        } else if (data.details && data.details.password) {
          error.value = data.details.password._errors[0]
        } else {
          error.value = data.error || 'Reģistrācija neizdevās'
        }
        return false
      }
      // Pēc veiksmīgas reģistrācijas varam uzreiz ielogoties
      return await login(username, password)
    } catch (err) {
      error.value = 'Neizdevās savienoties ar serveri'
      return false
    }
  }

  // Funkcija sesijas pārbaudei pārlādējot
  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        // Iestatām noklusējuma vērtības, ja lietotājam to vēl nav
        const settings = data.currentUser.settings || { timeFormat: '24h' };
        const timezone = data.currentUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        user.value = { ...data.currentUser, settings, timezone }
        return true
      }
      user.value = null
      return false
    } catch (e) {
      user.value = null
      return false
    }
  }

  // Saglabā iestatījumus backendā
  const updateSettings = async (timezone: string, timeFormat: '12h' | '24h') => {
    if (!user.value) return false;
    try {
      const response = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, timeFormat }),
      })
      if (response.ok) {
        user.value.timezone = timezone;
        user.value.settings.timeFormat = timeFormat;
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return { user, error, login, register, checkAuth, updateSettings }
})