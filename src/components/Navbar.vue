<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div>
    <nav class="flex items-center justify-between bg-black text-white p-4">
      <div class="text-xl md:text-3xl font-bold">Brown Dust 2 L2D Viewer</div>
      <div class="hidden md:flex items-center gap-4">
        <button class="cursor-pointer" @click="showUploadModal = true" title="Upload custom Spine model">
          <PlusIcon class="w-5 h-5 md:w-7 md:h-7" />
        </button>
        <button
          class="cursor-pointer"
          @click="openBackgroundModal(false)"
          aria-label="Upload background"
          title="Upload background image"
        >
          <BgUploadIcon class="w-5 h-5 md:w-7 md:h-7" />
        </button>
        <button
          v-if="hasCustomBackground"
          class="cursor-pointer opacity-70 hover:opacity-100 transition"
          @click="resetBackground"
          aria-label="Reset background"
          title="Reset background image"
        >
          <BgResetIcon class="w-5 h-5 md:w-7 md:h-7" />
        </button>
        <a
          href="https://ko-fi.com/jelosus1"
          target="_blank"
          rel="noopener"
          class="relative"
          title="Support on Ko-fi"
        >
          <KoFiIcon class="w-5 h-5 md:w-7 md:h-7" />
          <div
            v-if="showKofiTooltip"
            :class="[
              'absolute top-full z-10 mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white text-black text-xs rounded px-2 py-1 shadow transition-opacity duration-500',
              kofiTooltipHidden ? 'opacity-0' : 'opacity-100'
            ]"
          >
            If you like the work consider supporting!
            <span class="absolute left-1/2 -top-2 -translate-x-1/2 border-4 border-transparent border-b-white"></span>
          </div>
        </a>
        <a
          href="https://www.patreon.com/cw/jelosus1"
          target="_blank"
          rel="noopener"
          title="Support on Patreon"
        >
          <PatreonIcon class="w-5 h-5 md:w-7 md:h-7" />
        </a>
        <button
          type="button"
          data-tutorial="settings-button"
          class="cursor-pointer"
          title="Settings"
          aria-label="Open settings"
          @click="openSettings(false)"
        >
          <SettingsIcon class="w-5 h-5 md:w-7 md:h-7" />
        </button>
        <button class="cursor-pointer" @click="showChangelog = true" title="Changelog">
          <ChangelogIcon class="w-5 h-5 md:w-7 md:h-7" />
        </button>
        <a href="https://github.com/Jelosus2/BD2-L2D-Viewer" target="_blank" title="Open GitHub repository">
          <GithubIcon class="w-5 h-5 md:w-7 md:h-7" />
        </a>
      </div>
      <button
        data-tutorial="mobile-menu-button"
        class="md:hidden cursor-pointer"
        @click="openMobileMenu()"
        aria-label="Menu"
      >
        <MenuIcon class="w-5 h-5" />
      </button>
    </nav>

    <div
      v-if="mobileMenuOpen"
      ref="mobileMenu"
      tabindex="-1"
      class="fixed inset-0 z-50 md:hidden bg-black bg-opacity-50"
    >
      <button
        class="absolute top-2 right-4 text-xl"
        @click="closeMobileMenu"
        aria-label="Close menu"
      >
        ✕
      </button>
      <div
        class="bg-black text-white w-60 p-4 flex flex-col gap-4 h-full"
      >
        <button
          class="flex items-center gap-2"
          @click="() => { showUploadModal = true; closeMobileMenu(); }"
        >
          <PlusIcon class="w-5 h-5" />
          <span>Upload</span>
        </button>
        <button
          class="flex items-center gap-2"
          @click="openBackgroundModal(true)"
        >
          <BgUploadIcon class="w-5 h-5" />
          <span>Upload Background</span>
        </button>
        <button
          v-if="hasCustomBackground"
          class="flex items-center gap-2"
          @click="() => { resetBackground(); closeMobileMenu(); }"
        >
          <BgResetIcon class="w-5 h-5 opacity-60" />
          <span>Reset Background</span>
        </button>
        <button
          data-tutorial="mobile-settings-button"
          class="flex items-center gap-2"
          @click="openSettings(true)"
        >
          <SettingsIcon class="w-5 h-5" />
          <span>Settings</span>
        </button>
        <button
          class="flex items-center gap-2"
          @click="() => { showChangelog = true; closeMobileMenu(); }"
        >
          <ChangelogIcon class="w-5 h-5" />
          <span>Changelog</span>
        </button>
        <a
          href="https://github.com/Jelosus2/BD2-L2D-Viewer"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2"
          @click="closeMobileMenu"
        >
          <GithubIcon class="w-5 h-5" />
          <span>GitHub</span>
        </a>
        <a
          href="https://ko-fi.com/jelosus1"
          target="_blank"
          rel="noopener"
          class="relative flex items-center gap-2"
          @click="closeMobileMenu"
        >
          <KoFiIcon class="w-5 h-5" />
          <span>Ko-fi</span>
          <span
            v-if="showMobileKofiTip"
            :class="[
              'ml-2 text-xs bg-red-600 text-white rounded px-2 py-0.5 transition-opacity duration-500',
              mobileKofiTipHidden ? 'opacity-0' : 'opacity-100'
            ]"
            >Support!</span
          >
        </a>
        <a
          href="https://www.patreon.com/cw/jelosus1"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2"
          @click="closeMobileMenu"
        >
          <PatreonIcon class="w-5 h-5" />
          <span>Patreon</span>
        </a>
      </div>
    </div>

    <UploadSpineModal v-if="showUploadModal" @close="showUploadModal = false" />
    <ChangelogModal v-if="showChangelog" @close="showChangelog = false" />
    <SettingsModal
      v-if="showSettings"
      @close="closeSettings"
      @language-change="emit('settings-language-change')"
    />
    <UploadBackgroundModal
      v-if="showBackgroundModal"
      :show-reset="hasCustomBackground"
      @close="showBackgroundModal = false"
      @upload-bg="handleBackgroundUpload"
      @reset-bg="handleBackgroundReset"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import ChangelogModal from '@/components/ChangelogModal.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import UploadSpineModal from '@/components/UploadSpineModal.vue'
