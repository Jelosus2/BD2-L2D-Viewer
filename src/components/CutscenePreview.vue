<script setup lang="ts">
import type { CutscenePreview, CutscenePreviewSnapshot } from "@/scene/createCutscenePreview";
import type { CutsceneVoiceLanguage } from "@/audio/loadCutsceneAudio";

import { loadCutsceneScene } from "@/data/loadCutsceneScene";
import { createCutscenePreview } from "@/scene/createCutscenePreview";
import { loadCutscenePreviewIndex, type CutscenePreviewEntry } from "@/data/loadCutscenePreviewIndex";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const previewSources = ref<CutscenePreviewEntry[]>([]);
const host = ref<HTMLDivElement | null>(null);
const variant = ref("");
const filter = ref("");
const language = ref<CutsceneVoiceLanguage>("JP");
const name = ref("Character");
const status = ref("Closed");
const errorMessage = ref("");
const state = ref<CutscenePreviewSnapshot>({ time: 0, duration: 0, playing: false });
const position = ref(0);
const scrubbing = ref(false);

let controller: AbortController | undefined;
let indexController: AbortController | undefined;
let preview: CutscenePreview | undefined;

const selectedSource = computed(() => previewSources.value.find((source) => source.id === variant.value));
const voiceEnabled = computed(() => selectedSource.value?.variant === "cutscene");
const ready = computed(() => status.value === "Ready");
const filteredSources = computed(() => {
    const terms = filter.value.trim().toLowerCase().match(/loop\s*\d+|\S+/g) ?? [];

    return previewSources.value.filter((source) => {
        const label = source.label.toLowerCase();
        const id = source.id.replace(/^CutScene/, "").toLowerCase();

        return terms.every((term) => {
            const labelTerm = term.replace(/^loop\s*(\d+)$/, "loop $1");
            const idTerm = term.replace(/^cutscene(?=\d)/, "");

            return label.includes(labelTerm) || id.includes(idTerm);
        });
    });
});

const selectedOutsideFilter = computed(() => selectedSource.value !== undefined && !filteredSources.value.some((source) => source.id === variant.value));

function close() {
    indexController?.abort();
    indexController = undefined;

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
    const selected = selectedSource.value;
    if (!element || !selected)
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

async function initialize() {
    close();

    const current = new AbortController();
    indexController = current;
    status.value = "Loading";

    try
    {
        const index = await loadCutscenePreviewIndex(current.signal);
        if (indexController !== current || current.signal.aborted)
            return;

        previewSources.value = index.items;
        variant.value = index.defaultId;
        indexController = undefined;

        await open();
    }
    catch (error)
    {
        if (indexController !== current || current.signal.aborted)
            return;

        indexController = undefined;
        status.value = "Failed";
        errorMessage.value = error instanceof Error ? error.message : String(error);
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

function reload() {
    if (previewSources.value.length === 0)
        void initialize();
    else
        void open();
}

function clearFilter() {
    filter.value = "";
}

onMounted(initialize);
onBeforeUnmount(close);
</script>

<template>
    <main class="preview">
        <header>
            <h1>{{ name }} · Cutscene preview</h1>
            <input
                v-model="filter"
                type="search"
                aria-label="Filter animations"
                placeholder="Search character, costume, animation or ID"
                :disabled="previewSources.length === 0"
                @keydown.esc="clearFilter"
            />
            <button v-if="filter" type="button" @click="clearFilter">
                Clear filter
            </button>
            <span class="filter-count" aria-live="polite">
                {{ filteredSources.length }} / {{ previewSources.length }} matches
            </span>
            <select
                v-model="variant"
                aria-label="Scene variant"
                :disabled="filteredSources.length === 0"
                @change="open"
            >
                <option v-if="selectedOutsideFilter && selectedSource" :value="selectedSource.id" disabled>
                    Current: {{ selectedSource.label }}
                </option>
                <option v-for="source in filteredSources" :key="source.id" :value="source.id">
                    {{ source.label }}
                </option>
            </select>
            <select
                v-model="language"
                aria-label="Voice language"
                :disabled="!voiceEnabled"
                @change="open"
            >
                <option value="JP">Japanese</option>
                <option value="KR">Korean</option>
            </select>
            <button type="button" @click="reload">Reload</button>
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

button, select, input[type="search"] {
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

input[type="search"] {
    flex: 0 1 280px;
    min-width: 160px;
    cursor: text;
}

select[aria-label="Scene variant"] {
    max-width: 100%;
}

.filter-count {
    color: #9ca3af;
    font-size: 13px;
    white-space: nowrap;
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
