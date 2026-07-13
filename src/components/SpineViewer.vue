<template>
  <div class="relative w-full h-full">
    <div
      ref="toolbarRef"
      class="absolute left-2 flex flex-col gap-2 pointer-events-auto transition-opacity duration-150"
      :class="[
        showingMobileOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100 z-40',
        inspectMode ? 'top-2' : 'top-16 lg:top-2',
      ]"
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
          type="button"
          aria-label="Inspect animation"
          :aria-pressed="inspectMode"
          @click="emit('update:inspectMode', !inspectMode)"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
          :class="{ 'bg-indigo-600/90 hover:bg-indigo-500': inspectMode }"
        >
          <InspectAnimationIcon :active="inspectMode" />
        </button>
        <button
          @click="store.layerSelectionEnabled = !store.layerSelectionEnabled"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
        >
          <LayerSelectIcon :active="store.layerSelectionEnabled" />
        </button>
        <button
          aria-label="Zoom out"
          @click="zoomOut"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
        >
          <MinusIcon />
        </button>
        <button
          aria-label="Zoom in"
          @click="zoomIn"
          class="w-8 h-8 p-1.5 rounded-md hidden lg:flex items-center justify-center bg-gray-800/70 hover:bg-gray-700/70 text-white transition-colors"
        >
          <PlusIcon />
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
  CameraController,
  OrthoCamera,
  GLTexture,
  AnimationState,
  AnimationStateData,
  AssetManager,
  AtlasAttachmentLoader,
  Skeleton,
  SkeletonBinary,
  TrackEntry,
  type VertexAttachment,
  type SkeletonData,
  type Skeleton as SpineSkeleton,
} from '@esotericsoftware/spine-player'
import JSZip from 'jszip'

import type { Animation, SceneRenderer, Slot } from '@esotericsoftware/spine-player'
import type { SpinePlayerInternal } from '@/types/spine-player-internal'
import cutsceneComposites, {
  type CutsceneAnim,
  type CutsceneComposite,
  type CutsceneCompositeDefinition,
  type CutsceneCompositeEntry,
} from '@/utils/cutscene_mappings'

import BgEditIcon from '@/components/icons/BgEditIcon.vue'
import InspectAnimationIcon from '@/components/icons/InspectAnimationIcon.vue'
import LayerSelectIcon from '@/components/icons/LayerSelectIcon.vue'
import MinusIcon from '@/components/icons/MinusIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
type CompositeSegment = {
  track: number
  start: number
  duration: number
  name: string
  additive: boolean
  source: string | null
  skin?: string
  hold?: boolean
  loop?: boolean
  holdUntil?: number
}
type CompiledComposite =
  | { kind: 'animation'; spec: CutsceneAnim }
  | { kind: 'sequence'; children: CompiledComposite[] }
  | { kind: 'parallel'; children: CompiledComposite[] }
type ResolvedCutsceneComposite = { name: string; mapping: CutsceneComposite }
type CompositeOverlayInstance = {
  trackIndex: number
  skeleton: SpineSkeleton
  state: AnimationState
  segments: CompositeSegment[]
  source: string | null
}
type ExternalSkeletonAsset = {
  source: string
  skeletonData: SkeletonData
  assetManager: AssetManager
}
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
const backgroundImageWrapperRef = ref<HTMLDivElement | null>(null)
const backgroundOverlayRef = ref<HTMLDivElement | null>(null)
const backgroundImageEl = ref<HTMLImageElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)

const progress = ref(0)
const store = useCharacterStore()

const props = defineProps<{ mobileOverlayActive?: boolean; inspectMode?: boolean }>()
const showingMobileOverlay = computed(() => props.mobileOverlayActive ?? false)
const inspectMode = computed(() => props.inspectMode ?? false)

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
let overlayInstances: CompositeOverlayInstance[] = []
let overlayRenderHandle: number | null = null
let overlayLastTimestamp: number | null = null
let forceTransparentClear = false
let pausedCompositeRenderPending = false
let detachCameraListeners: (() => void) | null = null
let externalSkeletonCache = new Map<string, Promise<ExternalSkeletonAsset>>()
const MIN_ZOOM_FACTOR = 0.08
const MAX_ZOOM_FACTOR = 4
const ZOOM_STEP_FACTOR = 1.2

let offset = new Vector2()
let size = new Vector2()

const DEFAULT_COMPOSITE_NAME = 'all'
const resolvedCompositeCache = new WeakMap<CutsceneComposite, CompiledComposite>()
let compositeActive = false
let compositeDuration = 0
let compositeElapsed = 0
let compositeLastTimestamp: number | null = null
let compositeSchedule: CompositeSegment[] = []
let compositeMapping: CompiledComposite | null = null
let compositeCharId: string | null = null
let compositeRestarting = false
let compositeStartToken = 0
let exportingAnimation = false
let compositeLayerNames = new Set<string>()

const glTexturePatchedKey = '__bd2PremultipliedPatchApplied'
const glTextureOriginalKey = '__bd2PremultipliedPatchOriginal'
const layerSourceSeparator = ' > '
type PatchedGLTexturePrototype = typeof GLTexture.prototype & {
  [glTexturePatchedKey]?: boolean
  [glTextureOriginalKey]?: (useMipMaps: boolean) => void
}

function ensureGLTexturePremultiplyPatch() {
  const proto = GLTexture.prototype as PatchedGLTexturePrototype
  if (proto[glTexturePatchedKey]) return
  const originalUpdate = proto.update
  proto[glTextureOriginalKey] = originalUpdate
  proto.update = function (useMipMaps: boolean) {
    const gl = this.context.gl
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    originalUpdate.call(this, useMipMaps)
  }
  proto[glTexturePatchedKey] = true
}

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

function getTracksEndDuration(state: AnimationState | null | undefined) {
  if (!state || !state.tracks?.length) return 0
  let maxEnd = 0
  const tracks = state.tracks as Array<TrackEntry | null>
  tracks.forEach(track => {
    if (!track || !track.animation) return
    const end = typeof track.trackEnd === 'number' ? track.trackEnd : track.animation.duration || 0
    if (end > maxEnd) maxEnd = end
  })
  return maxEnd
}

function stopOverlayRendering() {
  if (overlayRenderHandle !== null) {
    cancelAnimationFrame(overlayRenderHandle)
    overlayRenderHandle = null
  }
  overlayLastTimestamp = null
}

function disposeOverlays() {
  overlayInstances = []
}

function removeCompositeLayerNames() {
  if (compositeLayerNames.size === 0) return
  const namesToRemove = compositeLayerNames
  store.layerNames = store.layerNames.filter(name => !namesToRemove.has(name))
  for (const name of namesToRemove) {
    delete store.layerVisibility[name]
    previousLayerVisibility.delete(name)
  }
  store.hiddenLayerStack = store.hiddenLayerStack.filter(name => !namesToRemove.has(name))
  if (store.selectedLayerName && namesToRemove.has(store.selectedLayerName)) {
    store.selectedLayerName = null
  }
  compositeLayerNames = new Set()
}

function clearExternalSkeletonCache() {
  for (const assetPromise of externalSkeletonCache.values()) {
    assetPromise
      .then(asset => asset.assetManager.dispose())
      .catch(() => {})
  }
  externalSkeletonCache = new Map()
}

function resetComposite() {
  compositeStartToken++
  compositeActive = false
  compositeDuration = 0
  compositeElapsed = 0
  compositeLastTimestamp = null
  compositeSchedule = []
  compositeMapping = null
  compositeCharId = null
  compositeRestarting = false
  stopOverlayRendering()
  disposeOverlays()
  removeCompositeLayerNames()
}

