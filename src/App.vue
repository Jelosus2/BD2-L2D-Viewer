<template>
  <div class="bg-gray-900 text-white h-dvh max-h-dvh flex flex-col">
    <Navbar
      v-show="!inspectMode"
      :has-custom-background="hasCustomBackground"
      :tutorial-active="tutorialActive"
      @mobile-menu="onNavMobileMenu"
      @upload-bg="onCustomBgUpload"
      @overlay-active="onNavbarOverlayActive"
      @settings-open="onSettingsOpen"
      @settings-close="onSettingsClose"
      @settings-language-change="completeInteractionTutorial"
    />
    <div class="flex flex-1 flex-col lg:flex-row h-full min-h-0 overflow-hidden">
      <div class="order-1 lg:order-none hidden lg:flex flex-col min-h-0">
        <AnimationSidebar
          :animations="animations"
          :skins="skins"
          :exporting="isExporting"
          :screenshotting="isScreenshotting"
          @select="onSelectAnimation"
          @reset-camera="onResetCamera"
          @screenshot="onScreenshot"
          @export-animation="onExportAnimation"
          @category-change="onCategoryChange"
          class="lg:w-64"
        />
      </div>
      <main class="relative flex-1 p-2 overflow-hidden">
        <div class="absolute top-2 left-2 lg:hidden z-50 flex items-center gap-2">
          <button v-show="!overlayActive" class="p-2" @click="showMobileControls = true">
            <MenuIcon />
          </button>
          <button v-show="!overlayActive" class="p-2" @click="onResetCamera">
            <CameraResetIcon />
          </button>
          <button
            v-show="!overlayActive"
            class="p-2"
            @click="store.playing = !store.playing"
          >
            <PauseIcon v-if="store.playing" />
            <PlayIcon v-else />
          </button>
          <select
            v-show="!overlayActive"
            v-model="store.selectedSkin"
            class="bg-gray-700 text-white"
          >
            <option v-for="skin in skins" :key="skin" :value="skin">{{ skin }}</option>
          </select>
          <select
            v-show="!overlayActive"
            v-model="store.selectedAnimation"
            class="bg-gray-700 text-white"
          >
            <option v-for="name in animations" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
        <div class="absolute top-17 left-4 lg:hidden z-50 flex flex-col items-start gap-2">
          <button
            v-show="!overlayActive"
            :aria-pressed="inspectMode"
            aria-label="Inspect animation"
            class="pb-2"
            @click="onInspectModeChange(!inspectMode)"
          >
            <InspectAnimationIcon :active="inspectMode" />
          </button>
          <button
            v-show="!overlayActive"
            @click="store.layerSelectionEnabled = !store.layerSelectionEnabled"
          >
            <LayerSelectIcon :active="store.layerSelectionEnabled" />
          </button>
          <button
            v-show="!overlayActive"
            aria-label="Zoom out"
            @click="onZoomOut"
          >
            <MinusIcon />
          </button>
          <button
            v-show="!overlayActive"
            aria-label="Zoom in"
            @click="onZoomIn"
          >
            <PlusIcon />
          </button>
        </div>
        <SpineViewer
          ref="viewerRef"
          :mobile-overlay-active="overlayActive"
          :inspect-mode="inspectMode"
          @update:inspect-mode="onInspectModeChange"
          @animations="onAnimationsLoaded"
          @skins="skins = $event"
          @character-interaction="onTutorialCharacterInteraction"
        />
        <div
          v-if="showLayerSelectionHint"
          class="absolute top-3 left-1/2 -translate-x-1/2 z-50 hidden lg:block pointer-events-none"
        >
          <div class="rounded-xl border border-gray-700 bg-gray-900/90 px-4 py-3 text-sm text-white shadow-lg shadow-black/40 backdrop-blur-sm">
            Use <span class="font-semibold text-indigo-300">H</span> to hide the selected layer,
            <span class="font-semibold text-indigo-300">U</span> to revert the last change, and
            <span class="font-semibold text-indigo-300">Esc</span> to reset the state.
          </div>
        </div>
      </main>
      <div v-show="!inspectMode" class="hidden lg:flex flex-col min-h-0">
        <CharacterSidebar
          @select="onSelectCharacter"
          class="lg:w-80"
        />
      </div>
    </div>
    <div
      v-if="showMobileControls"
      class="fixed inset-0 z-20 bg-gray-900 lg:hidden flex flex-col"
    >
      <button
        class="absolute top-3 right-4"
        @click="showMobileControls = false"
      >
        ✕
      </button>
      <div class="flex-1 flex flex-col gap-2 overflow-hidden p-2">
        <div class="flex-none">
          <AnimationSidebar
            :animations="animations"
            :skins="skins"
            :exporting="isExporting"
            :screenshotting="isScreenshotting"
            @select="onSelectAnimation"
            @reset-camera="onResetCamera"
            @screenshot="onScreenshot"
            @export-animation="onExportAnimation"
          />
        </div>
        <div class="flex-1 min-h-0">
          <CharacterSidebar @select="onSelectCharacter" />
        </div>
      </div>
    </div>
    <FeatureTutorial
      v-if="tutorialContent"
      :key="tutorialStep"
      :target="tutorialContent.target"
      :title="tutorialContent.title"
      :message="tutorialContent.message"
      :step-label="tutorialContent.stepLabel"
      :can-complete="tutorialContent.canComplete"
      @skip="completeInteractionTutorial"
      @complete="completeInteractionTutorial"
    />
  </div>
