<template>
  <div class="relative w-full h-full">
    <div
      ref="toolbarRef"
      class="absolute left-2 top-16 lg:top-2 flex flex-col gap-2 pointer-events-auto transition-opacity duration-150"
      :class="[showingMobileOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100 z-40']"
    >
      <button
        ref="editToggleRef"
        type="button"
        @click="toggleBackgroundEditing"
        :aria-pressed="editingBackground"
        :disabled="!hasBackgroundImage"
        v-show="hasBackgroundImage"
        :class="editButtonClasses"
      >
        <BgEditIcon />
      </button>
      <div class="flex flex-row gap-2">
        <button
          ref="datingToggleRef"
          v-show="store.characters.find(c => c.id === store.selectedCharacterId)?.datingHasNoBg && store.animationCategory === 'dating'"
          @click="store.showDatingBg = !store.showDatingBg"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
        >
          <BgToggleIcon :active="store.showDatingBg" />
        </button>
        <button
          @click="store.layerSelectionEnabled = !store.layerSelectionEnabled"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
        >
          <LayerSelectIcon :active="store.layerSelectionEnabled" />
        </button>
      </div>
    </div>
    <div ref="viewerWrapper" class="relative w-full h-full">
      <div class="absolute inset-0 overflow-hidden" :style="backgroundContainerStyle">
        <div
          v-if="backgroundReady"
          ref="backgroundImageWrapperRef"
          :style="backgroundImageStyle"
          class="bg-image-wrapper"
          @pointerdown="onBackgroundImagePointerDown"
        >
          <img
            ref="backgroundImageEl"
            :src="backgroundImage.src"
            alt="Background"
            draggable="false"
            class="w-full h-full object-cover select-none pointer-events-none"
          />
        </div>
      </div>
      <div
        v-if="backgroundReady && editingBackground"
        ref="backgroundOverlayRef"
        :style="backgroundOverlayStyle"
        :class="backgroundWrapperClasses"
        class="bg-editable"
        @pointerdown="onOverlayPointerDown"
      >
        <span
          v-for="handle in resizeHandles"
          :key="handle"
          class="bg-resize-handle"
          :class="`bg-resize-handle--${handle}`"
          @pointerdown.stop.prevent="event => onResizeHandlePointerDown(handle, event as PointerEvent)"
        />
      </div>
      <div ref="container" class="absolute inset-0 z-10" @pointerdown="onViewerPointerDown"></div>
      <canvas ref="overlayCanvas" class="absolute inset-0 z-20 pointer-events-none"></canvas>
    </div>
    <div
      v-if="store.selectedLayerName"
      class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white px-4 py-3 rounded-full z-50 pointer-events-none shadow-lg shadow-black/50 text-sm border border-gray-700 backdrop-blur-sm transition-opacity"
    >
      Selected Layer: <span class="font-bold text-indigo-400">{{ store.selectedLayerName }}</span>
    </div>
    <input
      type="range"
      min="0"
      max="1"
      step="0.001"
      v-model.number="progress"
      @input="seek"
      v-show="!showingMobileOverlay"
      :disabled="showingMobileOverlay"
      class="seek-range absolute bottom-0 left-0 w-full z-30"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount, computed, type CSSProperties } from 'vue'
import { useCharacterStore } from '@/stores/characterStore'
import {
  SpinePlayer,
  Vector2,
  Vector3,
  CameraController,
  OrthoCamera,
  GLTexture,
  type Skeleton as SpineSkeleton,
} from '@esotericsoftware/spine-player'
import JSZip from 'jszip'

import type { Animation } from '@esotericsoftware/spine-player'
import type { SpinePlayerInternal } from '@/types/spine-player-internal'

import BgEditIcon from '@/components/icons/BgEditIcon.vue'
import BgToggleIcon from '@/components/icons/BgToggleIcon.vue'
import LayerSelectIcon from '@/components/icons/LayerSelectIcon.vue'

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
type SpineSlot = {
  data: { name: string; color?: { a: number }; darkColor?: { a: number } }
  color?: { a: number }
  darkColor?: { a: number }
  setAttachment?: (attachment: unknown) => void
  getAttachment?: () => unknown
  attachment?: unknown
}

const container = ref<HTMLDivElement | null>(null)
const viewerWrapper = ref<HTMLDivElement | null>(null)
const toolbarRef = ref<HTMLDivElement | null>(null)
const editToggleRef = ref<HTMLButtonElement | null>(null)
const datingToggleRef = ref<HTMLButtonElement | null>(null)
const backgroundImageWrapperRef = ref<HTMLDivElement | null>(null)
const backgroundOverlayRef = ref<HTMLDivElement | null>(null)
const backgroundImageEl = ref<HTMLImageElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)

const progress = ref(0)
const store = useCharacterStore()

const props = defineProps<{ mobileOverlayActive?: boolean }>()
const showingMobileOverlay = computed(() => props.mobileOverlayActive ?? false)

const selectedCharacter = computed(() => store.characters.find(c => c.id === store.selectedCharacterId) || null)
const selectedCharacterUsesDatingTracks = computed(
  () => store.animationCategory === 'dating' && !!selectedCharacter.value?.datingUsesTracks,
)

const editingBackground = ref(false)
const backgroundImage = reactive({
  src: '' as string,
  naturalWidth: 0,
  naturalHeight: 0,
  initialized: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
})

const resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const containerSize = reactive({ width: 0, height: 0 })
const isDraggingBackground = ref(false)
const isResizingBackground = ref(false)

let resizeObserver: ResizeObserver | null = null
let backgroundImageLoaded = false
let backgroundImageElement: HTMLImageElement | null = null
let compositeFrameHandle: number | null = null

let activePointerId: number | null = null
let activePointerMoveListener: ((event: PointerEvent) => void) | null = null
const pointerStart = { x: 0, y: 0 }
const initialRect = { x: 0, y: 0, width: 0, height: 0 }
const MIN_BACKGROUND_SIZE = 60

const backgroundReady = computed(() => backgroundImage.initialized && backgroundImage.width > 0 && backgroundImage.height > 0)
const hasBackgroundImage = computed(() => backgroundReady.value)
const activeBackgroundSrc = computed(() => store.customBackgroundImage || null)

const backgroundRectStyle = computed(() => ({
  left: `${backgroundImage.x}px`,
  top: `${backgroundImage.y}px`,
  width: `${backgroundImage.width}px`,
  height: `${backgroundImage.height}px`,
}))

const normalizedBackgroundColor = computed(() => {
  const color = store.backgroundColor || '#000000'
  return color.startsWith('#') ? color : `#${color}`
})