function isCompositeDefinition(value: unknown): value is CutsceneCompositeDefinition {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('composite' in value || 'animations' in value)
  )
}

function resolveCompositeDefinition(definition: CutsceneCompositeDefinition): ResolvedCutsceneComposite | null {
  const mapping = definition.composite ?? definition.animations
  if (!Array.isArray(mapping)) return null
  return {
    name: definition.name || DEFAULT_COMPOSITE_NAME,
    mapping,
  }
}

function normalizeCompositeDefinitions(entry: CutsceneCompositeEntry | undefined): ResolvedCutsceneComposite[] {
  if (!entry) return []
  if (Array.isArray(entry)) {
    if (entry.length > 0 && entry.every(isCompositeDefinition)) {
      return entry
        .map(definition => resolveCompositeDefinition(definition))
        .filter((definition): definition is ResolvedCutsceneComposite => !!definition)
    }
    return [{ name: DEFAULT_COMPOSITE_NAME, mapping: entry as CutsceneComposite }]
  }
  const resolved = resolveCompositeDefinition(entry)
  return resolved ? [resolved] : []
}

function getCompositesForCurrent(): ResolvedCutsceneComposite[] {
  if (store.animationCategory !== 'ultimate') return []
  return normalizeCompositeDefinitions(cutsceneComposites[store.selectedCharacterId])
}

function compileCompositeSpec(
  spec: CutsceneAnim,
  definitions: Map<string, ResolvedCutsceneComposite>,
  ancestors: string[],
): CompiledComposite {
  const nested = typeof spec === 'string' ? definitions.get(spec) : undefined
  return nested
    ? compileComposite(nested, definitions, ancestors)
    : { kind: 'animation', spec }
}

function compileComposite(
  definition: ResolvedCutsceneComposite,
  definitions: Map<string, ResolvedCutsceneComposite>,
  ancestors: string[] = [],
): CompiledComposite {
  const cached = resolvedCompositeCache.get(definition.mapping)
  if (cached) return cached
  if (ancestors.includes(definition.name)) {
    throw new Error(`Circular composite reference: ${[...ancestors, definition.name].join(' -> ')}`)
  }

  const nextAncestors = [...ancestors, definition.name]
  const compiled: CompiledComposite = {
    kind: 'sequence',
    children: definition.mapping.map(phase =>
      Array.isArray(phase)
        ? {
            kind: 'parallel',
            children: phase.map(spec => compileCompositeSpec(spec, definitions, nextAncestors)),
          }
        : compileCompositeSpec(phase, definitions, nextAncestors),
    ),
  }

  resolvedCompositeCache.set(definition.mapping, compiled)
  return compiled
}

function getCompositeForAnimation(animationName: string | null | undefined): CompiledComposite | null {
  if (!animationName) return null
  const definitions = getCompositesForCurrent()
  const selected = definitions.find(definition => definition.name === animationName)
  if (!selected) return null
  const definitionsByName = new Map<string, ResolvedCutsceneComposite>()
  definitions.forEach(definition => {
    if (!definitionsByName.has(definition.name)) definitionsByName.set(definition.name, definition)
  })
  return compileComposite(selected, definitionsByName)
}

function compositeHasParallel(mapping: CompiledComposite): boolean {
  return mapping.kind === 'parallel' || (
    mapping.kind === 'sequence' && mapping.children.some(compositeHasParallel)
  )
}

function getAnimDuration(state: AnimationState | null | undefined, name: string) {
  const anim = state?.data.skeletonData.animations.find((animation: Animation) => animation.name === name)
  return anim?.duration ?? 0
}

function getSkeletonAnimDuration(skeletonData: SkeletonData | undefined, name: string) {
  const anim = skeletonData?.animations.find((animation: Animation) => animation.name === name)
  return anim?.duration ?? 0
}

function getAnimSpecName(spec: CutsceneAnim) {
  return typeof spec === 'string' ? spec : spec.name
}

function getAnimSpecOffset(spec: CutsceneAnim) {
  return typeof spec === 'string' ? 0 : spec.offset ?? 0
}

function normalizeCompositeSource(source: string | null | undefined) {
  if (!source) return null
  const normalized = source.trim().replace(/\\/g, '/').replace(/\.(skel|atlas|json)$/i, '')
  return normalized || null
}

function getAnimSpecSource(spec: CutsceneAnim) {
  return typeof spec === 'string' ? null : normalizeCompositeSource(spec.source)
}

function getAnimSpecSkin(spec: CutsceneAnim) {
  return typeof spec === 'string' ? undefined : spec.skin
}

function getAnimSpecHold(spec: CutsceneAnim) {
  return typeof spec === 'string' ? false : spec.hold === true
}

function getAnimSpecLoop(spec: CutsceneAnim) {
  return typeof spec === 'string' ? false : spec.loop === true
}

function getAnimSpecPlayDuration(spec: CutsceneAnim, nativeDuration: number) {
  if (typeof spec === 'string') return nativeDuration
  const requestedDuration = spec.playDuration
  if (typeof requestedDuration !== 'number' || !Number.isFinite(requestedDuration) || requestedDuration <= 0) {
    return nativeDuration
  }
  return Math.min(requestedDuration, nativeDuration)
}

function getAnimSpecLayerOrder(spec: CutsceneAnim) {
  if (typeof spec === 'string') return 0
  return typeof spec.layerOrder === 'number' && Number.isFinite(spec.layerOrder)
    ? spec.layerOrder
    : 0
}

function getSpineAssetRoot() {
  return import.meta.env.DEV
    ? 'src/assets/spines'
    : import.meta.env.VITE_SPINE_ASSET_ROOT || 'assets/spines'
}

function getScopedLayerName(source: string | null, slotName: string) {
  return source ? `${source}${layerSourceSeparator}${slotName}` : slotName
}

function getSlotNameForLayerKey(layerName: string, source: string | null) {
  if (!source) return layerName.includes(layerSourceSeparator) ? null : layerName
  const prefix = `${source}${layerSourceSeparator}`
  return layerName.startsWith(prefix) ? layerName.slice(prefix.length) : null
}

function registerLayerNames(names: string[], compositeLayer = false) {
  const existing = new Set(store.layerNames)
  let changed = false
  const nextLayerNames = [...store.layerNames]
  names.forEach(name => {
    if (!name || existing.has(name)) return
    existing.add(name)
    nextLayerNames.push(name)
    store.layerVisibility[name] = true
    previousLayerVisibility.set(name, true)
    if (compositeLayer) compositeLayerNames.add(name)
    changed = true
  })
  if (changed) {
    store.layerNames = nextLayerNames
  }
}

function registerExternalLayerNames(externalAssets: Map<string, ExternalSkeletonAsset>) {
  externalAssets.forEach(asset => {
    registerLayerNames(
      asset.skeletonData.slots.map(slot => getScopedLayerName(asset.source, slot.name)),
      true,
    )
  })
}

function resolveExternalSkeletonBasePath(source: string) {
  if (/^(?:https?:)?\/\//.test(source) || source.startsWith('/') || source.startsWith('src/') || source.startsWith('assets/')) {
    return source
  }
  return `${getSpineAssetRoot()}/${store.selectedCharacterId}/${source}`
}

function collectCompositeSources(mapping: CompiledComposite) {
  const sources = new Set<string>()
  const collect = (node: CompiledComposite) => {
    if (node.kind === 'animation') {
      const source = getAnimSpecSource(node.spec)
      if (source) sources.add(source)
      return
    }
    node.children.forEach(collect)
  }
  collect(mapping)
  return sources
}