</template>

<script setup lang="ts">
import Navbar from '@/components/Navbar.vue'
import CharacterSidebar from '@/components/CharacterSideBar.vue'
import AnimationSidebar from '@/components/AnimationSideBar.vue'
import SpineViewer from '@/components/SpineViewer.vue'
import FeatureTutorial from '@/components/FeatureTutorial.vue'
import { ref, watchEffect, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { buildUrl } from './utils/urlSync'

import CameraResetIcon from '@/components/icons/CameraResetIcon.vue';
import MenuIcon from '@/components/icons/MenuIcon.vue';
import PauseIcon from '@/components/icons/PauseIcon.vue';
import PlayIcon from '@/components/icons/PlayIcon.vue';
import InspectAnimationIcon from '@/components/icons/InspectAnimationIcon.vue';
import LayerSelectIcon from '@/components/icons/LayerSelectIcon.vue';
import MinusIcon from '@/components/icons/MinusIcon.vue';
import PlusIcon from '@/components/icons/PlusIcon.vue';

const store = useCharacterStore()
const settingsStore = useSettingsStore()

type TutorialStep =
  | 'inactive'
  | 'loading'
  | 'character'
  | 'settings'
  | 'mobile-menu'
  | 'mobile-settings'
  | 'language'

type TutorialContent = {
  target: string | null
  title: string
  message: string
  stepLabel?: string
  canComplete?: boolean
}

const animations = ref<string[]>([])
const skins = ref<string[]>([])
const viewerRef = ref<InstanceType<typeof SpineViewer> | null>(null)
const isExporting = ref(false)
const isScreenshotting = ref(false)
const showMobileControls = ref(false)
const navMobileMenuOpen = ref(false)
const navbarOverlayActive = ref(false)
const showLayerSelectionHint = ref(false)
const inspectMode = ref(false)
const tutorialStep = ref<TutorialStep>(settingsStore.interactionTutorialCompleted ? 'inactive' : 'loading')
const tutorialCharacterId = ref<string | null>(null)
const mobileNavbarLayout = ref(false)
const overlayActive = computed(
  () => showMobileControls.value || navMobileMenuOpen.value || navbarOverlayActive.value,
)
const hasCustomBackground = computed(() => !!store.customBackgroundImage)
const tutorialActive = computed(() => tutorialStep.value !== 'inactive')
const tutorialContent = computed<TutorialContent | null>(() => {
  switch (tutorialStep.value) {
    case 'loading':
      return {
        target: null,
        title: 'Preparing an interactive character',
        message: 'Finding a playable character with the idle and motion animations...',
      }
    case 'character':
      return {
        target: '[data-tutorial="character-viewer"]',
        title: 'Characters are interactive',
        message: 'Click directly on the character to play their motion animation and voice line.',
        stepLabel: 'Step 1 of 3',
      }
    case 'settings':
      return {
        target: '[data-tutorial="settings-button"]',
        title: 'Voice settings',
        message: 'Open Settings with the gear button to choose the voice language.',
        stepLabel: 'Step 2 of 3',
      }
    case 'mobile-menu':
      return {
        target: '[data-tutorial="mobile-menu-button"]',
        title: 'Voice settings',
        message: 'Open the navigation menu to find the voice settings.',
        stepLabel: 'Step 2 of 3',
      }
    case 'mobile-settings':
      return {
        target: '[data-tutorial="mobile-settings-button"]',
        title: 'Open Settings',
        message: 'Tap Settings to choose between Japanese and Korean voices.',
        stepLabel: 'Step 2 of 3',
      }
    case 'language':
      return {
        target: '[data-tutorial="audio-language"]',
        title: 'Choose a voice language',
        message: 'Select JP or KR. Your preference is saved in this browser and used for future voice lines.',
        stepLabel: 'Step 3 of 3',
        canComplete: true,
      }
    default:
      return null
  }
})
let layerSelectionHintTimeout: number | null = null
let tutorialCandidateIds: string[] = []
let tutorialCandidateIndex = 0
let tutorialRetryTimeout: number | null = null
let mobileNavbarMediaQuery: MediaQueryList | null = null

function shuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function clearTutorialRetryTimeout() {
  if (tutorialRetryTimeout === null) return
  window.clearTimeout(tutorialRetryTimeout)
  tutorialRetryTimeout = null
}

function completeInteractionTutorial() {
  clearTutorialRetryTimeout()
  settingsStore.completeInteractionTutorial()
  tutorialStep.value = 'inactive'
  tutorialCharacterId.value = null
}

function loadNextTutorialCandidate() {
  clearTutorialRetryTimeout()
  const characterId = tutorialCandidateIds[tutorialCandidateIndex++]
  if (!characterId) {
    completeInteractionTutorial()
    return
  }

  tutorialCharacterId.value = characterId
  tutorialStep.value = 'loading'
  store.animationCategory = 'character'
  store.selectedAnimation = ''
  store.selectedSkin = ''
  store.playing = true
  animations.value = []
  skins.value = []
  showMobileControls.value = false
  if (store.selectedCharacterId !== characterId) {
    store.selectedCharacterId = characterId
  }
  tutorialRetryTimeout = window.setTimeout(loadNextTutorialCandidate, 20000)
}

function initializeInteractionTutorial() {
  if (settingsStore.interactionTutorialCompleted) return

  tutorialCandidateIds = shuffle(
    store.characters
      .filter(character =>
        !character.customFiles &&
        !!character.audio &&
        !character.charName.toLowerCase().includes('(npc)'),
      )
      .map(character => character.id),
  )
  if (tutorialCandidateIds.length > 1 && tutorialCandidateIds[0] === store.selectedCharacterId) {
    ;[tutorialCandidateIds[0], tutorialCandidateIds[1]] = [tutorialCandidateIds[1], tutorialCandidateIds[0]]
  }
  tutorialCandidateIndex = 0
  loadNextTutorialCandidate()
}

function onAnimationsLoaded(names: string[]) {
  animations.value = names
  if (
    tutorialStep.value !== 'loading' ||
    !tutorialCharacterId.value ||
    tutorialCharacterId.value !== store.selectedCharacterId
  ) {
    return
  }

  clearTutorialRetryTimeout()

  if (names.includes('idle') && names.includes('motion')) {
    store.selectedAnimation = 'idle'
    store.playing = true
    tutorialStep.value = 'character'
    return
  }

  tutorialRetryTimeout = window.setTimeout(loadNextTutorialCandidate, 0)
}

function onTutorialCharacterInteraction() {
  if (tutorialStep.value !== 'character') return
  tutorialStep.value = mobileNavbarLayout.value ? 'mobile-menu' : 'settings'
}

function onSettingsOpen() {
  if (
    tutorialStep.value === 'settings' ||
    tutorialStep.value === 'mobile-menu' ||
    tutorialStep.value === 'mobile-settings'
  ) {
    tutorialStep.value = 'language'
  }
}

function onSettingsClose() {
  if (tutorialStep.value === 'language') completeInteractionTutorial()
}

function updateMobileNavbarLayout(event?: MediaQueryListEvent) {
  mobileNavbarLayout.value = event?.matches ?? mobileNavbarMediaQuery?.matches ?? false
}

function onSelectCharacter(id: string) {
  if (id === store.selectedCharacterId) return
  store.selectedCharacterId = id
  store.selectedAnimation = ''
  store.selectedSkin = ''
  animations.value = []
  skins.value = []
  showMobileControls.value = false
}

function onSelectAnimation(name: string) {
  store.selectedAnimation = name
  showMobileControls.value = false
}

function onResetCamera() {
  viewerRef.value?.resetCamera()
}

function onZoomIn() {
  viewerRef.value?.zoomIn()
}

function onZoomOut() {
  viewerRef.value?.zoomOut()
}

function onScreenshot(value: boolean) {
  if (!viewerRef.value) return
  showMobileControls.value = false
  showMobileControls.value = false
  isScreenshotting.value = true
  viewerRef.value.saveScreenshot(value)
  isScreenshotting.value = false
}

async function onExportAnimation({ format, transparent }: { format: 'video' | 'frames'; transparent: boolean }) {
  if (!viewerRef.value) return
  showMobileControls.value = false
  isExporting.value = true
  try {
    if (format === 'frames') {
      await viewerRef.value.exportAnimationFrames(transparent)
    } else {
      await viewerRef.value.exportAnimation(transparent)
    }
  } catch (error) {
    console.error('Failed to export animation:', error)
  } finally {
    isExporting.value = false
  }
}

function onCategoryChange() {
  showMobileControls.value = false;
}

function onNavMobileMenu(open: boolean) {
  navMobileMenuOpen.value = open
  if (tutorialStep.value === 'mobile-menu' && open) {
    tutorialStep.value = 'mobile-settings'
  } else if (tutorialStep.value === 'mobile-settings' && !open) {
    tutorialStep.value = 'mobile-menu'
  }
}

function onCustomBgUpload(image: string | null) {
  if (image && image === store.customBackgroundImage) {
    store.customBackgroundImage = null
  }
  store.customBackgroundImage = image
}

function onNavbarOverlayActive(active: boolean) {
  navbarOverlayActive.value = active
}

function onInspectModeChange(value: boolean) {
  inspectMode.value = value
  if (value) {
    showMobileControls.value = false
    navMobileMenuOpen.value = false
    navbarOverlayActive.value = false
  }
}

function clearLayerSelectionHintTimeout() {
  if (layerSelectionHintTimeout === null) return
  window.clearTimeout(layerSelectionHintTimeout)
  layerSelectionHintTimeout = null
}

function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
}

