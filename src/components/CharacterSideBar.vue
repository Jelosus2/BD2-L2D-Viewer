<template>
  <div class="w-full lg:w-80 h-full bg-gray-800 text-white flex flex-col min-h-0">
    <input
      v-model="filter"
      type="text"
      placeholder="Search..."
      class="bg-gray-700 text-white p-2 mb-2 outline-none w-full"
    />
    <div class="overflow-y-auto flex-1 px-2 sidebar-scroll">
      <div
        v-for="char in filteredCharacters"
        :key="char.id"
        class="flex items-center py-2 cursor-pointer"
        :class="{ 'bg-gray-700': char.id === store.selectedCharacterId }"
        @click="select(char.id)"
      >
        <img
          :src="icons[char.id] || icons['unknown']"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import icons from '@/utils/charIcons';
import { ref, computed, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/characterStore'

const emit = defineEmits(['select'])
const store = useCharacterStore()

const filter = ref('')

const filteredCharacters = computed(() =>
  store.characters.filter((c) =>
    (c.charName + ' ' + c.costumeName)
      .toLowerCase()
      .includes(filter.value.toLowerCase())
  )
)

function select(id: string) {
  if (id === store.selectedCharacterId) return
  emit('select', id)
  store.selectedCharacterId = id
}

onMounted(() => {
  emit('select', store.selectedCharacterId)
})
</script>