const backgroundContainerStyle = computed<CSSProperties>(() => ({
  backgroundColor: normalizedBackgroundColor.value,
}))

const backgroundImageStyle = computed<CSSProperties>(() => ({
  ...backgroundRectStyle.value,
  pointerEvents: editingBackground.value ? 'auto' : 'none',
  cursor: editingBackground.value
    ? isDraggingBackground.value
      ? 'grabbing'
      : 'grab'
    : 'default',
}))

const backgroundOverlayStyle = computed<CSSProperties>(() => ({
  ...backgroundRectStyle.value,
  pointerEvents: editingBackground.value ? 'auto' : 'none',
  touchAction: 'none',
}))

const backgroundWrapperClasses = computed(() => {
  const classes: string[] = []
  if (editingBackground.value) classes.push('bg-editable--editing')
  if (editingBackground.value && isDraggingBackground.value) classes.push('bg-editable--dragging')
  return classes
})

const editButtonClasses = computed(() => [
  'w-8 h-8 p-1.5 rounded-md flex items-center justify-center text-white transition-colors transition-opacity',
  !hasBackgroundImage.value
    ? 'opacity-60 cursor-not-allowed'
    : editingBackground.value
      ? 'lg:bg-indigo-600/90 lg:hover:bg-indigo-500'
      : 'lg:bg-gray-800/80 lg:hover:bg-gray-700/80',
])

let player: SpinePlayer | null = null
let recorder: MediaRecorder | null = null
let cancelExport = false
let exportingFrames = false
let manualCamera: OrthoCamera | null = null
let defaultCameraPos = new Vector2()
let defaultZoom = 0
const previousLayerVisibility = new Map<string, boolean>()

let offset = new Vector2()
let size = new Vector2()

function getMixIndex(animationName: string): number | null {
  const match = /^mix(\d+)/i.exec(animationName)
  if (!match) return null
  const index = Number(match[1])
  return Number.isFinite(index) ? index : null
}

function shouldUseDatingTracksForAnimation(animationName: string | null | undefined) {
  if (!selectedCharacterUsesDatingTracks.value) return false
  if (!animationName) return false
  return getMixIndex(animationName) !== null
}

function getActiveTrackIndexForSelectedAnimation(state: SpinePlayer['animationState'] | null | undefined) {
  const anim = store.selectedAnimation
  if (!state || !anim) return 0

  if (shouldUseDatingTracksForAnimation(anim)) {
    const entry1 = state.getCurrent(1)
    if (entry1?.animation?.name === anim) return 1
  }
  return 0
}

function setSpineAnimation(
  p: SpinePlayer,
  animationName: string,
  options: { loop: boolean; forceNoMix?: boolean } = { loop: true },
) {
  const state = p.animationState
  if (!state) return

  const wantsTracks = shouldUseDatingTracksForAnimation(animationName)
  const mixIndex = getMixIndex(animationName)

  const useNoMix = options.forceNoMix || selectedCharacterUsesDatingTracks.value

  if (wantsTracks && mixIndex !== null) {
    const idleName = `idle${mixIndex}`
    const available = new Set(state.data.skeletonData.animations.map(a => a.name))
    if (available.has(animationName) && available.has(idleName)) {
      state.clearTrack(0)
      state.clearTrack(1)

      p.skeleton?.setToSetupPose()
      p.skeleton?.updateWorldTransform()

      const idleEntry = state.setAnimation(0, idleName, true)
      const mixEntry = state.setAnimation(1, animationName, options.loop)

      if (idleEntry) {
        idleEntry.trackEnd = Number.MAX_VALUE
      }

      if (useNoMix) {
        for (const entry of [idleEntry, mixEntry]) {
          if (!entry) continue
          entry.mixDuration = 0
          entry.mixTime = 0
        }
      }
      return
    }
  }

  if (selectedCharacterUsesDatingTracks.value) {
    state.clearTrack(0)
    state.clearTrack(1)

    p.skeleton?.setToSetupPose()
    p.skeleton?.updateWorldTransform()
  } else {
    state.clearTrack(1)
  }

  const entry = state.setAnimation(0, animationName, options.loop)
  if (useNoMix && entry) {
    entry.mixDuration = 0
    entry.mixTime = 0
  }
}

function isBackgroundSlot(name: string) {
  const normalized = name.toLowerCase()
  return (
    normalized.startsWith('bg') ||
    normalized.startsWith('bk') ||
    normalized.includes(' bg') ||
    normalized.includes('_bg') ||
    normalized.includes('background')
  )
}

function computeTrimmedBounds(skeleton: SpineSkeleton | null) {
  if (!skeleton) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let found = false

  for (const slot of skeleton.drawOrder) {
    const slotName = slot.data.name
    if (isBackgroundSlot(slotName)) continue

    const attachment = slot.getAttachment() as unknown as {
      worldVerticesLength?: number
      computeWorldVertices?: (
        slotArg: typeof slot,
        start: number,
        count: number,
        output: Float32Array,
        offsetArg: number,
        stride: number,
      ) => void
    }

    if (!attachment || typeof attachment.computeWorldVertices !== 'function') continue
    const vertexCount = attachment.worldVerticesLength ?? 0
    if (!vertexCount) continue

    const worldVertices = new Float32Array(vertexCount)
    try {
      attachment.computeWorldVertices(slot, 0, vertexCount, worldVertices, 0, 2)
    } catch {
      continue
    }

    for (let i = 0; i < worldVertices.length; i += 2) {
      const x = worldVertices[i]
      const y = worldVertices[i + 1]
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      found = true
    }
  }

  if (!found) return null
  const width = maxX - minX
  const height = maxY - minY
  if (width <= 0 || height <= 0) return null
  const padding = 50

  return {
    offset: new Vector2(minX - padding, minY - padding),
    size: new Vector2(width + padding * 2, height + padding * 2),
  }
}

function computeCameraBounds(skeleton: SpineSkeleton | null) {
  const fallbackOffset = new Vector2()
  const fallbackSize = new Vector2()
  if (!skeleton) return { offset: fallbackOffset, size: fallbackSize }

  skeleton.getBounds(fallbackOffset, fallbackSize)
  const trimmed = computeTrimmedBounds(skeleton)

  if (trimmed) {
    const trimmedWidth = trimmed.size.x
    const trimmedHeight = trimmed.size.y
    const fallbackWidth = fallbackSize.x
    const fallbackHeight = fallbackSize.y
    const widthRatio = fallbackWidth / Math.max(trimmedWidth, 1)
    const heightRatio = fallbackHeight / Math.max(trimmedHeight, 1)
    const trimmedIsMeaningful =
      Number.isFinite(trimmedWidth) &&
      Number.isFinite(trimmedHeight) &&
      trimmedWidth > 0 &&
      trimmedHeight > 0
    if (trimmedIsMeaningful && (widthRatio > 10 || heightRatio > 10)) {
      return trimmed
    }
  }

  return { offset: fallbackOffset, size: fallbackSize }
}

