import RegisterView from './views/RegisterView.vue'
import EventView from './views/EventView.vue'
import EditTableView from './views/EditTableView.vue'
import CreateTableView from './views/CreateTableView.vue'
import DashboardView from './views/DashboardView.vue'
import AdminView from './views/AdminView.vue'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Importējam jauno skatu
import LoginView from './views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
	{ path: '/register', component: RegisterView },
	{ path: '/admin', component: AdminView },
    { path: '/', component: DashboardView },
	{ path: '/create-table', component: CreateTableView },
	{ path: '/edit-table/:id', component: EditTableView },
	{ path: '/event/:id', component: EventView }
  ]
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')