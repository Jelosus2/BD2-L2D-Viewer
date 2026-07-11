<template>
  <div class="w-full lg:w-80 h-full bg-gray-800 text-white flex flex-col min-h-0">
    <div class="flex items-center gap-2 mb-2">
      <input
        v-model="filter"
        type="text"
        placeholder="Search..."
        class="bg-gray-700 text-white p-2 outline-none flex-1 min-w-0"
      />
      <button
        type="button"
        class="relative w-10 h-10 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 transition-colors"
        :class="hasActiveFilters ? 'text-indigo-300' : 'text-white'"
        aria-label="Filter characters"
        @click="filterModalOpen = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 5h18" />
          <path d="M6 12h12" />
          <path d="M10 19h4" />
        </svg>
        <span
          v-if="hasActiveFilters"
          class="absolute right-1.5 top-1.5 w-2 h-2 rounded-full bg-indigo-300"
        />
      </button>
    </div>
    <div class="overflow-y-auto flex-1 px-2 sidebar-scroll">
      <div
        v-for="char in filteredCharacters"
        :key="char.id"
        class="flex items-center py-2 cursor-pointer"
        :class="{ 'bg-gray-700': char.id === store.selectedCharacterId }"
        @click="select(char.id)"
      >
        <img
          :src="icons[char.icon] || icons['unknown']"
          :alt="char.costumeName"
          class="w-16 h-16 object-cover rounded-[50%]"
        />
        <div class="flex-grow pl-2">
          <span class="text-lg">{{ char.charName + ': ' + char.costumeName }}</span>
        </div>
        <div class="flex flex-shrink-0 gap-1 pl-2 pr-2">
          <div
            v-if="char.dating"
            class="w-auto h-6 px-2 bg-blue-500 text-white flex items-center justify-center text-xs font-bold rounded"
          >
            FG
          </div>
          <div
            v-if="char.cutscene"
            class="w-auto h-6 px-2 bg-purple-500 text-white flex items-center justify-center text-xs font-bold rounded"
          >
            U
          </div>
        </div>
      </div>
      <div v-if="!filteredCharacters.length" class="text-sm text-gray-400 px-2 py-3">
        No characters found.
      </div>
    </div>
    <div
      v-if="filterModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      @click.self="filterModalOpen = false"
    >
      <div class="w-full max-w-sm rounded bg-gray-800 border border-gray-700 shadow-xl p-4">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
            aria-label="Close filters"
            @click="filterModalOpen = false"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div class="space-y-3">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded border px-3 py-3 text-left transition-colors"
            :class="showFatedGuestOnly ? 'border-blue-400 bg-blue-500/15' : 'border-gray-700 hover:bg-gray-700/70'"
            :aria-pressed="showFatedGuestOnly"
            @click="showFatedGuestOnly = !showFatedGuestOnly"
          >
            <span class="text-sm text-gray-100">Fated Guest animations</span>
            <span class="h-6 px-2 bg-blue-500 text-white flex items-center justify-center text-xs font-bold rounded">FG</span>
          </button>

          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded border px-3 py-3 text-left transition-colors"
            :class="showUltimateOnly ? 'border-purple-400 bg-purple-500/15' : 'border-gray-700 hover:bg-gray-700/70'"
            :aria-pressed="showUltimateOnly"
            @click="showUltimateOnly = !showUltimateOnly"
          >
            <span class="text-sm text-gray-100">Ultimate animations</span>
            <span class="h-6 px-2 bg-purple-500 text-white flex items-center justify-center text-xs font-bold rounded">U</span>
          </button>

          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded border px-3 py-3 text-left transition-colors"
            :class="characterTypeFilter === 'playable' ? 'border-emerald-400 bg-emerald-500/15' : 'border-gray-700 hover:bg-gray-700/70'"
            :aria-pressed="characterTypeFilter === 'playable'"
            @click="characterTypeFilter = characterTypeFilter === 'playable' ? 'all' : 'playable'"
          >
            <span class="text-sm text-gray-100">Playable characters</span>
            <span class="h-6 px-2 bg-emerald-500 text-white flex items-center justify-center text-xs font-bold rounded">PC</span>
          </button>

          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 rounded border px-3 py-3 text-left transition-colors"
            :class="characterTypeFilter === 'npc' ? 'border-amber-400 bg-amber-500/15' : 'border-gray-700 hover:bg-gray-700/70'"
            :aria-pressed="characterTypeFilter === 'npc'"
            @click="characterTypeFilter = characterTypeFilter === 'npc' ? 'all' : 'npc'"
          >
            <span class="text-sm text-gray-100">NPCs</span>
            <span class="h-6 px-2 bg-amber-500 text-white flex items-center justify-center text-xs font-bold rounded">NPC</span>
          </button>
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button
            type="button"
            class="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasActiveFilters"
            @click="resetFilters"
          >
            Reset filters
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import icons from '@/utils/charIcons';
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useCharacterStore } from '@/stores/characterStore'

const emit = defineEmits(['select'])
const store = useCharacterStore()

const filter = ref('')
const filterModalOpen = ref(false)
const showFatedGuestOnly = ref(false)
const showUltimateOnly = ref(false)
const characterTypeFilter = ref<'all' | 'playable' | 'npc'>('all')
const hasActiveFilters = computed(
  () => showFatedGuestOnly.value || showUltimateOnly.value || characterTypeFilter.value !== 'all',
)

const filteredCharacters = computed(() =>
  store.characters.filter((c) => {
    const query = filter.value.trim().toLowerCase()
    const matchesSearch = !query || (c.charName + ' ' + c.costumeName).toLowerCase().includes(query)
    const matchesFatedGuest = !showFatedGuestOnly.value || !!c.dating
    const matchesUltimate = !showUltimateOnly.value || !!c.cutscene
    const isNpc = c.charName.includes('(Npc)')
    const matchesCharacterType =
      characterTypeFilter.value === 'all' ||
      (characterTypeFilter.value === 'npc' && isNpc) ||
      (characterTypeFilter.value === 'playable' && !isNpc)
    return matchesSearch && matchesFatedGuest && matchesUltimate && matchesCharacterType
  })
)

function select(id: string) {
  if (id === store.selectedCharacterId) return
  emit('select', id)
  store.selectedCharacterId = id
}

function resetFilters() {
  showFatedGuestOnly.value = false
  showUltimateOnly.value = false
  characterTypeFilter.value = 'all'
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    filterModalOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  emit('select', store.selectedCharacterId)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>
