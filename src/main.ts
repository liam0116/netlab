import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useMaintenanceStore } from './stores/maintenance'
import './style.css'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router).use(i18n)
// Before any page saves the project: v1.3.0 kept work orders inside it, and this moves them to their own storage.
useMaintenanceStore(pinia)
app.mount('#app')

// Projects live only in browser storage: ask the browser not to evict it when space runs low.
void navigator.storage?.persist?.().catch(() => undefined)