function applyLayerVisibility(skeleton: SpineSkeleton | null) {
  if (!skeleton) return
  const visibility = store.layerVisibility
  const slots = skeleton.slots as unknown as SpineSlot[]
  for (const slot of slots) {
    const name = slot.data?.name
    if (!name) continue
    if (visibility[name] === false) {
      if (slot.color) slot.color.a = 0
      if (slot.darkColor) slot.darkColor.a = 0
    }
  }
}

function restoreLayerAlphas(skeleton: SpineSkeleton | null, slotName: string) {
  if (!skeleton) return
  const slots = skeleton.slots as unknown as SpineSlot[]
  const slot = slots.find(item => item.data?.name === slotName)
  if (!slot) return
  if (slot.color) {
    const baseAlpha = slot.data?.color?.a
    slot.color.a = typeof baseAlpha === 'number' ? baseAlpha : 1
  }
  if (slot.darkColor) {
    const baseAlpha = slot.data?.darkColor?.a
    if (typeof baseAlpha === 'number') {
      slot.darkColor.a = baseAlpha
    }
  }
}

function stopPointerTracking(event?: PointerEvent) {
  if (event && activePointerId !== null && event.pointerId !== activePointerId) return
  if (activePointerMoveListener) {
    window.removeEventListener('pointermove', activePointerMoveListener)
    activePointerMoveListener = null
  }
  window.removeEventListener('pointerup', stopPointerTracking)
  window.removeEventListener('pointercancel', stopPointerTracking)
  activePointerId = null
  isDraggingBackground.value = false
  isResizingBackground.value = false
}

function startPointerTracking(handler: (event: PointerEvent) => void, pointerId: number) {
  stopPointerTracking()
  activePointerId = pointerId
  activePointerMoveListener = event => {
    if (activePointerId !== null && event.pointerId !== activePointerId) return
    handler(event)
  }
  window.addEventListener('pointermove', activePointerMoveListener)
  window.addEventListener('pointerup', stopPointerTracking)
  window.addEventListener('pointercancel', stopPointerTracking)
}

function applyPlayerBackgroundTransparency(target?: SpinePlayer | null) {
  const instance = target ?? player
  if (!instance) return
  const internal = instance as unknown as SpinePlayerInternal
  internal.config.backgroundColor = '00000000'
  internal.bg.setFromString('00000000')
  instance.dom.style.backgroundColor = 'transparent'
  if (instance.canvas) {
    instance.canvas.style.backgroundColor = 'transparent'
  }
}

function updateCanvasPointerEvents(target?: SpinePlayer | null) {
  const instance = target ?? player
  if (!instance) return
  const pointerValue = editingBackground.value ? 'none' : 'auto'
  instance.dom.style.pointerEvents = pointerValue
  if (instance.canvas) {
    instance.canvas.style.pointerEvents = pointerValue
  }
}

function getRenderedBackgroundImage(): HTMLImageElement | null {
  return backgroundImageEl.value ?? backgroundImageElement
}

function getToolbarButtonAtPointer(event: PointerEvent): HTMLButtonElement | null {
  const wrappers = [backgroundImageWrapperRef.value, backgroundOverlayRef.value]
  const previousPointer = wrappers.map(wrapper => (wrapper ? wrapper.style.pointerEvents : null))
  wrappers.forEach(wrapper => {
    if (wrapper) wrapper.style.pointerEvents = 'none'
  })
  const element = document.elementFromPoint(event.clientX, event.clientY)
  wrappers.forEach((wrapper, index) => {
    if (wrapper && previousPointer[index] !== null) {
      wrapper.style.pointerEvents = previousPointer[index] as string
    }
  })
  if (!element || !toolbarRef.value) return null
  const button = element.closest('button')
  if (button && toolbarRef.value.contains(button)) {
    return button as HTMLButtonElement
  }
  return null
}

function toggleBackgroundEditing() {
  if (!hasBackgroundImage.value) return
  editingBackground.value = !editingBackground.value
  if (!editingBackground.value) {
    stopPointerTracking()
  }
  updateCanvasPointerEvents()
}

function setBackgroundSource(src: string | null) {
  stopPointerTracking()
  backgroundImageLoaded = false
  backgroundImage.initialized = false
  backgroundImage.naturalWidth = 0
  backgroundImage.naturalHeight = 0
  backgroundImageElement = null
  backgroundImage.x = 0
  backgroundImage.y = 0
  backgroundImage.width = 0
  backgroundImage.height = 0
  backgroundImage.src = src ?? ''
  if (!src) {
    editingBackground.value = false
    updateCanvasPointerEvents()
    return
  }
  loadBackgroundAsset(src)
  updateCanvasPointerEvents()
}
function ensureResizeObserver() {
  if (resizeObserver || !viewerWrapper.value) return
  if (typeof ResizeObserver === 'undefined') {
    containerSize.width = viewerWrapper.value.clientWidth
    containerSize.height = viewerWrapper.value.clientHeight
    initializeBackground()
    return
  }
  resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0]
    const { width, height } = entry.contentRect
    const prevWidth = containerSize.width
    const prevHeight = containerSize.height
    containerSize.width = width
    containerSize.height = height
    if (!backgroundImage.initialized) {
      initializeBackground()
    } else if (prevWidth > 0 && prevHeight > 0 && (width !== prevWidth || height !== prevHeight)) {
      const widthRatio = width / prevWidth
      const heightRatio = height / prevHeight
      backgroundImage.x *= widthRatio
      backgroundImage.y *= heightRatio
      backgroundImage.width *= widthRatio
      backgroundImage.height *= heightRatio
    }
  })
  resizeObserver.observe(viewerWrapper.value)
}

function loadBackgroundAsset(source?: string) {
  const src = source ?? backgroundImage.src
  const img = new Image()
  img.src = src
  const handleLoad = () => {
    backgroundImageLoaded = true
    backgroundImage.naturalWidth = img.naturalWidth
    backgroundImage.naturalHeight = img.naturalHeight
    backgroundImageElement = img
    initializeBackground(true)
  }
  const handleError = () => {
    if (src) {
      store.customBackgroundImage = null
      setBackgroundSource(null)
    }
  }
  if (img.complete && img.naturalWidth) {
    handleLoad()
  } else {
    img.onload = handleLoad
    img.onerror = handleError
  }
}

