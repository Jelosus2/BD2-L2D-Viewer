<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      @click.self="emit('close')"
    >
      <section
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabindex="-1"
        class="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-gray-700 bg-gray-900 text-gray-100 shadow-2xl outline-none sm:max-w-md sm:rounded-xl"
      >
        <header class="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h2 id="settings-title" class="text-lg font-semibold">Settings</h2>
          </div>
          <button
            type="button"
            class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-2xl leading-none text-gray-300 transition-colors hover:bg-gray-700/60 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            aria-label="Close settings"
            @click="emit('close')"
          >
            &times;
          </button>
        </header>

        <div class="space-y-3 px-5 py-5 pb-7 sm:pb-5">
          <fieldset data-tutorial="audio-language">
            <legend class="font-medium text-white">Audio language</legend>
            <p class="mt-1 text-sm text-gray-400">Choose which voice language plays with character animations.</p>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <label
                v-for="option in languageOptions"
                :key="option.value"
                class="relative flex min-h-20 cursor-pointer flex-col justify-center rounded-lg border px-4 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-400"
                :class="store.audioLanguage === option.value
                  ? 'border-indigo-400 bg-indigo-500/15 text-white'
                  : 'border-gray-700 bg-gray-800/60 text-gray-300 hover:border-gray-500 hover:bg-gray-800'"
              >
                <input
                  class="sr-only"
                  type="radio"
                  name="audio-language"
                  :value="option.value"
                  :checked="store.audioLanguage === option.value"
                  @change="setAudioLanguage(option.value)"
                />
                <span class="text-base font-semibold">{{ option.value }}</span>
                <span class="mt-0.5 text-xs text-gray-400">{{ option.label }}</span>
                <span
                  v-if="store.audioLanguage === option.value"
                  class="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-indigo-400"
                  aria-hidden="true"
                />
              </label>
            </div>
          </fieldset>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSettingsStore, type AudioLanguage } from '@/stores/settingsStore'

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'language-change'): void
}>()
const store = useSettingsStore()
const dialog = ref<HTMLElement | null>(null)
const languageOptions: Array<{ value: AudioLanguage; label: string }> = [
  { value: 'JP', label: 'Japanese' },
  { value: 'KR', label: 'Korean' },
]

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

function setAudioLanguage(language: AudioLanguage) {
  store.setAudioLanguage(language)
  emit('language-change')
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  void nextTick(() => dialog.value?.focus())
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>