watch(
  () => store.layerSelectionEnabled,
  enabled => {
    clearLayerSelectionHintTimeout()
    if (!enabled || !isDesktopViewport()) {
      showLayerSelectionHint.value = false
      return
    }
    showLayerSelectionHint.value = true
    layerSelectionHintTimeout = window.setTimeout(() => {
      showLayerSelectionHint.value = false
      layerSelectionHintTimeout = null
    }, 3000)
  },
)

watch(mobileNavbarLayout, mobile => {
  if (tutorialStep.value === 'settings' || tutorialStep.value === 'mobile-menu' || tutorialStep.value === 'mobile-settings') {
    tutorialStep.value = mobile
      ? navMobileMenuOpen.value
        ? 'mobile-settings'
        : 'mobile-menu'
      : 'settings'
  }
})

onMounted(() => {
  mobileNavbarMediaQuery = window.matchMedia('(max-width: 767px)')
  updateMobileNavbarLayout()
  mobileNavbarMediaQuery.addEventListener('change', updateMobileNavbarLayout)
  initializeInteractionTutorial()
})

onBeforeUnmount(() => {
  clearLayerSelectionHintTimeout()
  clearTutorialRetryTimeout()
  mobileNavbarMediaQuery?.removeEventListener('change', updateMobileNavbarLayout)
  mobileNavbarMediaQuery = null
})

watchEffect(() => {
  const query = buildUrl(store)
  history.replaceState(null, '', `${window.location.pathname}?${query}`)
}, { flush: 'sync' })
</script>