function initializeBackground(force = false) {
  if (!backgroundImageLoaded || !containerSize.width || !containerSize.height) return
  if (backgroundImage.initialized && !force) return
  const scale = Math.max(
    containerSize.width / backgroundImage.naturalWidth,
    containerSize.height / backgroundImage.naturalHeight,
  )
  const width = backgroundImage.naturalWidth * scale
  const height = backgroundImage.naturalHeight * scale
  backgroundImage.width = width
  backgroundImage.height = height
  backgroundImage.x = (containerSize.width - width) / 2
  backgroundImage.y = (containerSize.height - height) / 2
  backgroundImage.initialized = true
}

function startBackgroundDrag(event: PointerEvent) {
  if (!editingBackground.value || isResizingBackground.value) return
  event.preventDefault()
  event.stopPropagation()
  isDraggingBackground.value = true
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
  initialRect.x = backgroundImage.x
  initialRect.y = backgroundImage.y
  startPointerTracking(onBackgroundDragMove, event.pointerId)
}

function onBackgroundDragMove(event: PointerEvent) {
  const dx = event.clientX - pointerStart.x
  const dy = event.clientY - pointerStart.y
  backgroundImage.x = initialRect.x + dx
  backgroundImage.y = initialRect.y + dy
}

function startBackgroundResize(handle: ResizeHandle, event: PointerEvent) {
  if (!editingBackground.value) return
  event.preventDefault()
  event.stopPropagation()
  isResizingBackground.value = true
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
  initialRect.x = backgroundImage.x
  initialRect.y = backgroundImage.y
  initialRect.width = backgroundImage.width
  initialRect.height = backgroundImage.height
  startPointerTracking(ev => onBackgroundResizeMove(handle, ev), event.pointerId)
}

function onBackgroundResizeMove(handle: ResizeHandle, event: PointerEvent) {
  const dx = event.clientX - pointerStart.x
  const dy = event.clientY - pointerStart.y
  let newX = initialRect.x
  let newY = initialRect.y
  let newWidth = initialRect.width
  let newHeight = initialRect.height

  if (handle.includes('e')) {
    newWidth = Math.max(MIN_BACKGROUND_SIZE, initialRect.width + dx)
  }
  if (handle.includes('s')) {
    newHeight = Math.max(MIN_BACKGROUND_SIZE, initialRect.height + dy)
  }
  if (handle.includes('w')) {
    const width = Math.max(MIN_BACKGROUND_SIZE, initialRect.width - dx)
    const widthDiff = initialRect.width - width
    newWidth = width
    newX = initialRect.x + widthDiff
  }
  if (handle.includes('n')) {
    const height = Math.max(MIN_BACKGROUND_SIZE, initialRect.height - dy)
    const heightDiff = initialRect.height - height
    newHeight = height
    newY = initialRect.y + heightDiff
  }

  backgroundImage.x = newX
  backgroundImage.y = newY
  backgroundImage.width = newWidth
  backgroundImage.height = newHeight
}

function onResizeHandlePointerDown(handle: ResizeHandle, event: PointerEvent) {
  startBackgroundResize(handle, event)
}

function onBackgroundImagePointerDown(event: PointerEvent) {
  if (!editingBackground.value) return
  const toolbarButton = getToolbarButtonAtPointer(event)
  if (toolbarButton) {
    toolbarButton.click()
    return
  }
  startBackgroundDrag(event)
}

function onOverlayPointerDown(event: PointerEvent) {
  if (!editingBackground.value) return
  const toolbarButton = getToolbarButtonAtPointer(event)
  if (toolbarButton) {
    toolbarButton.click()
    return
  }
  startBackgroundDrag(event)
}

function drawBackgroundOntoContext(ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) {
  if (!backgroundReady.value) return
  const img = getRenderedBackgroundImage()
  if (!img || !img.complete) return
  const wrapper = viewerWrapper.value
  if (!wrapper) return
  const wrapperRect = wrapper.getBoundingClientRect()
  if (!wrapperRect.width || !wrapperRect.height) return
  const imgRect = backgroundImageEl.value?.getBoundingClientRect()
  if (!imgRect) return
  const scaleX = targetWidth / wrapperRect.width
  const scaleY = targetHeight / wrapperRect.height
  const destX = (imgRect.left - wrapperRect.left) * scaleX
  const destY = (imgRect.top - wrapperRect.top) * scaleY
  const destWidth = imgRect.width * scaleX
  const destHeight = imgRect.height * scaleY
  ctx.drawImage(img, destX, destY, destWidth, destHeight)
}

function drawCompositeFrame(
  ctx: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
  sourceCanvas: HTMLCanvasElement,
  transparent: boolean,
) {
  ctx.clearRect(0, 0, targetWidth, targetHeight)
  if (!transparent) {
    ctx.fillStyle = normalizedBackgroundColor.value
    ctx.fillRect(0, 0, targetWidth, targetHeight)
    drawBackgroundOntoContext(ctx, targetWidth, targetHeight)
  }
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
}

function getCompositeDataURL(canvasElement: HTMLCanvasElement, transparent: boolean) {
  if (transparent) {
    return canvasElement.toDataURL('image/png')
  }
  const offscreen = document.createElement('canvas')
  offscreen.width = canvasElement.width
  offscreen.height = canvasElement.height
  const ctx = offscreen.getContext('2d')
  if (!ctx) return canvasElement.toDataURL('image/png')
  drawCompositeFrame(ctx, offscreen.width, offscreen.height, canvasElement, transparent)
  return offscreen.toDataURL('image/png')
}

const emit = defineEmits(['animations', 'skins'])
watch(editingBackground, value => {
  if (!value) {
    stopPointerTracking()
  }
  updateCanvasPointerEvents()
})

watch(
  () => store.layerVisibility,
  () => {
    if (!player || !player.skeleton || !player.animationState) return
    const skeleton = player.skeleton
    player.animationState.apply(skeleton)
    skeleton.updateWorldTransform()
    const current = store.layerVisibility
    for (const name of Object.keys(current)) {
      const isVisible = current[name] !== false
      const wasVisible = previousLayerVisibility.get(name)
      if (wasVisible === false && isVisible) {
        restoreLayerAlphas(skeleton, name)
      }
      previousLayerVisibility.set(name, isVisible)
    }
    ;(player as unknown as SpinePlayerInternal).drawFrame(false)
  },
  { deep: true },
)