async function getExternalSkeletonAsset(source: string): Promise<ExternalSkeletonAsset> {
  const normalized = normalizeCompositeSource(source)
  if (!normalized) throw new Error('Composite source cannot be empty.')
  const cached = externalSkeletonCache.get(normalized)
  if (cached) return cached

  const assetPromise = (async () => {
    if (!player?.context) throw new Error('Spine player is not ready.')
    const basePath = resolveExternalSkeletonBasePath(normalized)
    const binaryUrl = `${basePath}.skel`
    const atlasUrl = `${basePath}.atlas`
    const assetManager = new AssetManager(player.context, '')
    assetManager.loadBinary(binaryUrl)
    assetManager.loadTextureAtlas(atlasUrl)
    await assetManager.loadAll()

    const atlas = assetManager.require(atlasUrl)
    const binaryData = assetManager.require(binaryUrl)
    const binary = new SkeletonBinary(new AtlasAttachmentLoader(atlas))
    const skeletonData = binary.readSkeletonData(binaryData)
    return { source: normalized, skeletonData, assetManager }
  })()

  externalSkeletonCache.set(normalized, assetPromise)
  return assetPromise
}

async function loadCompositeExternalAssets(mapping: CompiledComposite) {
  const assets = new Map<string, ExternalSkeletonAsset>()
  await Promise.all(
    Array.from(collectCompositeSources(mapping)).map(async source => {
      assets.set(source, await getExternalSkeletonAsset(source))
    }),
  )
  return assets
}

function getCompositeSegmentDuration(
  state: AnimationState | null | undefined,
  externalAssets: Map<string, ExternalSkeletonAsset>,
  name: string,
  source: string | null,
) {
  if (!source) return getAnimDuration(state, name)
  return getSkeletonAnimDuration(externalAssets.get(source)?.skeletonData, name)
}

function buildCompositeScheduleNode(
  node: CompiledComposite,
  state: AnimationState | null | undefined,
  externalAssets: Map<string, ExternalSkeletonAsset>,
  start: number,
  track: number,
  insideParallel = false,
): { schedule: CompositeSegment[]; duration: number; trackCount: number } {
  if (node.kind === 'animation') {
    const name = getAnimSpecName(node.spec)
    const offsetValue = getAnimSpecOffset(node.spec)
    const source = getAnimSpecSource(node.spec)
    const skin = getAnimSpecSkin(node.spec)
    const hold = getAnimSpecHold(node.spec)
    const loop = getAnimSpecLoop(node.spec)
    const nativeDuration = getCompositeSegmentDuration(state, externalAssets, name, source)
    const duration = getAnimSpecPlayDuration(node.spec, nativeDuration)
    return {
      schedule: [{ track, start: start + offsetValue, duration, name, additive: insideParallel, source, skin, hold, loop }],
      duration: Math.max(duration + offsetValue, 0),
      trackCount: 1,
    }
  }

  if (node.kind === 'sequence') {
    const schedule: CompositeSegment[] = []
    let elapsed = 0
    let trackCount = 1
    node.children.forEach(child => {
      const result = buildCompositeScheduleNode(
        child,
        state,
        externalAssets,
        start + elapsed,
        track,
        insideParallel,
      )
      schedule.push(...result.schedule)
      elapsed += result.duration
      trackCount = Math.max(trackCount, result.trackCount)
    })
    return { schedule, duration: elapsed, trackCount }
  }

  const orderedChildren = node.children
    .map((child, index) => ({ child, index }))
    .sort((a, b) => {
      const aOrder = a.child.kind === 'animation' ? getAnimSpecLayerOrder(a.child.spec) : 0
      const bOrder = b.child.kind === 'animation' ? getAnimSpecLayerOrder(b.child.spec) : 0
      return aOrder - bOrder || a.index - b.index
    })
  const branches: Array<{ node: CompiledComposite; result: ReturnType<typeof buildCompositeScheduleNode> }> = []
  let nextTrack = track
  let duration = 0
  orderedChildren.forEach(({ child }) => {
    const result = buildCompositeScheduleNode(child, state, externalAssets, start, nextTrack, true)
    branches.push({ node: child, result })
    duration = Math.max(duration, result.duration)
    nextTrack += Math.max(result.trackCount, 1)
  })
  const phaseEnd = start + duration
  const schedule = branches.flatMap(branch => {
    if (
      branch.node.kind !== 'animation' ||
      (!getAnimSpecHold(branch.node.spec) && !getAnimSpecLoop(branch.node.spec))
    ) {
      return branch.result.schedule
    }
    return branch.result.schedule.map(segment => ({ ...segment, holdUntil: phaseEnd }))
  })
  return { schedule, duration, trackCount: Math.max(nextTrack - track, 1) }
}

function buildCompositeSchedule(
  mapping: CompiledComposite,
  state: AnimationState | null | undefined,
  externalAssets = new Map<string, ExternalSkeletonAsset>(),
) {
  const { schedule, duration } = buildCompositeScheduleNode(mapping, state, externalAssets, 0, 0)
  return { schedule, duration }
}

function getCompositeSegmentEnd(segment: CompositeSegment, includeHold = true) {
  return includeHold && typeof segment.holdUntil === 'number'
    ? segment.holdUntil
    : segment.start + segment.duration
}

async function scheduleCompositeTimeline(p: SpinePlayer, mapping: CompiledComposite, seekToSeconds = 0) {
  const state = p.animationState
  const skeleton = p.skeleton
  if (!state || !skeleton) return { schedule: [], duration: 0, time: 0, externalAssets: new Map<string, ExternalSkeletonAsset>() }

  const externalAssets = await loadCompositeExternalAssets(mapping)
  const { schedule, duration } = buildCompositeSchedule(mapping, state, externalAssets)
  const time = duration > 0 ? ((seekToSeconds % duration) + duration) % duration : 0

  return { schedule, duration, time, externalAssets }
}

function applySegmentsToState(
  state: AnimationState,
  skeleton: SpineSkeleton,
  segments: CompositeSegment[],
  time: number,
  hideWhenOutOfRange = false,
) {
  state.clearTracks()
  skeleton.setToSetupPose()
  skeleton.setSlotsToSetupPose()
  skeleton.updateWorldTransform()
  if (!segments.length) return

  segments.sort((a, b) => a.start - b.start)
  const first = segments[0]
  const end = segments.reduce((max, segment) => Math.max(max, getCompositeSegmentEnd(segment)), 0)
  const EPS = 1e-4
  if (hideWhenOutOfRange && (time < first.start - EPS || time > end + EPS)) {
    return
  }

  let currentIndex = segments.findIndex(segment => getCompositeSegmentEnd(segment) > time)
  if (currentIndex === -1) currentIndex = segments.length - 1
  const current = segments[currentIndex]
  if (hideWhenOutOfRange && time < current.start - EPS) {
    return
  }
  const elapsed = Math.max(0, time - current.start)
  const currentTime = current.loop ? elapsed : Math.min(current.duration, elapsed)
  const entry = state.setAnimation(0, current.name, current.loop)
  if (entry) {
    entry.mixDuration = 0
    entry.mixTime = 0
    entry.animationEnd = current.duration
    entry.trackTime = currentTime
    entry.trackLast = currentTime
    entry.nextTrackLast = currentTime
  }

  let previous = current
  for (let i = currentIndex + 1; i < segments.length; i++) {
    const segment = segments[i]
    const delay = Math.max(Number.EPSILON, segment.start - previous.start)
    const nextEntry = state.addAnimation(0, segment.name, segment.loop, delay)
    if (nextEntry) {
      nextEntry.mixDuration = 0
      nextEntry.mixTime = 0
      nextEntry.animationEnd = segment.duration
    }
    previous = segment
  }

  state.apply(skeleton)
  skeleton.updateWorldTransform()
}