import UploadBackgroundModal from '@/components/UploadBackgroundModal.vue'

import GithubIcon from '@/components/icons/GithubIcon.vue'
import ChangelogIcon from '@/components/icons/ChangelogIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'
import MenuIcon from '@/components/icons/MenuIcon.vue'
import KoFiIcon from '@/components/icons/KoFiIcon.vue'
import PatreonIcon from '@/components/icons/PatreonIcon.vue'
import BgUploadIcon from '@/components/icons/BgUploadIcon.vue'
import BgResetIcon from '@/components/icons/BgResetIcon.vue'
import SettingsIcon from '@/components/icons/SettingsIcon.vue'

const props = defineProps<{ hasCustomBackground?: boolean; tutorialActive?: boolean }>()
const hasCustomBackground = computed(() => !!props.hasCustomBackground)
const tutorialActive = computed(() => !!props.tutorialActive)

const showChangelog = ref(false)
const showUploadModal = ref(false)
const showBackgroundModal = ref(false)
const showSettings = ref(false)
const showKofiTooltip = ref(false)
const kofiTooltipHidden = ref(false)
const mobileMenuOpen = ref(false)
const mobileMenu = ref<HTMLElement | null>(null)
const showMobileKofiTip = ref(false)
const mobileKofiTipHidden = ref(false)
let closeMenuAfterBgUpload = false

let mobileTipTimer: number | undefined
let mobileTipHideTimer: number | undefined

const emit = defineEmits<{
  (e: 'mobile-menu', open: boolean): void
  (e: 'upload-bg', dataUrl: string | null): void
  (e: 'overlay-active', active: boolean): void
  (e: 'settings-open'): void
  (e: 'settings-close'): void
  (e: 'settings-language-change'): void
}>()

const openMobileMenu = () => {
  mobileMenuOpen.value = true
  emit('mobile-menu', true)
  if (!tutorialActive.value && !localStorage.getItem('kofiPromptSeen') && !mobileTipTimer) {
    showMobileKofiTip.value = true
    mobileTipTimer = window.setTimeout(() => {
      mobileKofiTipHidden.value = true
      mobileTipHideTimer = window.setTimeout(() => {
        showMobileKofiTip.value = false
        localStorage.setItem('kofiPromptSeen', '1')
      }, 500)
    }, 5000)
  }
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
  emit('mobile-menu', false)
  if (mobileTipTimer) {
    clearTimeout(mobileTipTimer)
    mobileTipTimer = undefined
  }
  if (mobileTipHideTimer) {
    clearTimeout(mobileTipHideTimer)
    mobileTipHideTimer = undefined
  }
  mobileKofiTipHidden.value = false
  showMobileKofiTip.value = false
}

const openBackgroundModal = (fromMobile: boolean) => {
  closeMenuAfterBgUpload = fromMobile
  if (fromMobile && mobileMenuOpen.value) {
    closeMobileMenu()
  }
  showBackgroundModal.value = true
}

const openSettings = (fromMobile: boolean) => {
  if (fromMobile && mobileMenuOpen.value) {
    closeMobileMenu()
  }
  showSettings.value = true
  emit('settings-open')
}

const closeSettings = () => {
  showSettings.value = false
  emit('settings-close')
}

const resetBackground = () => {
  closeMenuAfterBgUpload = false
  emit('upload-bg', null)
  showBackgroundModal.value = false
  if (mobileMenuOpen.value) {
    closeMobileMenu()
  }
}

const handleBackgroundUpload = (dataUrl: string | null) => {
  if (dataUrl) {
    emit('upload-bg', dataUrl)
  }
  if (closeMenuAfterBgUpload && mobileMenuOpen.value) {
    closeMobileMenu()
  }
  closeMenuAfterBgUpload = false
  showBackgroundModal.value = false
}

const handleBackgroundReset = () => {
  closeMenuAfterBgUpload = false
  emit('upload-bg', null)
  showBackgroundModal.value = false
}

watch(
  [showChangelog, showUploadModal, showBackgroundModal, showSettings],
  () => {
    const active = showChangelog.value || showUploadModal.value || showBackgroundModal.value || showSettings.value
    emit('overlay-active', active)
  },
  { immediate: true },
)

onMounted(() => {
  if (
    !tutorialActive.value &&
    !localStorage.getItem('kofiPromptSeen') &&
    !window.matchMedia('(max-width: 767px)').matches
  ) {
    showKofiTooltip.value = true
    setTimeout(() => {
      kofiTooltipHidden.value = true
      setTimeout(() => {
        showKofiTooltip.value = false
        localStorage.setItem('kofiPromptSeen', '1')
      }, 500)
    }, 5000)
  }
})
</script>