watch(viewerWrapper, value => {
  if (value) ensureResizeObserver()
})

watch(activeBackgroundSrc, src => {
  setBackgroundSource(src)
})

async function load() {
  if (!container.value) return

  const char = store.characters.find(c => c.id === store.selectedCharacterId)
  if (!char) return
  store.layerNames = []
  store.layerVisibility = {}

  const ANIMATION_TYPE_BASE_PATH = {
    character: char.spine,
    ultimate: `cutscene/${char.cutscene}`,
    dating: !store.showDatingBg && char.datingHasNoBg ? `dating_nobg/${char.dating}` : `dating/${char.dating}`,
  }

  const assetRoot = import.meta.env.DEV ? 'src/assets/spines' : 'assets/spines'
  const path = `${assetRoot}/${char.id}/${ANIMATION_TYPE_BASE_PATH[store.animationCategory]}`

  const binaryUrl = char.customFiles?.skel || `${path}.skel`
  const jsonUrl = char.customFiles?.json
  const atlasUrl = char.customFiles?.atlas || `${path}.atlas`
  const rawDataURIs = char.customFiles?.images

  offset = new Vector2()
  size = new Vector2()

  if (player) {
    player.dispose()
    container.value.innerHTML = ''
    manualCamera = null
  }

  const originalUpdate = GLTexture.prototype.update
  GLTexture.prototype.update = function (useMipMaps: boolean) {
    const gl = this.context.gl
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    originalUpdate.call(this, useMipMaps)
  }

  player = new SpinePlayer(container.value, {
    showControls: false,
    ...((binaryUrl && !jsonUrl) && { binaryUrl }),
    ...(jsonUrl && { jsonUrl }),
    atlasUrl,
  rawDataURIs,
  backgroundColor: store.backgroundColor,
  preserveDrawingBuffer: true,
  premultipliedAlpha: true,
  alpha: true,
  viewport: {
    x: offset.x,
    y: offset.y,
    width: Math.max(size.x, 1),
    height: Math.max(size.y, 1),
    padLeft: 0,
    padRight: 0,
    padTop: 50,
    padBottom: 50,
    transitionTime: 0,
    },
    update: () => {
      if (manualCamera && player) {
        const cam = player.sceneRenderer!.camera
        cam.position.x = manualCamera.position.x
        cam.position.y = manualCamera.position.y
        cam.zoom = manualCamera.zoom
        cam.update()
      }
      if (player && store.playing) {
        const trackIndex = getActiveTrackIndexForSelectedAnimation(player.animationState)
        const entry = player.animationState?.getCurrent(trackIndex)
        if (entry && entry.animation) {
          const d = entry.animation.duration
          if (d > 0) {
            progress.value = (entry.trackTime % d) / d
          }
        }
      }
      applyLayerVisibility(player?.skeleton ?? null)
      drawOverlay()
    },
    success: (p: SpinePlayer) => {
      const skeleton = p.skeleton ?? null
      skeleton?.setToSetupPose()
      skeleton?.updateWorldTransform()

      const names = p.animationState?.data.skeletonData.animations.map((a: Animation) => a.name) || []
      emit('animations', names)
      const skinNames = skeleton?.data.skins.map(s => s.name) || []
      emit('skins', skinNames)
      const slotNames = skeleton?.data.slots.map(slot => slot.name) || []
      store.layerNames = slotNames
      store.layerVisibility = Object.fromEntries(slotNames.map(name => [name, true]))
      previousLayerVisibility.clear()
      slotNames.forEach(name => previousLayerVisibility.set(name, true))

      const selectAnimation = () => {
        if (!store.selectedAnimation || !names.includes(store.selectedAnimation)) {
          store.selectedAnimation = names[0]
        }
        if (store.selectedAnimation) {
          setSpineAnimation(p, store.selectedAnimation, { loop: true })
          if (store.playing) {
            p.play()
          } else {
            p.pause()
          }
        }
      }

      const isBoundsReasonable = (result: ReturnType<typeof computeCameraBounds> | null) => {
        if (!result) return false
        const width = result.size.x
        const height = result.size.y
        return (
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0 &&
          width < 50000 &&
          height < 50000
        )
      }

      const applySkinAndMeasure = (skinName: string | undefined | null) => {
        if (!skinName || !skeleton) return null
        skeleton.setSkinByName(skinName)
        skeleton.setSlotsToSetupPose()
        skeleton.updateWorldTransform()
        return computeCameraBounds(skeleton)
      }

      let bounds: ReturnType<typeof computeCameraBounds> | null = null
      let chosenSkin = store.selectedSkin && skinNames.includes(store.selectedSkin) ? store.selectedSkin : ''

      if (chosenSkin) {
        const test = applySkinAndMeasure(chosenSkin)
        if (isBoundsReasonable(test)) {
          bounds = test
        } else {
          bounds = null
          chosenSkin = ''
        }
      }

      if (!bounds && skinNames.length) {
        for (const skinName of skinNames) {
          const test = applySkinAndMeasure(skinName)
          if (isBoundsReasonable(test)) {
            chosenSkin = skinName
            bounds = test
            break
          }
        }
      }

      if (!bounds && skinNames.length) {
        const fallbackSkin = chosenSkin || skinNames[0]
        chosenSkin = fallbackSkin
        bounds = applySkinAndMeasure(fallbackSkin)
      }

      if (chosenSkin && store.selectedSkin !== chosenSkin) {
        store.selectedSkin = chosenSkin
      }

      if (!bounds) {
        bounds = computeCameraBounds(skeleton)
      }

      offset = bounds.offset
      size = bounds.size
      const centerX = offset.x + size.x / 2
      const centerY = offset.y + size.y / 2

      ;(p as unknown as SpinePlayerInternal).config.viewport = {
        x: offset.x,
        y: offset.y,
        width: Math.max(size.x, 1),
        height: Math.max(size.y, 1),
        padLeft: 0,
        padRight: 0,
        padTop: 50,
        padBottom: 50,
        transitionTime: 0,
        animations: {},
      }

      manualCamera = new OrthoCamera(
        p.sceneRenderer!.camera.viewportWidth,
        p.sceneRenderer!.camera.viewportHeight,
      )
      manualCamera.position.x = centerX
      manualCamera.position.y = centerY
      const paddedWidth = Math.max(size.x, 1)
      const paddedHeight = Math.max(size.y + 100, 1)
      const canvas = p.canvas!
      const canvasAspect = canvas.height / canvas.width
      const viewportAspect = paddedHeight / paddedWidth
      manualCamera.zoom =
        canvasAspect > viewportAspect
          ? paddedWidth / canvas.width
          : paddedHeight / canvas.height
      manualCamera.update()
      defaultCameraPos = new Vector2(manualCamera.position.x, manualCamera.position.y)
      defaultZoom = manualCamera.zoom
      new CameraController(p.canvas!, manualCamera)

      selectAnimation()

      if (chosenSkin && skeleton) {
        skeleton.setSkinByName(chosenSkin)
        skeleton.setSlotsToSetupPose()
        skeleton.updateWorldTransform()
      }

      p.speed = store.animationSpeed
  },
})
  player.speed = store.animationSpeed
  applyPlayerBackgroundTransparency(player)
  updateCanvasPointerEvents(player)
}
watch(() => store.selectedCharacterId, () => {
  if (recorder && recorder.state === 'recording') {
    cancelExport = true
    recorder.stop()
  }
  if (exportingFrames) {
    cancelExport = true
  }
  store.animationCategory = 'character'
  void load()
})