function overlayActiveAt(segments: CompositeSegment[], time: number): boolean {
  const EPS = 1e-4
  const first = segments[0]
  const end = segments.reduce((max, segment) => Math.max(max, getCompositeSegmentEnd(segment)), 0)
  return !(time < first.start - EPS || time > end + EPS)
}

function createOverlayInstance(
  trackIndex: number,
  segments: CompositeSegment[],
  baseSkeleton: SpineSkeleton,
  baseState: AnimationState,
  time: number,
  source: string | null,
  externalAsset?: ExternalSkeletonAsset,
) {
  const skeletonData = externalAsset?.skeletonData ?? baseSkeleton.data
  const skeleton = new Skeleton(skeletonData)
  skeleton.scaleX = baseSkeleton.scaleX
  skeleton.scaleY = baseSkeleton.scaleY
  skeleton.x = baseSkeleton.x
  skeleton.y = baseSkeleton.y
  const skinName = segments.find(segment => segment.skin)?.skin
  if (skinName) {
    skeleton.setSkinByName(skinName)
    skeleton.setSlotsToSetupPose()
  } else if (!externalAsset && baseSkeleton.skin) {
    skeleton.setSkin(baseSkeleton.skin)
    skeleton.setSlotsToSetupPose()
  }
  const stateData = new AnimationStateData(externalAsset?.skeletonData ?? baseState.data.skeletonData)
  const state = new AnimationState(stateData)
  applySegmentsToState(state, skeleton, segments, time, true)
  return { trackIndex, skeleton, state, segments, source }
}

