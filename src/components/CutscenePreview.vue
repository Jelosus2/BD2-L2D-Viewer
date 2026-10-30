<script setup lang="ts">
import type { CutscenePreview, CutscenePreviewSnapshot } from "@/scene/createCutscenePreview";
import type { CutsceneVoiceLanguage } from "@/audio/loadCutsceneAudio";

import { loadCutsceneScene } from "@/data/loadCutsceneScene";
import { createCutscenePreview } from "@/scene/createCutscenePreview";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const previewSources = {
    cutscene: {
        catalogUrl: "data/cutscene/prototype/catalog.json",
        variant: "cutscene",
    },
    loop: {
        catalogUrl: "data/cutscene-loop/prototype/catalog.json",
        variant: "loop",
    },
    "loop-2": {
        catalogUrl: "data/cutscene-loop/prototype/loop-2.json",
        variant: "loop",
    },
    sylvia: {
        catalogUrl: "data/cutscene/prototype/sylvia.json",
        variant: "cutscene",
    },
    "sylvia-loop": {
        catalogUrl: "data/cutscene-loop/prototype/sylvia.json",
        variant: "loop",
    }
} as const;

const host = ref<HTMLDivElement | null>(null);
const variant = ref<keyof typeof previewSources>("cutscene");
const language = ref<CutsceneVoiceLanguage>("JP");
const name = ref("Character");
const status = ref("Closed");
const errorMessage = ref("");
const state = ref<CutscenePreviewSnapshot>({ time: 0, duration: 0, playing: false });
const position = ref(0);
const scrubbing = ref(false);

let controller: AbortController | undefined;
let preview: CutscenePreview | undefined;

const ready = computed(() => status.value === "Ready");

function close() {
    preview?.dispose();
    preview = undefined;

    controller?.abort();
    controller = undefined;

    status.value = "Closed";
    errorMessage.value = "";
    state.value = { time: 0, duration: 0, playing: false };
    position.value = 0;
    scrubbing.value = false;
}

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

    function fail(error: unknown) {
        if (controller !== current || current.signal.aborted)
            return;

        status.value = "Failed";
        errorMessage.value = error instanceof Error ? error.message : String(error);
    }

    try
    {
        const selected = previewSources[variant.value];
        const loaded = await loadCutsceneScene(selected.catalogUrl, current.signal, selected.variant);

        current.signal.throwIfAborted();

        name.value = loaded.name;
        const created = await createCutscenePreview(element, loaded.scene, current.signal, (snapshot) => {
            if (controller !== current || current.signal.aborted)
                return;

            state.value = snapshot;
            if (!scrubbing.value)
                position.value = snapshot.time;
        }, fail, language.value);

        if (controller !== current || current.signal.aborted)
        {
            created.dispose();
            return;
        }

        preview = created;
        status.value = "Ready";
    }
    catch (error)
    {
        fail(error);
    }
}

async function control(action: (current: CutscenePreview) => void | Promise<void>) {
    const current = preview;
    if (!current)
        return;

    try
    {
        await action(current);
    }
    catch (error)
    {
        if (preview !== current)
            return;

        close();

        status.value = "Failed";
        errorMessage.value = error instanceof Error ? error.message : String(error);
    }
}

function toggle() {
    void control((current) => state.value.playing ? current.pause() : current.play());
}

function replay() {
    void control((current) => current.replay());
}

function seek() {
    scrubbing.value = false;
    void control((current) => current.seek(position.value));
}

onMounted(open);
onBeforeUnmount(close);
</script>

<template>
    <main class="preview">
        <header>
            <h1>{{ name }} · Cutscene preview</h1>
            <select v-model="variant" aria-label="Scene variant" @change="open">
                <option value="cutscene">Full cutscene</option>
                <option value="loop">Loop 1</option>
                <option value="loop-2">Loop 2</option>
                <option value="sylvia">Sylvia - Full cutscene</option>
                <option value="sylvia-loop">Sylvia - Loop</option>
            </select>
            <select
                v-model="language"
                aria-label="Voice language"
                :disabled="previewSources[variant].variant !== previewSources.cutscene.variant"
                @change="open"
            >
                <option value="JP">Japanese</option>
                <option value="KR">Korean</option>
            </select>
            <button type="button" @click="open">Reload</button>
            <button type="button" @click="close">Close</button>
            <span role="status">{{ status }}</span>
        </header>
        <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
        <div ref="host" class="canvas-host"></div>
        <footer>
            <button type="button" :disabled="!ready" @click="toggle">
                {{ state.playing ? "Pause" : "Play" }}
            </button>
            <button type="button" :disabled="!ready" @click="replay">Replay</button>
            <input
                v-if="state.duration !== null"
                v-model.number="position"
                type="range"
                aria-label="Scene time"
                min="0"
                step="any"
                :max="state.duration"
                :disabled="!ready"
                @input="scrubbing = true" @change="seek" />
            <output aria-live="off">
                {{ state.time.toFixed(2) }}{{ state.duration === null ? " s (Loop)" : ` / ${state.duration.toFixed(2)} s` }}
            </output>
        </footer>
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

header, footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
}

h1 {
    margin: 0;
    font-size: 18px;
}

button, select {
    padding: 6px 12px;
    color: inherit;
    background: #374151;
    border: 1px solid #6b7280;
    border-radius: 6px;
    cursor: pointer;
}

button:disabled {
    opacity: 0.5;
    cursor: default;
}

input {
    flex: 1;
    min-width: 120px;
    accent-color: #a78bfa;
}

output {
    font-variant-numeric: tabular-nums;
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
