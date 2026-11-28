<script setup lang="ts">
import type { StandingVoices } from "@/audio/createStandingVoices";

import { createStandingVoices } from "@/audio/createStandingVoices";
import { loadStandingPreviewIndex, type StandingPreviewEntry, type StandingVoiceLanguage } from "@/data/loadStandingPreviewIndex";
import { loadStandingScene } from "@/data/loadStandingScene";
import { createStandingPreview } from "@/spine/createStandingPreview";
import { useSettingsStore } from "@/stores/settingsStore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const settings = useSettingsStore();
const items = ref<StandingPreviewEntry[]>([]);
const selectedId = ref("");
const filter = ref("");
const host = ref<HTMLDivElement | null>(null);
const name = ref("Character");
const status = ref("Closed");
const errorMessage = ref("");
const voiceLoading = ref(false);
const aliases = ref<Record<string, string>>({});
const animations = ref<string[]>([]);
const selectedAnimation = ref("");

const selected = computed(() => items.value.find((item) => item.id === selectedId.value));
const language = computed<StandingVoiceLanguage>({
    get: () => settings.audioLanguage,
    set: (value) => settings.setAudioLanguage(value),
});

const filtered = computed(() => {
    const terms = filter.value.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return items.value.filter((item) => {
        const oldIds = Object.keys(aliases.value).filter((id) => aliases.value[id] === item.id);

        return terms.every((term) => `${item.label} ${item.id} ${oldIds.join(" ")}`.toLowerCase().includes(term));
    });
});

const outsideFilter = computed(() => selected.value && !filtered.value.some((item) => item.id === selectedId.value));

let controller: AbortController | undefined;
let indexController: AbortController | undefined;
let voiceController: AbortController | undefined;
let preview: Awaited<ReturnType<typeof createStandingPreview>> | undefined;
let voices: StandingVoices | undefined;

function close() {
    indexController?.abort();
    indexController = undefined;
    controller?.abort();
    controller = undefined;
    voiceController?.abort();
    voiceController = undefined;
    voices?.dispose();
    voices = undefined;
    preview?.dispose();
    preview = undefined;
    animations.value = [];
    selectedAnimation.value = "";
    voiceLoading.value = false;
    status.value = "Closed";
    errorMessage.value = "";
}

function fail(error: unknown, current: AbortController) {
    if (controller !== current || current.signal.aborted)
        return;

    close();

    errorMessage.value = error instanceof Error ? error.message : String(error);
    status.value = "Failed";
}

async function loadVoices() {
    voiceController?.abort();
    voiceController = undefined;

    voices?.dispose();
    voices = undefined;

    const current = controller;
    const entry = selected.value;

    if (!current || !preview || !entry?.voices)
    {
        voiceLoading.value = false;
        return;
    }

    const request = new AbortController();
    voiceController = request;
    voiceLoading.value = true;

    try
    {
        const created = await createStandingVoices(entry.voices[language.value], request.signal);

        if (controller !== current || voiceController !== request || request.signal.aborted)
        {
            created.dispose();
            return;
        }

        voices = created;
    }
    catch (error)
    {
        if (voiceController === request && !request.signal.aborted)
            fail(error, current);
    }
    finally
    {
        if (voiceController === request)
            voiceLoading.value = false;
    }
}

async function open() {
    close();

    const element = host.value;
    const entry = selected.value;

    if (!element || !entry)
        return;

    const current = new AbortController();
    controller = current;
    status.value = "Loading";

    try
    {
        const scene = await loadStandingScene(entry.catalogUrl, current.signal);
        current.signal.throwIfAborted();
        name.value = scene.name;

        const created = await createStandingPreview(element, scene, current.signal, () => {
            if (controller !== current || current.signal.aborted || entry.voices && !voices)
                return false;

            void voices?.playNext().catch((error) => fail(error, current));
            return true;
        });

        if (controller !== current || current.signal.aborted)
        {
            created.dispose();
            return;
        }

        preview = created;
        animations.value = created.animations;
        status.value = "Ready";

        await loadVoices();
    }
    catch (error)
    {
        fail(error, current);
    }
}

async function initialize() {
    close();

    const current = new AbortController();
    indexController = current;
    status.value = "Loading";

    try
    {
        const index = await loadStandingPreviewIndex(current.signal);
        if (indexController !== current || current.signal.aborted)
            return;

        items.value = index.items;
        aliases.value = index.aliases;

        const requested = new URLSearchParams(window.location.search).get("char") ?? "";
        const canonical = index.aliases[requested] ?? requested;

        selectedId.value = index.items.some((item) => item.id === canonical)
            ? canonical
            : index.defaultId;
        indexController = undefined;

        await open();
    }
    catch (error)
    {
        if (indexController !== current || current.signal.aborted)
            return;

        indexController = undefined;
        errorMessage.value = error instanceof Error ? error.message : String(error);
        status.value = "Failed";
    }
}

watch(() => settings.audioLanguage, () => {
    void loadVoices();
});

onMounted(initialize);
onBeforeUnmount(close);
</script>

<template>
    <main class="preview">
        <header>
            <h1>{{ name }} · Standing preview</h1>
            <input v-model="filter" type="search" aria-label="Filter standing models" placeholder="Search character, costume or ID" @keydown.esc="filter = ''">
            <span>{{ filtered.length }} / {{ items.length }} matches</span>
            <select v-model="selectedId" aria-label="Standing model" :disabled="filtered.length === 0" @change="open">
                <option v-if="outsideFilter && selected" :value="selected.id" disabled>{{ selected.label }} (current)</option>
                <option v-for="entry in filtered" :key="entry.id" :value="entry.id">{{ entry.label }}</option>
            </select>
            <select v-model="language" aria-label="Voice language" :disabled="!selected?.voices">
                <option value="JP">Japanese</option>
                <option value="KR">Korean</option>
            </select>
            <select
                v-model="selectedAnimation"
                aria-label="Standing animation"
                :disabled="!preview"
                @change="preview?.setAnimation(selectedAnimation)"
            >
                <option value="">Default playback</option>
                <option
                    v-for="animation in animations"
                    :key="animation"
                    :value="animation"
                >
                    {{ animation }}
                </option>
            </select>
            <button type="button" @click="items.length ? open() : initialize()">Reload</button>
            <button type="button" @click="close">Close</button>
            <span role="status">{{ voiceLoading ? "Loading voices" : status }}</span>
        </header>
        <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
        <p v-else-if="selected?.voices" class="hint">Click the character to cycle its three voice lines.</p>
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

input, select, button {
    padding: 6px 12px;
    color: inherit;
    background: #374151;
    border: 1px solid #6b7280;
    border-radius: 6px;
}

input {
    flex: 1 1 220px;
    min-width: 0;
}

select {
    max-width: min(420px, 100%);
}

button {
    cursor: pointer;
}

.hint {
    margin: 0;
    font-size: 14px;
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