function clearRendererBackground(renderer: SceneRenderer) {
  const gl = renderer.context?.gl as WebGLRenderingContext | WebGL2RenderingContext | undefined
  if (!gl) return
  const hex = normalizedBackgroundColor.value
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const transparentBg = forceTransparentClear || hasBackgroundImage.value
  gl.clearColor(r, g, b, transparentBg ? 0 : 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
}

function compositeTracksActive(p: SpinePlayer | null): boolean {
  const tracks = p?.animationState?.tracks as Array<{ animation?: Animation } | null> | undefined
  return !!tracks?.some(track => track && track.animation)
}

function compositeTracksFinished(p: SpinePlayer | null): boolean {
  if (compositeDuration > 0 && compositeSchedule.length > 0) {
    return compositeElapsed >= compositeDuration - 1e-3
  }
  if (compositeSchedule.some(segment => segment.source)) {
    return compositeDuration > 0 && compositeElapsed >= compositeDuration - 1e-3
  }
  const tracks = p?.animationState?.tracks as Array<TrackEntry | null> | undefined
  if (!tracks || !tracks.length) return true
  const EPS = 1e-3
  return tracks.every(track => {
    if (!track || !track.animation) return true
    const duration = track.animation.duration || 0
    const trackTime = track.trackTime || 0
    const end = typeof track.trackEnd === 'number' ? track.trackEnd : duration
    const targetEnd = end || duration
    return targetEnd > 0 ? trackTime >= targetEnd - EPS : true
  })
}

function compositeTracksReachedAnimEnd(p: SpinePlayer | null): boolean {
  if (compositeDuration > 0 && compositeSchedule.length > 0) {
    return compositeElapsed >= compositeDuration - 1e-3
  }
  if (compositeSchedule.some(segment => segment.source)) {
    return compositeDuration > 0 && compositeElapsed >= compositeDuration - 1e-3
  }
  const tracks = p?.animationState?.tracks as Array<TrackEntry | null> | undefined
  if (!tracks || !tracks.length) return true
  const EPS = 1e-3
  return tracks.every(track => {
    if (!track || !track.animation) return true
    const duration = track.animation.duration || 0
    const trackTime = track.trackTime || 0
    return duration > 0 ? trackTime >= duration - EPS : true
  })
}

function stopPlayerRenderLoop(p: SpinePlayer | null) {
  if (!p) return
  ;(p as unknown as { stopRequestAnimationFrame?: boolean }).stopRequestAnimationFrame = true
}

function startPlayerRenderLoop(p: SpinePlayer | null) {
  if (!p) return
  const internal = p as unknown as { stopRequestAnimationFrame?: boolean; drawFrame: (requestNextFrame?: boolean) => void }
  const wasStopped = internal.stopRequestAnimationFrame === true
  internal.stopRequestAnimationFrame = false
  internal.drawFrame(wasStopped)
}

function getPremultipliedAlpha(p: SpinePlayer | null) {
  if (!p) return true
  const internal = p as unknown as SpinePlayerInternal
  const value = (internal.config as { premultipliedAlpha?: boolean } | undefined)?.premultipliedAlpha
  return typeof value === 'boolean' ? value : true
}

function currentCompositeTime(p: SpinePlayer | null) {
  if (!p || !compositeSchedule.length) {
    return { time: compositeElapsed, hasTracks: false }
  }
  const tracks = p.animationState?.tracks as Array<{ animation?: Animation; trackTime?: number } | null> | undefined
  if (!tracks || !tracks.length) return { time: compositeElapsed, hasTracks: false }
  let maxTime = 0
  let hasTracks = false
  tracks.forEach((track, trackIndex) => {
    if (!track || !track.animation) return
    const segment = compositeSchedule.find(
      item =>
        !item.source &&
        item.track === trackIndex &&
        item.name === track.animation?.name &&
        (track.trackTime ?? 0) <= getCompositeSegmentEnd(item) - item.start + 0.01,
    )
    if (!segment) return
    hasTracks = true
    const scheduledDuration = getCompositeSegmentEnd(segment) - segment.start
    const trackTime = Math.max(0, Math.min(scheduledDuration, track.trackTime ?? 0))
    maxTime = Math.max(maxTime, segment.start + trackTime)
  })
  return { time: hasTracks ? maxTime : compositeElapsed, hasTracks }
}

function renderCompositeFrame(timestamp?: number) {
  if (!player || !player.skeleton || !player.animationState || !compositeActive) return
  const renderer = player.sceneRenderer
  if (!renderer) return
  const now = timestamp ?? performance.now()
  const speed = player.speed || store.animationSpeed || 1
  if (overlayLastTimestamp === null) overlayLastTimestamp = now
  const delta = (now - overlayLastTimestamp) / 1000
  overlayLastTimestamp = now

  if (manualCamera) {
    const cam = renderer.camera
    cam.position.x = manualCamera.position.x
    cam.position.y = manualCamera.position.y
    cam.zoom = manualCamera.zoom
    cam.update()
  }

  if (store.playing && speed > 0) {
    player.animationState.update(delta * speed)
    player.animationState.apply(player.skeleton)
    player.skeleton.updateWorldTransform()
    applyLayerVisibility(player.skeleton)
    const { time, hasTracks } = currentCompositeTime(player)
    compositeElapsed = hasTracks ? time : compositeElapsed + delta * speed
    overlayInstances.forEach(overlay => {
      applySegmentsToState(overlay.state, overlay.skeleton, overlay.segments, compositeElapsed, true)
      applyLayerVisibility(overlay.skeleton, overlay.source)
    })
    if (!exportingAnimation && compositeDuration > 0 && compositeElapsed >= compositeDuration - 0.0001 && compositeMapping) {
      void startComposite(player, compositeMapping, compositeElapsed % compositeDuration)
      return
    }
  } else {
    player.animationState.apply(player.skeleton)
    player.skeleton.updateWorldTransform()
    applyLayerVisibility(player.skeleton)
    const { time, hasTracks } = currentCompositeTime(player)
    if (hasTracks) {
      compositeElapsed = time
    }
    overlayInstances.forEach(overlay => {
      applySegmentsToState(overlay.state, overlay.skeleton, overlay.segments, compositeElapsed, true)
      applyLayerVisibility(overlay.skeleton, overlay.source)
    })
  }

  clearRendererBackground(renderer)
  renderer.begin()
  const premultiplied = getPremultipliedAlpha(player)
  renderer.drawSkeleton(player.skeleton, premultiplied)
  overlayInstances.forEach(overlay => {
    if (!overlayActiveAt(overlay.segments, compositeElapsed)) return
    const current = overlay.state.getCurrent(0)
    if (!current || !current.animation) {
      overlay.skeleton.setToSetupPose()
      overlay.skeleton.updateWorldTransform()
      return
    }
    renderer.drawSkeleton(overlay.skeleton, premultiplied)
  })
  renderer.end()

  if (compositeDuration > 0) {
    progress.value = Math.min(compositeElapsed / compositeDuration, 1)
  }
  drawOverlay()

  if (compositeActive && overlayInstances.length > 0) {
    overlayRenderHandle = requestAnimationFrame(renderCompositeFrame)
  } else {
    overlayRenderHandle = null
  }
}

function advanceCompositeStates(deltaSeconds: number) {
  if (!player || !player.skeleton || !player.animationState) return
  const speed = player.speed || store.animationSpeed || 1
  player.animationState.update(deltaSeconds * speed)
  player.animationState.apply(player.skeleton)
  player.skeleton.updateWorldTransform()
  const { time, hasTracks } = currentCompositeTime(player)
  compositeElapsed = hasTracks ? time : compositeElapsed + deltaSeconds * speed
  overlayInstances.forEach(overlay => {
    applySegmentsToState(overlay.state, overlay.skeleton, overlay.segments, compositeElapsed, true)
  })
}

function renderCompositeOnce() {
  if (!player || !player.skeleton || !player.sceneRenderer) return
  const { time, hasTracks } = currentCompositeTime(player)
  if (hasTracks) {
    compositeElapsed = time
  }
  const renderer = player.sceneRenderer
  if (manualCamera) {
    const cam = renderer.camera
    cam.position.x = manualCamera.position.x
    cam.position.y = manualCamera.position.y
    cam.zoom = manualCamera.zoom
    cam.update()
  }
  applyLayerVisibility(player.skeleton)
  clearRendererBackground(renderer)
  renderer.begin()
  const premultiplied = getPremultipliedAlpha(player)
  renderer.drawSkeleton(player.skeleton, premultiplied)
  overlayInstances.forEach(overlay => {
    if (!overlayActiveAt(overlay.segments, compositeElapsed)) return
    applyLayerVisibility(overlay.skeleton, overlay.source)
    const current = overlay.state.getCurrent(0)
    if (!current || !current.animation) {
      overlay.skeleton.setToSetupPose()
      overlay.skeleton.updateWorldTransform()
      return
    }
    renderer.drawSkeleton(overlay.skeleton, premultiplied)
  })
  renderer.end()
  drawOverlay()
}

async function startComposite(p: SpinePlayer, mapping: CompiledComposite, seekToSeconds = 0) {
  const state = p.animationState
  const skeleton = p.skeleton
  if (!state || !skeleton) return
  const startToken = ++compositeStartToken
  const selectedCharId = store.selectedCharacterId
  const { schedule, duration, time, externalAssets } = await scheduleCompositeTimeline(p, mapping, seekToSeconds)
  if (startToken !== compositeStartToken || p !== player || selectedCharId !== store.selectedCharacterId) return
  registerExternalLayerNames(externalAssets)

  compositeActive = true
  compositeSchedule = schedule
  compositeDuration = duration
  compositeElapsed = time
  compositeLastTimestamp = store.playing ? performance.now() : null
  compositeMapping = mapping
  compositeCharId = store.selectedCharacterId
  progress.value = duration > 0 ? time / duration : 0

  const perLayer = new Map<string, { trackIndex: number; source: string | null; segments: CompositeSegment[] }>()
  schedule.forEach(segment => {
    const key = `${segment.source ?? 'base'}:${segment.track}`
    if (!perLayer.has(key)) {
      perLayer.set(key, { trackIndex: segment.track, source: segment.source, segments: [] })
    }
    perLayer.get(key)!.segments.push(segment)
  })

  applySegmentsToState(state, skeleton, perLayer.get('base:0')?.segments ?? [], time)
  applyLayerVisibility(skeleton)

  disposeOverlays()
  stopOverlayRendering()
  for (const layer of perLayer.values()) {
    if (!layer.source && layer.trackIndex === 0) continue
    overlayInstances.push(
      createOverlayInstance(
        layer.trackIndex,
        layer.segments,
        skeleton,
        state,
        time,
        layer.source,
        layer.source ? externalAssets.get(layer.source) : undefined,
      ),
    )
  }
  overlayInstances.forEach(overlay => applyLayerVisibility(overlay.skeleton, overlay.source))

  if (overlayInstances.length > 0) {
    stopPlayerRenderLoop(p)
    overlayLastTimestamp = null
    if (store.playing || exportingAnimation) {
      overlayRenderHandle = requestAnimationFrame(renderCompositeFrame)
    } else {
      renderCompositeOnce()
    }
  } else {
    startPlayerRenderLoop(p)
    ;(p as unknown as SpinePlayerInternal).drawFrame(false)
  }

  if (store.playing) {
    p.play()
  } else {
    p.pause()
  }
}

function seekCompositeTo(p: SpinePlayer, time: number) {
  if (!compositeActive || !compositeSchedule.length || !compositeMapping) return false
  const state = p.animationState
  const skeleton = p.skeleton
  if (!state || !skeleton) return false
  const duration = compositeDuration || compositeSchedule.reduce((max, seg) => Math.max(max, seg.start + seg.duration), 0)
  const normalizedTime = duration > 0 ? ((time % duration) + duration) % duration : 0
  compositeElapsed = normalizedTime
  applySegmentsToState(state, skeleton, compositeSchedule.filter(seg => !seg.source && seg.track === 0), normalizedTime)
  overlayInstances.forEach(overlay => applySegmentsToState(overlay.state, overlay.skeleton, overlay.segments, normalizedTime, true))
  if (overlayInstances.length > 0) {
    renderCompositeOnce()
  } else {
    ;(p as unknown as SpinePlayerInternal).drawFrame(false)
  }
  progress.value = duration > 0 ? normalizedTime / duration : 0
  return true
}

function requestPausedCompositeRender() {
  if (!compositeActive || overlayInstances.length === 0 || store.playing || exportingAnimation) return
  if (pausedCompositeRenderPending) return
  pausedCompositeRenderPending = true
  requestAnimationFrame(() => {
    pausedCompositeRenderPending = false
    renderCompositeOnce()
  })
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

function applyLayerVisibility(skeleton: SpineSkeleton | null, source: string | null = null) {
  if (!skeleton) return
  const visibility = store.layerVisibility
  const slots = skeleton.slots as unknown as SpineSlot[]
  for (const slot of slots) {
    const name = slot.data?.name
    if (!name) continue
    if (visibility[getScopedLayerName(source, name)] === false) {
      if (slot.color) slot.color.a = 0
      if (slot.darkColor) slot.darkColor.a = 0
    }
  }
}

function restoreLayerAlphas(skeleton: SpineSkeleton | null, layerName: string, source: string | null = null) {
  if (!skeleton) return
  const slotName = getSlotNameForLayerKey(layerName, source)
  if (!slotName) return
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

const emit = defineEmits(['animations', 'skins', 'update:inspectMode'])

function requestViewerRedraw() {
  requestAnimationFrame(() => {
    if (!player) return
    if (compositeActive && overlayInstances.length > 0) {
      renderCompositeOnce()
      return
    }
    ;(player as unknown as SpinePlayerInternal).drawFrame(false)
    drawOverlay()
  })
}

watch(inspectMode, requestViewerRedraw)

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
        overlayInstances.forEach(overlay => restoreLayerAlphas(overlay.skeleton, name, overlay.source))
      }
      previousLayerVisibility.set(name, isVisible)
    }
    overlayInstances.forEach(overlay => {
      overlay.state.apply(overlay.skeleton)
      overlay.skeleton.updateWorldTransform()
      applyLayerVisibility(overlay.skeleton, overlay.source)
    })
    if (compositeActive && overlayInstances.length > 0) {
      requestPausedCompositeRender()
    } else {
      ;(player as unknown as SpinePlayerInternal).drawFrame(false)
      drawOverlay()
    }
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
    dating: `dating/${char.dating}`,
  }

  const path = `${getSpineAssetRoot()}/${char.id}/${ANIMATION_TYPE_BASE_PATH[store.animationCategory]}`

  const binaryUrl = char.customFiles?.skel || `${path}.skel`
  const jsonUrl = char.customFiles?.json
  const atlasUrl = char.customFiles?.atlas || `${path}.atlas`
  const rawDataURIs = char.customFiles?.images

  offset = new Vector2()
  size = new Vector2()

  if (player) {
    resetComposite()
    clearExternalSkeletonCache()
    player.dispose()
    container.value.innerHTML = ''
    manualCamera = null
    if (detachCameraListeners) {
      detachCameraListeners()
      detachCameraListeners = null
    }
  }

  ensureGLTexturePremultiplyPatch()

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
      if (compositeActive && overlayInstances.length > 0) {
        drawOverlay()
        return
      }
      if (manualCamera && player) {
        const cam = player.sceneRenderer!.camera
        cam.position.x = manualCamera.position.x
        cam.position.y = manualCamera.position.y
        cam.zoom = manualCamera.zoom
        cam.update()
      }
      if (player) {
        if (compositeActive && compositeMapping && compositeCharId === store.selectedCharacterId) {
          if (store.playing && compositeDuration > 0) {
            const now = performance.now()
            if (compositeLastTimestamp !== null) {
              const delta = (now - compositeLastTimestamp) / 1000
              const speed = player.speed || store.animationSpeed || 1
              const { time, hasTracks } = currentCompositeTime(player)
              compositeElapsed = hasTracks ? time : compositeElapsed + delta * speed
            }
            compositeLastTimestamp = now
            if (!exportingAnimation && compositeDuration > 0 && compositeElapsed >= compositeDuration - 0.0001) {
              if (!compositeRestarting) {
                compositeRestarting = true
                void startComposite(player, compositeMapping, compositeElapsed % compositeDuration)
                  .finally(() => {
                    compositeRestarting = false
                  })
              }
              return
            }
            if (exportingAnimation && compositeDuration > 0 && compositeElapsed >= compositeDuration - 0.0001) {
              if (recorder && recorder.state === 'recording') {
                recorder.stop()
              }
              return
            }
          }
          progress.value = compositeDuration > 0 ? Math.min(compositeElapsed / compositeDuration, 1) : 0
          if (store.playing && compositeDuration > 0 && !exportingAnimation) {
            const hasTrack = compositeTracksActive(player)
            const finished = compositeTracksFinished(player)
            if ((!hasTrack || finished) && !compositeRestarting) {
              compositeRestarting = true
              void startComposite(player, compositeMapping, compositeElapsed % compositeDuration)
                .finally(() => {
                  compositeRestarting = false
                })
              return
            }
          }
        } else if (store.playing) {
          const trackIndex = getActiveTrackIndexForSelectedAnimation(player.animationState)
          const entry = player.animationState?.getCurrent(trackIndex)
          if (entry && entry.animation) {
            const d = entry.animation.duration
            if (d > 0) {
              progress.value = (entry.trackTime % d) / d
            }
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
      for (const compositeDefinition of getCompositesForCurrent()) {
        if (!names.includes(compositeDefinition.name)) {
          names.push(compositeDefinition.name)
        }
      }
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
          const mapping = getCompositeForAnimation(store.selectedAnimation)
          if (mapping) {
            void startComposite(p, mapping, 0)
          } else {
            resetComposite()
            startPlayerRenderLoop(p)
            setSpineAnimation(p, store.selectedAnimation, { loop: true })
          }
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
      if (detachCameraListeners) detachCameraListeners()
      const handlePointerMove = () => requestPausedCompositeRender()
      const handleWheel = () => requestPausedCompositeRender()
      canvas.addEventListener('pointermove', handlePointerMove)
      canvas.addEventListener('wheel', handleWheel, { passive: true })
      detachCameraListeners = () => {
        canvas.removeEventListener('pointermove', handlePointerMove)
        canvas.removeEventListener('wheel', handleWheel)
      }

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
  resetComposite()
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
  resetComposite()
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
    const mapping = getCompositeForAnimation(anim)
    if (mapping) {
      resetComposite()
      void startComposite(player, mapping, 0)
    } else {
      resetComposite()
      startPlayerRenderLoop(player)
      setSpineAnimation(player, anim, { loop: true })
    }
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
    if (compositeActive && compositeMapping) {
      void startComposite(player, compositeMapping, compositeElapsed)
    }
  }
})

