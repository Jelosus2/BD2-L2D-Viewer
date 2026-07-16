<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-0 z-[80]" aria-live="polite">
      <div v-if="!targetRect" class="absolute inset-0 bg-black/65" />
      <div
        v-else
        class="fixed rounded-xl ring-2 ring-indigo-300 ring-offset-4 ring-offset-transparent transition-all duration-200"
        :style="highlightStyle"
        aria-hidden="true"
      />

      <section
        ref="tooltip"
        class="pointer-events-auto fixed w-[calc(100vw-2rem)] max-w-xs rounded-xl border border-indigo-400/70 bg-gray-900 p-4 text-white shadow-2xl shadow-black/60 transition-all duration-200"
        :style="tooltipStyle"
        role="status"
      >
        <div v-if="stepLabel" class="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-300">
          {{ stepLabel }}
        </div>
        <h2 class="text-base font-semibold">{{ title }}</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-gray-300">{{ message }}</p>
        <div class="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            class="cursor-pointer rounded px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            @click="emit('skip')"
          >
            Skip tutorial
          </button>
          <button
            v-if="canComplete"
            type="button"
            class="cursor-pointer rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            @click="emit('complete')"
          >
            Got it
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'

const props = defineProps<{
  target?: string | null
  title: string
  message: string
  stepLabel?: string
  canComplete?: boolean
}>()

const emit = defineEmits<{
  (event: 'skip'): void
  (event: 'complete'): void
}>()

const tooltip = ref<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)
let mutationObserver: MutationObserver | null = null

function updateTarget() {
  if (!props.target) {
    targetRect.value = null
    return
  }

  const target = document.querySelector<HTMLElement>(props.target)
  if (!target) {
    targetRect.value = null
    return
  }

  const rect = target.getBoundingClientRect()
  targetRect.value = rect.width > 0 && rect.height > 0 ? rect : null
}

const highlightStyle = computed<CSSProperties>(() => {
  const rect = targetRect.value
  if (!rect) return {}
  const padding = 7
  return {
    left: `${Math.max(4, rect.left - padding)}px`,
    top: `${Math.max(4, rect.top - padding)}px`,
    width: `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`,
    height: `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.68)',
  }
})

const tooltipStyle = computed<CSSProperties>(() => {
  const rect = targetRect.value
  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const margin = 16
  const gap = 16
  const width = Math.min(320, window.innerWidth - margin * 2)
  const height = tooltip.value?.getBoundingClientRect().height || 170
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const spaceRight = window.innerWidth - rect.right
  const spaceLeft = rect.left
  let left = Math.min(Math.max(margin, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - margin)
  let top: number

  if (spaceBelow >= height + gap + margin) {
    top = rect.bottom + gap
  } else if (spaceAbove >= height + gap + margin) {
    top = rect.top - height - gap
  } else if (spaceRight >= width + gap + margin) {
    left = rect.right + gap
    top = Math.min(Math.max(margin, rect.top + rect.height / 2 - height / 2), window.innerHeight - height - margin)
  } else if (spaceLeft >= width + gap + margin) {
    left = rect.left - width - gap
    top = Math.min(Math.max(margin, rect.top + rect.height / 2 - height / 2), window.innerHeight - height - margin)
  } else {
    top = Math.min(
      Math.max(margin, rect.top + rect.height / 2 - height / 2),
      window.innerHeight - height - margin,
    )
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'none',
  }
})

function scheduleTargetUpdate() {
  void nextTick(() => requestAnimationFrame(updateTarget))
}

watch(() => props.target, scheduleTargetUpdate, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', updateTarget)
  window.addEventListener('scroll', updateTarget, true)
  mutationObserver = new MutationObserver(scheduleTargetUpdate)
  mutationObserver.observe(document.body, { childList: true, subtree: true })
  scheduleTargetUpdate()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateTarget)
  window.removeEventListener('scroll', updateTarget, true)
  mutationObserver?.disconnect()
  mutationObserver = null
})
</script>
