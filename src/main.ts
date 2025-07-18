import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useCharacterStore } from '@/stores/characterStore'
import { applyUrlParams } from '@/utils/urlSync'
import App from './App.vue'

const pinia = createPinia()
const store = useCharacterStore(pinia)
applyUrlParams(store, window.location.search)

const app = createApp(App)
app.use(pinia)
app.mount('#app')
