<template>
  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 12 12 17 22 12" />
    <line v-if="!active" x1="4" y1="4" x2="20" y2="20" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ active: boolean }>()
</script>