watch(() => store.animationCategory, () => {
  if (recorder && recorder.state === 'recording') {
    cancelExport = true
    recorder.stop()
  }
  if (exportingFrames) {
    cancelExport = true
  }
  void load()
})

watch(() => store.selectedAnimation, anim => {
  if (recorder && recorder.state === 'recording') {
    cancelExport = true
    recorder.stop()
  }
  if (exportingFrames) {
    cancelExport = true
  }
  progress.value = 0
  if (player && anim) {
    setSpineAnimation(player, anim, { loop: true })
    store.playing = true
    player.play()
  }
})

watch(() => store.selectedSkin, skin => {
  if (player && skin) {
    player.skeleton?.setSkinByName(skin)
    player.skeleton?.setSlotsToSetupPose()
    player.animationState?.apply(player.skeleton!)
    player.skeleton!.updateWorldTransform()
  }
})

watch(() => store.playing, playing => {
  if (!player) return
  if (playing) player.play()
  else player.pause()
})

watch(() => store.animationSpeed, speed => {
  if (player) player.speed = speed
})

watch(() => store.backgroundColor, () => {
  applyPlayerBackgroundTransparency()
})

watch(() => store.showDatingBg, () => {
  if (recorder && recorder.state === 'recording') {
    cancelExport = true
    recorder.stop()
  }
  if (exportingFrames) {
    cancelExport = true
  }
  void load()
})

watch(() => store.layerSelectionEnabled, enabled => {
  if (!enabled) {
    store.selectedLayerName = null
  }
})

watch(showingMobileOverlay, value => {
  if (value) {
    editingBackground.value = false
  }
  updateCanvasPointerEvents()
})

function isPointInPolygon(px: number, py: number, vertices: Float32Array): boolean {
  let inside = false
  for (let i = 0, j = vertices.length - 2; i < vertices.length; j = i, i += 2) {
    const xi = vertices[i], yi = vertices[i + 1]
    const xj = vertices[j], yj = vertices[j + 1]
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function getCameraState() {
  const renderCam = player?.sceneRenderer?.camera
  if (!renderCam) return null
  return {
    cx: renderCam.position.x,
    cy: renderCam.position.y,
    zoom: renderCam.zoom,
    vw: renderCam.viewportWidth,
    vh: renderCam.viewportHeight
  }
}

function onViewerPointerDown(e: PointerEvent) {
  if (!store.layerSelectionEnabled || !player || editingBackground.value) return
  if (e.button !== 0) return

  const bounds = viewerWrapper.value?.getBoundingClientRect()
  if (!bounds) return
  
  const camState = getCameraState()
  if (!camState) return

  const screenX = e.clientX - bounds.left
  const screenY = e.clientY - bounds.top

  const { cx, cy, zoom, vw, vh } = camState

  const nx = (screenX / bounds.width) * 2 - 1
  const ny = 1 - 2 * (screenY / bounds.height)

  const wx = nx * (vw / 2) * zoom + cx
  const wy = ny * (vh / 2) * zoom + cy

  const slots = player.skeleton?.drawOrder
  if (!slots) return

  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i] as unknown as SpineSlot
    if (store.layerVisibility[slot.data.name] === false) continue

    const attachment = slot.getAttachment?.() as any
    const vertexCount = attachment?.worldVerticesLength ?? 0

    if (vertexCount > 0 && typeof attachment.computeWorldVertices === 'function') {
      const worldVertices = new Float32Array(vertexCount)
      attachment.computeWorldVertices(slot, 0, vertexCount, worldVertices, 0, 2)
      if (isPointInPolygon(wx, wy, worldVertices)) {
        if (store.selectedLayerName !== slot.data.name) {
          store.selectedLayerName = slot.data.name
        } else {
          store.selectedLayerName = null
        }
        return
      }
    }
  }
  store.selectedLayerName = null
}

