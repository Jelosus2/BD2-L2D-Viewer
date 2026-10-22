<script setup lang="ts">
import { loadStandingScene } from "@/data/loadStandingScene";
import { createStandingPreview } from "@/spine/createStandingPreview";
import { onBeforeUnmount, onMounted, ref } from "vue";

const host = ref<HTMLDivElement | null>(null);
const name = ref("Character");
const status = ref("Closed");
const errorMessage = ref("");

let controller: AbortController | undefined;
let preview: { dispose(): void } | undefined;

async function open() {
    close();

    const element = host.value;
    if (!element)
        return;

    const current = new AbortController();
    controller = current;
    name.value = "Character";
    status.value = "Loading";
    errorMessage.value = "";

    try
    {
        const scene = await loadStandingScene("data/prototype/catalog.json", current.signal);
        current.signal.throwIfAborted();
        name.value = scene.name;

        const loaded = await createStandingPreview(element, scene, current.signal);

        if (current.signal.aborted)
        {
            loaded.dispose();
            return;
        }

        preview = loaded;
        status.value = "Ready";
    }
    catch (error)
    {
        if (current.signal.aborted)
            return;

        console.error(error);
        status.value = "Failed";
        errorMessage.value = error instanceof Error ? error.message : String(error);
    }
}

function close() {
    controller?.abort();
    controller = undefined;

    preview?.dispose();
    preview = undefined;

    status.value = "Closed";
}

onMounted(open);
onBeforeUnmount(close);
</script>

<template>
    <main class="preview">
        <header>
            <h1>{{ name }} · Standing preview</h1>
            <button type="button" @click="open">Reload</button>
            <button type="button" @click="close">Close</button>
            <span role="status">{{ status }}</span>
        </header>
        <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
        <div ref="host" class="canvas-host"></div>
    </main>
</template>

<style scoped>
.preview {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100dvh;
    padding: 16px;
    color: #e5e7eb;
    background: #111827;
    font-family: system-ui, sans-serif;
}

header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

h1 {
    margin: 0;
    font-size: 18px;
}

button {
    padding: 6px 12px;
    color: inherit;
    background: #374151;
    border: 1px solid #6b7280;
    border-radius: 6px;
    cursor: pointer;
}

.canvas-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border: 1px solid #374151;
}

.canvas-host :deep(canvas) {
    display: block;
}
</style>