watch(() => store.playing, playing => {
  if (!player) return
  if (playing) {
    if (compositeActive && compositeMapping) {
      if (!compositeRestarting && (!compositeTracksActive(player) || compositeElapsed >= compositeDuration - 0.0001)) {
        compositeRestarting = true
        void startComposite(player, compositeMapping, compositeElapsed % compositeDuration)
          .finally(() => {
            compositeRestarting = false
          })
      }
    }
    if (compositeActive) {
      compositeLastTimestamp = performance.now()
      overlayLastTimestamp = performance.now()
      if (overlayInstances.length > 0 && overlayRenderHandle === null) {
        overlayRenderHandle = requestAnimationFrame(renderCompositeFrame)
      }
    }
    player.play()
  } else {
    compositeLastTimestamp = null
    overlayLastTimestamp = null
    stopOverlayRendering()
    player.pause()
  }
})

watch(() => store.animationSpeed, speed => {
  if (player) player.speed = speed
})

watch(() => store.backgroundColor, () => {
  applyPlayerBackgroundTransparency()
  if (compositeActive && overlayInstances.length > 0) {
    requestPausedCompositeRender()
  }
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

    const attachment = slot.getAttachment?.() as VertexAttachment | undefined
    const vertexCount = attachment?.worldVerticesLength ?? 0

    if (attachment && vertexCount > 0 && typeof attachment.computeWorldVertices === 'function') {
      const worldVertices = new Float32Array(vertexCount)
      attachment.computeWorldVertices(slot as Slot, 0, vertexCount, worldVertices, 0, 2)
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

  const attachment = slot.getAttachment?.() as VertexAttachment | undefined
  const vertexCount = attachment?.worldVerticesLength ?? 0
  if (attachment && vertexCount > 0 && typeof attachment.computeWorldVertices === 'function') {
    const worldVertices = new Float32Array(vertexCount)
    attachment.computeWorldVertices(slot as Slot, 0, vertexCount, worldVertices, 0, 2)

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
  resetComposite()
  clearExternalSkeletonCache()
  if (compositeFrameHandle !== null) {
    cancelAnimationFrame(compositeFrameHandle)
    compositeFrameHandle = null
  }
  if (detachCameraListeners) {
    detachCameraListeners()
    detachCameraListeners = null
  }
  player?.dispose()
  player = null
  if (resizeObserver && viewerWrapper.value) {
    resizeObserver.unobserve(viewerWrapper.value)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
})

function seek() {
  if (!player) return
  const mapping = getCompositeForAnimation(store.selectedAnimation)
  if (mapping) {
    const targetTime = progress.value * compositeDuration
    const reused = compositeActive && compositeMapping === mapping && compositeSchedule.length > 0
    if (reused) {
      seekCompositeTo(player, targetTime)
    } else {
      void startComposite(player, mapping, targetTime)
    }
    return
  }
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
  if (compositeActive && overlayInstances.length > 0 && !store.playing) {
    requestPausedCompositeRender()
  }
}

function getZoomBounds() {
  const baseZoom = defaultZoom || manualCamera?.zoom || 1
  return {
    min: baseZoom * MIN_ZOOM_FACTOR,
    max: baseZoom * MAX_ZOOM_FACTOR,
  }
}

function setCameraZoom(nextZoom: number) {
  if (!manualCamera) return
  const { min, max } = getZoomBounds()
  manualCamera.zoom = Math.min(Math.max(nextZoom, min), max)
  manualCamera.update()
  if (compositeActive && overlayInstances.length > 0 && !store.playing) {
    requestPausedCompositeRender()
  }
}

function zoomIn() {
  if (!manualCamera) return
  setCameraZoom(manualCamera.zoom / ZOOM_STEP_FACTOR)
}

function zoomOut() {
  if (!manualCamera) return
  setCameraZoom(manualCamera.zoom * ZOOM_STEP_FACTOR)
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

  const gl = (player as unknown as SpinePlayerInternal).context.gl
  const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  const mapping = getCompositeForAnimation(animationName)
  const hasOverlap = !!mapping && compositeHasParallel(mapping)

  let targetWidth: number
  let targetHeight: number
  if (hasOverlap) {
    const aspect = prevWidth > 0 ? prevHeight / prevWidth : 1
    targetWidth = Math.min(3000, maxTexSize)
    targetHeight = Math.round(targetWidth * aspect)
    if (targetHeight > maxTexSize) {
      targetHeight = maxTexSize
      targetWidth = Math.min(maxTexSize, Math.round(targetHeight / aspect))
    }
  } else {
    const targetSize = Math.min(3000, maxTexSize)
    targetWidth = targetSize
    targetHeight = targetSize
  }

  if (!store.useCurrentCamera) {
    cam.position.x = defaultCameraPos.x
    cam.position.y = defaultCameraPos.y
  }
  const scaleW = targetWidth / prevWidth
  const scaleH = targetHeight / prevHeight
  const scale = Math.max(scaleW, scaleH) || 1
  cam.zoom = hasOverlap ? prevZoom : prevZoom / scale
  cam.update()

  const dpr = window.devicePixelRatio || 1
  canvas.width = targetWidth
  canvas.height = targetHeight
  canvas.style.width = `${targetWidth / dpr}px`
  canvas.style.height = `${targetHeight / dpr}px`
  const renderer = player.sceneRenderer
  const resizeRenderer = (width: number, height: number) => {
    const instance = renderer as unknown as { resize?: (w: number, h?: number) => void } | null
    instance?.resize?.(width, height)
  }
  resizeRenderer(targetWidth, targetHeight)

  applyPlayerBackgroundTransparency()
  forceTransparentClear = transparent
  if (compositeActive && overlayInstances.length > 0) {
    renderCompositeOnce()
  } else {
    ;(player as unknown as SpinePlayerInternal).drawFrame(false)
  }
  requestAnimationFrame(() => {
    const url = getCompositeDataURL(canvas, transparent)
    forceTransparentClear = false
    canvas.width = prevWidth
    canvas.height = prevHeight
    canvas.style.width = prevStyleWidth
    canvas.style.height = prevStyleHeight
    resizeRenderer(prevWidth, prevHeight)

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
    if (compositeActive && overlayInstances.length > 0) {
      renderCompositeOnce()
    } else {
      ;(player as unknown as SpinePlayerInternal).drawFrame(false)
    }

    const a = document.createElement('a')
    a.href = url
    a.download = `screenshot_${store.selectedCharacterId}_${animationName}.png`
    a.click()
  })
}

async function exportAnimation(transparent: boolean): Promise<void> {
  const p = player
  const cam = manualCamera
  if (!p || !cam) return

  cancelExport = false
  exportingAnimation = true

  const canvas = p.canvas!
  const animationName = store.selectedAnimation
  const fps = 60
  const prevPos = new Vector2(cam.position.x, cam.position.y)
  const prevZoom = cam.zoom
  const wasPlaying = store.playing
  const state = p.animationState
  const skeleton = p.skeleton
  const animName = store.selectedAnimation
  let mapping: CompiledComposite | null = null
  let stream: MediaStream | null = null
  let activeRecorder: MediaRecorder | null = null

  try {
    applyPlayerBackgroundTransparency(p)

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
    const mimeType =
      ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type =>
        MediaRecorder.isTypeSupported(type),
      )
    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = canvas.width
    compositeCanvas.height = canvas.height
    const compositeCtx = compositeCanvas.getContext('2d')
    if (compositeFrameHandle) {
      cancelAnimationFrame(compositeFrameHandle)
      compositeFrameHandle = null
    }
    stream = compositeCtx ? compositeCanvas.captureStream(fps) : canvas.captureStream(fps)
    const recorderOptions: MediaRecorderOptions = {
      videoBitsPerSecond: 10_000_000,
    }
    if (mimeType) recorderOptions.mimeType = mimeType
    activeRecorder = new MediaRecorder(stream, recorderOptions)
    recorder = activeRecorder

    const chunks: BlobPart[] = []
    let duration = 3
    let timelineEnd = duration
    mapping = getCompositeForAnimation(animName)
    if (animName && state) {
      if (mapping) {
        const info = await scheduleCompositeTimeline(p, mapping, 0)
        duration = info.duration
        timelineEnd = info.duration || duration || 3
        store.playing = true
        await startComposite(p, mapping, 0)
      } else {
        const anim = state.data.skeletonData.animations.find(
          (a: Animation) => a.name === animName,
        )
        if (anim) duration = anim.duration
        timelineEnd = duration
        state.clearTrack(0)
        state.clearTrack(1)
        setSpineAnimation(p, animName, { loop: true, forceNoMix: true })
        if (skeleton) {
          state.apply(skeleton)
          skeleton.updateWorldTransform()
          ;(p as unknown as SpinePlayerInternal).drawFrame(false)
        }
      }
    }

    const recordDuration = timelineEnd / (p.speed || store.animationSpeed || 1)

    p.play()
    if (compositeCtx) {
      drawCompositeFrame(compositeCtx, compositeCanvas.width, compositeCanvas.height, canvas, transparent)
    }

    const recordingComplete = new Promise<void>((resolve, reject) => {
      let stopTimer: number | null = null
      let stopWatchdog: number | null = null
      const clearStopTimers = () => {
        if (stopTimer !== null) window.clearTimeout(stopTimer)
        if (stopWatchdog !== null) window.clearTimeout(stopWatchdog)
      }
      const stopRecording = () => {
        if (activeRecorder?.state === 'recording') activeRecorder.stop()
        stopWatchdog = window.setTimeout(() => {
          reject(new Error('The browser did not finish the WebM recording.'))
        }, 5_000)
      }

      activeRecorder!.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      activeRecorder!.onerror = event => {
        clearStopTimers()
        const error = (event as Event & { error?: DOMException }).error
        reject(error || new Error('The browser failed to record the WebM video.'))
      }
      activeRecorder!.onstop = () => {
        clearStopTimers()
        resolve()
      }

      activeRecorder!.start()

      if (compositeCtx) {
        const renderComposite = () => {
          if (activeRecorder?.state !== 'recording') return
          if (compositeCanvas.width !== canvas.width || compositeCanvas.height !== canvas.height) {
            compositeCanvas.width = canvas.width
            compositeCanvas.height = canvas.height
          }
          drawCompositeFrame(compositeCtx, compositeCanvas.width, compositeCanvas.height, canvas, transparent)
          compositeFrameHandle = requestAnimationFrame(renderComposite)
        }
        compositeFrameHandle = requestAnimationFrame(renderComposite)
      }

      stopTimer = window.setTimeout(stopRecording, Math.max(0, recordDuration * 1000))
    })

    await recordingComplete

    if (!cancelExport) {
      const recordedMimeType = activeRecorder.mimeType || mimeType || 'video/webm'
      const blob = new Blob(chunks, { type: recordedMimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `animation_${store.selectedCharacterId}_${animationName}.webm`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    }
  } finally {
    if (activeRecorder?.state !== 'inactive') {
      activeRecorder?.stop()
    }
    stream?.getTracks().forEach(track => track.stop())
    applyPlayerBackgroundTransparency(p)
    if (compositeFrameHandle) {
      cancelAnimationFrame(compositeFrameHandle)
      compositeFrameHandle = null
    }
    if (!store.useCurrentCamera) {
      cam.position.x = prevPos.x
      cam.position.y = prevPos.y
      cam.zoom = prevZoom
      cam.update()
    }
    if (mapping) {
      void startComposite(p, mapping, 0)
    } else if (animName) {
      setSpineAnimation(p, animName, { loop: true })
    }
    if (wasPlaying) {
      p.play()
    } else {
      p.pause()
    }
    store.playing = wasPlaying
    exportingAnimation = false
    if (recorder === activeRecorder) recorder = null
    cancelExport = false
  }
}

function exportAnimationFrames(transparent: boolean): Promise<void> {
  const p = player
  const cam = manualCamera
  if (!p || !cam) return Promise.resolve()

  cancelExport = false
  exportingFrames = true
  exportingAnimation = true

  const canvas = p.canvas!
  const animationName = store.selectedAnimation
  const fps = 60

  return new Promise(async resolve => {
    applyPlayerBackgroundTransparency(p)

    const prevPos = new Vector2(cam.position.x, cam.position.y)
    const prevZoom = cam.zoom
    const wasPlaying = store.playing

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
    let timelineEnd = duration
    let mapping: CompiledComposite | null = null
    if (animName && state) {
      mapping = getCompositeForAnimation(animName)
      if (mapping) {
        const info = await scheduleCompositeTimeline(p, mapping, 0)
        duration = info.duration
        timelineEnd = info.duration
        await startComposite(p, mapping, 0)
        p.pause()
        store.playing = false
        compositeLastTimestamp = null
        overlayLastTimestamp = null
        stopOverlayRendering()
        timelineEnd = Math.max(getTracksEndDuration(p.animationState) || 0, duration)
      } else {
        const anim = state.data.skeletonData.animations.find(
          (a: Animation) => a.name === animName,
        )
        if (anim) duration = anim.duration
        timelineEnd = duration
        state.clearTrack(0)
        state.clearTrack(1)
        setSpineAnimation(p, animName, { loop: false, forceNoMix: true })
        if (skeleton) {
          state.apply(skeleton)
          skeleton.updateWorldTransform()
        }
        resetComposite()
      }
    }
    if (mapping) {
      stopOverlayRendering()
      renderCompositeOnce()
    }

    const speed = p.speed || store.animationSpeed || 1
    const stepSeconds = 1 / fps
    const stepDuration = stepSeconds * speed
    let targetDuration = mapping ? compositeDuration || timelineEnd : timelineEnd
    const prevCompositeDuration = compositeDuration
    let simFrames = 0
    const EPS = 1e-6

    if (mapping) {
      const maxSimFrames = 2000
      while (simFrames < maxSimFrames && !compositeTracksReachedAnimEnd(p)) {
        advanceCompositeStates(stepSeconds)
        simFrames++
      }
      const simDuration = simFrames * stepDuration
      if (simDuration > 0) {
        targetDuration = simDuration + stepDuration
      }
      await startComposite(p, mapping, 0)
      compositeDuration = targetDuration
      compositeLastTimestamp = null
      overlayLastTimestamp = null
      stopOverlayRendering()
      renderCompositeOnce()
    }

    const totalFrames = Math.max(
      1,
      mapping ? Math.max(1, simFrames + 1) : Math.ceil((targetDuration + EPS) / stepDuration),
    )
    const zip = new JSZip()
    p.pause()
    store.playing = false

    let frame = 0
    let exportFinalized = false
    const capture = () => {
      if (cancelExport) {
        exportingFrames = false
        exportingAnimation = false
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

      if (mapping) {
        renderCompositeOnce()
      } else {
        ;(p as unknown as SpinePlayerInternal).drawFrame(false)
      }
      const url = getCompositeDataURL(canvas, transparent)
      zip.file(`frame_${String(frame).padStart(4, '0')}.png`, url.split(',')[1], { base64: true })
      frame++

      if (mapping) {
        advanceCompositeStates(stepSeconds)
        if (compositeElapsed > targetDuration) {
          compositeElapsed = targetDuration
        }
        progress.value = compositeDuration > 0 ? Math.min(compositeElapsed / compositeDuration, 1) : 0
      } else {
        p.animationState?.update(stepDuration)
        p.animationState?.apply(p.skeleton!)
        p.skeleton!.updateWorldTransform()
        compositeElapsed = frame * stepDuration

        const entry = p.animationState?.getCurrent(getActiveTrackIndexForSelectedAnimation(p.animationState))
        const entryDuration = entry?.animation?.duration ?? 0
        if (entryDuration > 0) {
          progress.value = Math.min((entry?.trackTime ?? 0) / entryDuration, 1)
        }
      }

      const finishedTracks = mapping ? compositeTracksReachedAnimEnd(p) : compositeTracksFinished(p)
      const shouldStop = finishedTracks || compositeElapsed >= targetDuration - EPS || frame >= totalFrames
      if (shouldStop) {
        if (!exportFinalized) {
          exportFinalized = true
          if (mapping && compositeDuration > 0) {
            compositeElapsed = compositeDuration
            progress.value = 1
          }
          finalize()
          zip.generateAsync({ type: 'blob' })
            .then((blob: Blob) => {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `animation_${store.selectedCharacterId}_${animationName}_frames.zip`
              a.click()
              URL.revokeObjectURL(url)
            })
            .catch(() => {})
            .finally(() => {
              resolve()
            })
        }
        return
      }

      requestAnimationFrame(capture)
    }

    const finalize = () => {
      exportingFrames = false
      exportingAnimation = false
      applyPlayerBackgroundTransparency(p)
      if (!store.useCurrentCamera) {
        cam.position.x = prevPos.x
        cam.position.y = prevPos.y
        cam.zoom = prevZoom
        cam.update()
      }
      progress.value = 0
      compositeElapsed = 0
      if (mapping) {
        compositeDuration = prevCompositeDuration
        void startComposite(p, mapping, 0)
        if (wasPlaying) {
          p.play()
        } else {
          p.pause()
        }
      } else if (animName) {
        setSpineAnimation(p, animName, { loop: true })
        p.animationState?.apply(p.skeleton!)
        p.skeleton!.updateWorldTransform()
        if (wasPlaying) {
          p.play()
        } else {
          p.pause()
        }
      }
      store.playing = wasPlaying
      cancelExport = false
    }

    capture()
  })
}

defineExpose({ resetCamera, zoomIn, zoomOut, saveScreenshot, exportAnimation, exportAnimationFrames })
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