function drawOverlay() {
  const canvas = overlayCanvas.value
  if (!canvas || !viewerWrapper.value || !player) return

  const rect = viewerWrapper.value.getBoundingClientRect()
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width
    canvas.height = rect.height
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const selectedLayer = store.selectedLayerName
  if (!selectedLayer || !store.layerSelectionEnabled) return

  const skeleton = player.skeleton
  if (!skeleton) return
  
  const slots = skeleton.slots as unknown as SpineSlot[]
  const slot = slots.find(s => s.data.name === selectedLayer)
  if (!slot || store.layerVisibility[selectedLayer] === false) return

  const attachment = slot.getAttachment?.() as any
  const vertexCount = attachment?.worldVerticesLength ?? 0
  if (vertexCount > 0 && typeof attachment.computeWorldVertices === 'function') {
    const worldVertices = new Float32Array(vertexCount)
    attachment.computeWorldVertices(slot, 0, vertexCount, worldVertices, 0, 2)

    const camState = getCameraState()
    if (!camState) return
    const { cx, cy, zoom, vw, vh } = camState

    ctx.beginPath()
    for (let i = 0; i < worldVertices.length; i += 2) {
       const wx = worldVertices[i]
       const wy = worldVertices[i+1]
       
       const nx = ((wx - cx) / zoom) / (vw / 2)
       const ny = ((wy - cy) / zoom) / (vh / 2)

       const screenX = (nx + 1) * 0.5 * canvas.width
       const screenY = (1 - (ny + 1) * 0.5) * canvas.height

       if (i === 0) ctx.moveTo(screenX, screenY)
       else ctx.lineTo(screenX, screenY)
    }
    ctx.closePath()
    ctx.strokeStyle = '#818cf8' // indigo-400
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.fillStyle = 'rgba(79, 70, 229, 0.4)' // indigo-600 with opacity
    ctx.fill()
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const key = e.key.toLowerCase()

  if (key === 'h') {
    if (store.selectedLayerName) {
      store.layerVisibility[store.selectedLayerName] = false
      store.hiddenLayerStack.push(store.selectedLayerName)
      store.selectedLayerName = null
    }
  } else if (key === 'u') {
    if (store.hiddenLayerStack.length > 0) {
      const last = store.hiddenLayerStack.pop()!
      store.layerVisibility[last] = true
      store.selectedLayerName = last
    }
  } else if (e.key === 'Escape') {
    while (store.hiddenLayerStack.length > 0) {
      const last = store.hiddenLayerStack.pop()!
      store.layerVisibility[last] = true
    }
    store.selectedLayerName = null
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  ensureResizeObserver()
  if (activeBackgroundSrc.value) {
    setBackgroundSource(activeBackgroundSrc.value)
  }
  void load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  stopPointerTracking()
  if (resizeObserver && viewerWrapper.value) {
    resizeObserver.unobserve(viewerWrapper.value)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
})

function seek() {
  if (!player) return
  const trackIndex = getActiveTrackIndexForSelectedAnimation(player.animationState)
  const entry = player.animationState?.getCurrent(trackIndex)
  if (entry && entry.animation && player.skeleton) {
    const newTime = entry.animationEnd * progress.value
    entry.trackTime = newTime
    entry.nextTrackLast = newTime
    player.animationState!.apply(player.skeleton)
    player.skeleton.updateWorldTransform()
    ;(player as unknown as SpinePlayerInternal).drawFrame(false)
  }
}

function resetCamera() {
  if (!manualCamera) return
  manualCamera.position.x = defaultCameraPos.x
  manualCamera.position.y = defaultCameraPos.y
  manualCamera.zoom = defaultZoom
  manualCamera.update()
}
function saveScreenshot(transparent: boolean) {
  if (!player || !manualCamera) return

  const canvas = player.canvas!
  const animationName = store.selectedAnimation
  const cam = manualCamera
  const prevPos = new Vector2(cam.position.x, cam.position.y)
  const prevZoom = cam.zoom
  const prevWidth = canvas.width
  const prevHeight = canvas.height
  const prevStyleWidth = canvas.style.width
  const prevStyleHeight = canvas.style.height

  const prevViewportWidth = player.sceneRenderer!.camera.viewportWidth
  const gl = (player as unknown as SpinePlayerInternal).context.gl
  const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  const captureSize = Math.min(3000, maxTexSize)
  if (!store.useCurrentCamera) {
    cam.position.x = defaultCameraPos.x
    cam.position.y = defaultCameraPos.y
    const paddedWidth = size.x
    const paddedHeight = size.y + 100
    cam.zoom = Math.max(paddedWidth / captureSize, paddedHeight / captureSize)
    cam.update()
  } else {
    cam.zoom = (prevViewportWidth * prevZoom) / captureSize
    cam.update()
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = captureSize
  canvas.height = captureSize
  canvas.style.width = `${captureSize / dpr}px`
  canvas.style.height = `${captureSize / dpr}px`

  applyPlayerBackgroundTransparency()
  ;(player as unknown as SpinePlayerInternal).drawFrame(false)
  requestAnimationFrame(() => {
    const url = getCompositeDataURL(canvas, transparent)
    canvas.width = prevWidth
    canvas.height = prevHeight
    canvas.style.width = prevStyleWidth
    canvas.style.height = prevStyleHeight

    if (!store.useCurrentCamera) {
      cam.position.x = prevPos.x
      cam.position.y = prevPos.y
      cam.zoom = prevZoom
      cam.update()
    } else {
      cam.zoom = prevZoom
      cam.update()
    }
    applyPlayerBackgroundTransparency()
    ;(player as unknown as SpinePlayerInternal).drawFrame(false)

    const a = document.createElement('a')
    a.href = url
    a.download = `screenshot_${store.selectedCharacterId}_${animationName}.png`
    a.click()
  })
}

function exportAnimation(transparent: boolean): Promise<void> {
  const p = player
  const cam = manualCamera
  if (!p || !cam) return Promise.resolve()

  cancelExport = false

  const canvas = p.canvas!
  const animationName = store.selectedAnimation
  const fps = 60

  return new Promise(resolve => {
    applyPlayerBackgroundTransparency(p)

    const prevPos = new Vector2(cam.position.x, cam.position.y)
    const prevZoom = cam.zoom
    const state = p.animationState
    const skeleton = p.skeleton

    if (!store.useCurrentCamera) {
      cam.position.x = defaultCameraPos.x
      cam.position.y = defaultCameraPos.y
      const paddedWidth = size.x
      const paddedHeight = size.y + 100
      cam.zoom = Math.max(
        paddedWidth / canvas.width,
        paddedHeight / canvas.height,
      )
      cam.update()
    }
    const mimeType = 'video/webm'
    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = canvas.width
    compositeCanvas.height = canvas.height
    const compositeCtx = compositeCanvas.getContext('2d')
    if (compositeFrameHandle) {
      cancelAnimationFrame(compositeFrameHandle)
      compositeFrameHandle = null
    }
    const stream = compositeCtx ? compositeCanvas.captureStream(fps) : canvas.captureStream(fps)
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 10_000_000,
    })

    const chunks: BlobPart[] = []
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const wasPlaying = store.playing

    recorder.onstop = () => {
      if (!cancelExport) {
        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `animation_${store.selectedCharacterId}_${animationName}.webm`
        a.click()
        URL.revokeObjectURL(url)
      }
      applyPlayerBackgroundTransparency(p)
      if (compositeFrameHandle) {
        cancelAnimationFrame(compositeFrameHandle)
        compositeFrameHandle = null
      }
      if (!wasPlaying) p.pause()
      if (!store.useCurrentCamera) {
        cam.position.x = prevPos.x
        cam.position.y = prevPos.y
        cam.zoom = prevZoom
        cam.update()
      }
      recorder = null
      cancelExport = false
      resolve()
    }

    const animName = store.selectedAnimation
    let duration = 3
    if (animName && state) {
      const anim = state.data.skeletonData.animations.find(
        (a: Animation) => a.name === animName,
      )
      if (anim) duration = anim.duration
      state.clearTrack(0)
      state.clearTrack(1)
      setSpineAnimation(p, animName, { loop: true, forceNoMix: true })
      if (skeleton) {
        state.apply(skeleton)
        skeleton.updateWorldTransform()
        ;(p as unknown as SpinePlayerInternal).drawFrame(false)
      }
    }

    const recordDuration = duration / (p.speed || store.animationSpeed || 1)

    p.play()
    if (compositeCtx) {
      drawCompositeFrame(compositeCtx, compositeCanvas.width, compositeCanvas.height, canvas, transparent)
      recorder.onstart = () => {
        const renderComposite = () => {
          if (!recorder || recorder.state !== 'recording') return
          if (compositeCanvas.width !== canvas.width || compositeCanvas.height !== canvas.height) {
            compositeCanvas.width = canvas.width
            compositeCanvas.height = canvas.height
          }
          drawCompositeFrame(compositeCtx, compositeCanvas.width, compositeCanvas.height, canvas, transparent)
          compositeFrameHandle = requestAnimationFrame(renderComposite)
        }
        compositeFrameHandle = requestAnimationFrame(renderComposite)
      }
    }
    recorder.start()

    setTimeout(() => {
      if (recorder && recorder.state === 'recording') {
        recorder.stop()
      }
    }, recordDuration * 1000)
  })
}

function exportAnimationFrames(transparent: boolean): Promise<void> {
  const p = player
  const cam = manualCamera
  if (!p || !cam) return Promise.resolve()

  cancelExport = false
  exportingFrames = true

  const canvas = p.canvas!
  const animationName = store.selectedAnimation
  const fps = 60

  return new Promise(resolve => {
    applyPlayerBackgroundTransparency(p)

    const prevPos = new Vector2(cam.position.x, cam.position.y)
    const prevZoom = cam.zoom

    if (!store.useCurrentCamera) {
      cam.position.x = defaultCameraPos.x
      cam.position.y = defaultCameraPos.y
      const paddedWidth = size.x
      const paddedHeight = size.y + 100
      cam.zoom = Math.max(
        paddedWidth / canvas.width,
        paddedHeight / canvas.height,
      )
      cam.update()
    }

    const animName = store.selectedAnimation
    let duration = 3
    const state = p.animationState
    const skeleton = p.skeleton
    if (animName && state) {
      const anim = state.data.skeletonData.animations.find(
        (a: Animation) => a.name === animName,
      )
      if (anim) duration = anim.duration
      state.clearTrack(0)
      state.clearTrack(1)
      setSpineAnimation(p, animName, { loop: false, forceNoMix: true })
      if (skeleton) {
        state.apply(skeleton)
        skeleton.updateWorldTransform()
      }
    }

    const speed = p.speed || store.animationSpeed || 1
    const totalFrames = Math.ceil((duration / speed) * fps)
    const zip = new JSZip()
    const wasPlaying = store.playing
    p.pause()
    store.playing = false

    let frame = 0
    const capture = () => {
      if (cancelExport) {
        exportingFrames = false
        applyPlayerBackgroundTransparency(p)
        if (!store.useCurrentCamera) {
          cam.position.x = prevPos.x
          cam.position.y = prevPos.y
          cam.zoom = prevZoom
          cam.update()
        }
        cancelExport = false
        resolve()
        return
      }

      ;(p as unknown as SpinePlayerInternal).drawFrame(false)
      const url = getCompositeDataURL(canvas, transparent)
      zip.file(`frame_${String(frame).padStart(4, '0')}.png`, url.split(',')[1], { base64: true })
      frame++
      if (frame < totalFrames) {
        p.animationState?.update((1 / fps) * speed)
        p.animationState?.apply(p.skeleton!)
        p.skeleton!.updateWorldTransform()
        requestAnimationFrame(capture)
      } else {
        exportingFrames = false
        applyPlayerBackgroundTransparency(p)
        if (!store.useCurrentCamera) {
          cam.position.x = prevPos.x
          cam.position.y = prevPos.y
          cam.zoom = prevZoom
          cam.update()
        }
        if (animName) {
          setSpineAnimation(p, animName, { loop: true })
        }
        p.animationState?.apply(p.skeleton!)
        p.skeleton!.updateWorldTransform()
        if (wasPlaying) {
          p.play()
          store.playing = true
        } else {
          p.pause()
          store.playing = false
        }
        zip.generateAsync({ type: 'blob' }).then((blob: Blob) => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `animation_${store.selectedCharacterId}_${animationName}_frames.zip`
          a.click()
          URL.revokeObjectURL(url)
          cancelExport = false
          resolve()
        })
      }
    }
    capture()
  })
}

