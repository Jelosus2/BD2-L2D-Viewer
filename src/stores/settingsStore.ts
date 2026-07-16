import { defineStore } from 'pinia'

export type AudioLanguage = 'JP' | 'KR'

type PersistedSettings = {
  audioLanguage: AudioLanguage
  interactionTutorialCompleted: boolean
}

const SETTINGS_STORAGE_KEY = 'bd2-l2d-viewer-settings'
const DEFAULT_SETTINGS: PersistedSettings = {
  audioLanguage: 'JP',
  interactionTutorialCompleted: false,
}

function persistSettings(settings: PersistedSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function loadSettings(): PersistedSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }

  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!rawSettings) return { ...DEFAULT_SETTINGS }
    const parsedSettings = JSON.parse(rawSettings) as Partial<PersistedSettings>
    return {
      audioLanguage: parsedSettings.audioLanguage === 'KR' ? 'KR' : 'JP',
      interactionTutorialCompleted: parsedSettings.interactionTutorialCompleted === true,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export const useSettingsStore = defineStore('settingsStore', {
  state: loadSettings,
  actions: {
    setAudioLanguage(language: AudioLanguage) {
      this.audioLanguage = language
      persistSettings({
        audioLanguage: this.audioLanguage,
        interactionTutorialCompleted: this.interactionTutorialCompleted,
      })
    },
    completeInteractionTutorial() {
      this.interactionTutorialCompleted = true
      persistSettings({
        audioLanguage: this.audioLanguage,
        interactionTutorialCompleted: this.interactionTutorialCompleted,
      })
    },
  },
})