defineExpose({ resetCamera, saveScreenshot, exportAnimation, exportAnimationFrames })
</script>
<style scoped>
.seek-range {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}
.seek-range:disabled {
  pointer-events: none;
}
.seek-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  border: 1px solid #6b7280;
}
.seek-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  border: 1px solid #6b7280;
}

.bg-editable {
  position: absolute;
  user-select: none;
  touch-action: none;
  transition: outline-color 0.2s ease;
  z-index: 30;
}
.bg-editable--editing {
  outline: 1px dashed rgba(229, 231, 235, 0.7);
  cursor: grab;
}
.bg-editable--dragging {
  cursor: grabbing;
}
.bg-image-wrapper {
  position: absolute;
  z-index: 0;
}
.bg-resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(55, 65, 81, 0.9);
  box-sizing: border-box;
  z-index: 2;
  pointer-events: auto;
}
.bg-resize-handle--n {
  top: -6px;
  left: 50%;
  transform: translate(-50%, -50%);
  cursor: ns-resize;
}
.bg-resize-handle--s {
  bottom: -6px;
  left: 50%;
  transform: translate(-50%, 50%);
  cursor: ns-resize;
}
.bg-resize-handle--e {
  right: -6px;
  top: 50%;
  transform: translate(50%, -50%);
  cursor: ew-resize;
}
.bg-resize-handle--w {
  left: -6px;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: ew-resize;
}
.bg-resize-handle--ne {
  top: -6px;
  right: -6px;
  transform: translate(50%, -50%);
  cursor: nesw-resize;
}
.bg-resize-handle--nw {
  top: -6px;
  left: -6px;
  transform: translate(-50%, -50%);
  cursor: nwse-resize;
}
.bg-resize-handle--se {
  bottom: -6px;
  right: -6px;
  transform: translate(50%, 50%);
  cursor: nwse-resize;
}
.bg-resize-handle--sw {
  bottom: -6px;
  left: -6px;
  transform: translate(-50%, 50%);
  cursor: nesw-resize;
}
</style>
