<script setup lang="ts">
import type { CutscenePreviewEntry } from "@/data/loadCutscenePreviewIndex";

import icons from "@/utils/charIcons";
import SettingsModal from "@/components/SettingsModal.vue";
import ChangelogModal from "@/components/ChangelogModal.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import BgUploadIcon from "@/components/icons/BgUploadIcon.vue";
import KoFiIcon from "@/components/icons/KoFiIcon.vue";
import PatreonIcon from "@/components/icons/PatreonIcon.vue";
import SettingsIcon from "@/components/icons/SettingsIcon.vue";
import ChangelogIcon from "@/components/icons/ChangelogIcon.vue";
import GithubIcon from "@/components/icons/GithubIcon.vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import MinusIcon from "@/components/icons/MinusIcon.vue";
import InspectAnimationIcon from "@/components/icons/InspectAnimationIcon.vue";
import LayerSelectIcon from "@/components/icons/LayerSelectIcon.vue";

import { loadStandingPreviewIndex, type StandingPreviewEntry } from "@/data/loadStandingPreviewIndex";
import { loadUltimateOptions } from "@/data/loadUltimateOptions";
import { useStandingPlayer } from "@/composables/useStandingPlayer";
import { useCutscenePlayer } from "@/composables/useCutscenePlayer";
import { useViewerStore } from "@/stores/viewerStore";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const store = useViewerStore();
const host = ref<HTMLDivElement | null>(null);
const items = ref<StandingPreviewEntry[]>([]);
const aliases = ref<Record<string, string>>({});
const search = ref("");
const category = ref("all");
const catalogError = ref("");
const settingsOpen = ref(false);
const changelogOpen = ref(false);
const mobileOpen = ref(false);
const background = ref("#1f2937");
const colorInput = ref<HTMLInputElement | null>(null);
const filtersDialog = ref<HTMLDialogElement | null>(null);
const ultimateById = ref(new Map<string, CutscenePreviewEntry[]>());
const ultimateOnly = ref(false);
const position = ref(0);
const scrubbing = ref(false);

let request: AbortController | undefined;

const selected = computed(() => items.value.find((item) => item.id === store.selectedId));
const ultimateOptions = computed(() => ultimateById.value.get(store.selectedId) ?? []);
const isUltimate = computed(() => store.mode === "ultimate");
const standingEntry = computed(() => isUltimate.value ? undefined : selected.value);
const ultimateEntry = computed(() => isUltimate.value ? ultimateOptions.value.find((item) => item.id === store.ultimateId) : undefined);
const standing = useStandingPlayer(host, standingEntry);
const cutscene = useCutscenePlayer(host, ultimateEntry);
const status = computed(() => isUltimate.value ? cutscene.status.value : standing.status.value);
const error = computed(() => isUltimate.value ? cutscene.error.value : standing.error.value);
const { animations, skins, voiceLoading } = standing;
const ready = computed(() => status.value === "Ready");
const playing = computed(() => isUltimate.value ? cutscene.state.value.playing : store.playing);
const duration = computed(() => cutscene.state.value.duration);

const player = {
    reload: () => isUltimate.value ? cutscene.reload() : standing.reload(),
    zoomBy: (factor: number) => isUltimate.value ? cutscene.zoomBy(factor) : standing.zoomBy(factor),
    resetView: () => isUltimate.value ? cutscene.resetView() : standing.resetView()
};

const filtered = computed(() => {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return items.value.filter((item) => {
        if (category.value !== "all" && item.kind !== category.value)
            return false;
        if (ultimateOnly.value && !ultimateById.value.has(item.id))
            return false;

        const oldIds = Object.keys(aliases.value).filter((id) => aliases.value[id] === item.id);
        const text = `${item.label} ${item.id} ${oldIds.join(" ")}`.toLowerCase();

        return terms.every((term) => text.includes(term));
    });
});

function selectModel(id: string) {
    store.select(id);
    mobileOpen.value = false;
}

function selectMode(value: string) {
    if (value === "ultimate" && ultimateOptions.value.length > 0)
    {
        store.ultimateId = ultimateOptions.value[0].id;
        store.mode = "ultimate";
    }
    else
    {
        store.mode = "character";
    }

    mobileOpen.value = false;
}

function optionLabel(option: CutscenePreviewEntry) {
    if (option.variant === "cutscene")
        return "Full cutscene";

    const loops = ultimateOptions.value.filter((item) => item.variant === "loop");
    return `Loop ${loops.findIndex((item) => item.id === option.id) + 1}`;
}

function selectUltimate(id: string) {
    store.ultimateId = id;
    mobileOpen.value = false;
}

function resetFilters() {
    category.value = "all";
    ultimateOnly.value = false;
}

function toggle() {
    if (isUltimate.value)
        void cutscene.toggle();
    else
        store.playing = !store.playing;
}

function seek() {
    scrubbing.value = false;
    void cutscene.seek(position.value);
}

async function initialize() {
    request?.abort();

    const current = new AbortController();
    request = current;
    catalogError.value = "";

    try
    {
        const index = await loadStandingPreviewIndex(current.signal);
        current.signal.throwIfAborted();

        const options = await loadUltimateOptions(index, current.signal);
        current.signal.throwIfAborted();

        const params = new URLSearchParams(window.location.search);
        const id = params.get("char") ?? store.selectedId;
        const canonical = index.aliases[id] ?? id;
        const selectedId = index.items.some((item) => item.id === canonical) ? canonical : index.defaultId;
        const choices = options.get(selectedId) ?? [];
        const requested = params.get("anim");
        const full = choices.find((item) => item.variant === "cutscene");
        const loop = choices.find((item) => item.variant === "loop");
        const choice = choices.find((item) => item.id === requested) ?? (requested === "loop" ? loop : full);
        const ultimate = params.get("type") === "ultimate" && choice !== undefined;

        store.$patch({
            selectedId,
            mode: ultimate ? "ultimate" : "character",
            ultimateId: ultimate ? choice.id : "",
            animation: ultimate ? "" : params.get("anim") ?? "",
            skin: ultimate ? "" : params.get("skin") ?? ""
        });

        ultimateById.value = options;
        aliases.value = index.aliases;
        items.value = index.items;
    }
    catch (reason)
    {
        if (!current.signal.aborted)
            catalogError.value = reason instanceof Error ? reason.message : String(reason);
    }
}

watch(() => cutscene.state.value.time, (time) => {
    if (!scrubbing.value)
        position.value = time;
});

watch(ultimateEntry, () => {
    scrubbing.value = false;
}, { flush: "sync" });

watch([() => store.selectedId, () => store.animation, () => store.skin, () => store.mode, () => store.ultimateId], () => {
    if (!selected.value)
        return;

    const url = new URL(window.location.href);
    url.searchParams.set("char", store.selectedId);
    url.searchParams.set("type", store.mode);

    for (const [key, value] of [["anim", isUltimate.value ? store.ultimateId : store.animation], ["skin", isUltimate.value ? "" : store.skin]])
    {
        if (value)
            url.searchParams.set(key, value);
        else
            url.searchParams.delete(key);
    }

    history.replaceState(history.state, "", url);
}, { flush: "post" });

onMounted(initialize);
onBeforeUnmount(() => request?.abort());
</script>

<template>
    <main class="viewer grid h-dvh grid-rows-[auto_minmax(0,1fr)] bg-gray-900 font-sans text-white">
        <header class="navbar flex items-center justify-between gap-4 bg-black p-4 max-lg:gap-2 max-lg:p-2">
            <h1 class="text-3xl font-bold max-lg:text-lg">Brown Dust 2 L2D Viewer</h1>
            <nav class="nav-actions flex items-center gap-3" aria-label="Site navigation">
                <button class="desktop-action" type="button" aria-label="Upload Spine" title="Upload is not yet available" disabled><PlusIcon /></button>
                <button class="desktop-action" type="button" aria-label="Upload background" title="Background upload is not yet available" disabled><BgUploadIcon /></button>
                <a class="desktop-action" href="https://ko-fi.com/jelosus1" target="_blank" rel="noopener" aria-label="Ko-fi"><KoFiIcon /></a>
                <a class="desktop-action" href="https://www.patreon.com/cw/jelosus1" target="_blank" rel="noopener" aria-label="Patreon"><PatreonIcon /></a>
                <button type="button" aria-label="Settings" @click="settingsOpen = true"><SettingsIcon /></button>
                <button class="desktop-action" type="button" aria-label="Changelog" @click="changelogOpen = true"><ChangelogIcon /></button>
                <a class="desktop-action" href="https://github.com/Jelosus2/BD2-L2D-Viewer" target="_blank" rel="noopener" aria-label="GitHub"><GithubIcon /></a>
                <button class="mobile-toggle" type="button" :aria-label="mobileOpen ? 'Close controls' : 'Open controls'" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen">
                    <span v-if="mobileOpen">&times;</span>
                    <MenuIcon v-else />
                </button>
            </nav>
        </header>

        <div class="workspace grid min-h-0 grid-cols-[16rem_minmax(0,1fr)_20rem] max-lg:grid-cols-1" :class="{ 'mobile-open': mobileOpen }">
            <aside class="controls-sidebar flex min-h-0 min-w-0 flex-col gap-3 bg-gray-800 p-2" aria-label="Animation controls">
                <div class="tabs flex self-start gap-1 rounded-md bg-gray-700 p-1">
                    <button class="active" type="button">Controls</button>
                    <button type="button" title="Layers are not yet available" disabled>Layers</button>
                </div>

                <label class="field flex flex-col gap-2">
                    Skins
                    <select v-model="store.skin" :disabled="!ready || isUltimate" aria-label="Skin">
                        <option value="">default</option>
                        <option v-for="skin in skins.filter((name) => name !== 'default')" :key="skin" :value="skin">{{ skin }}</option>
                    </select>
                </label>

                <div class="animation-section flex min-h-0 flex-1 flex-col gap-2">
                    <span>Animations</span>
                    <div class="animation-list overflow-y-auto sidebar-scroll" role="group" aria-label="Animations">
                        <template v-if="isUltimate">
                            <button v-for="option in ultimateOptions" :key="option.id" type="button" :aria-pressed="store.ultimateId === option.id" @click="selectUltimate(option.id)">{{ optionLabel(option) }}</button>
                        </template>
                        <template v-else>
                            <button type="button" :disabled="!ready" :aria-pressed="store.animation === ''" @click="store.animation = ''">Default playback</button>
                            <button v-for="animation in animations" :key="animation" type="button" :disabled="!ready" :aria-pressed="store.animation === animation" @click="store.animation = animation">{{ animation }}</button>
                        </template>
                    </div>
                </div>

                <div class="controls-bottom mt-auto flex flex-col gap-2">
                    <label class="field flex flex-col gap-2">
                        Animation Category
                        <select :value="store.mode" aria-label="Animation category" @change="selectMode(($event.target as HTMLSelectElement).value)">
                            <option value="character">Character</option>
                            <option value="ultimate" :disabled="!ultimateOptions.length">Ultimate</option>
                            <option value="dating" disabled>Fated Guest</option>
                        </select>
                    </label>

                    <label class="field flex flex-col gap-2">
                        Animation Speed
                        <span class="speed-control flex items-center gap-2">
                            <input v-model.number="store.speed" :disabled="!ready" type="range" min="0.1" max="2" step="0.05">
                            <span>{{ store.speed.toFixed(2) }}x</span>
                        </span>
                    </label>

                    <div class="button-row flex items-center gap-2">
                        <button type="button" :disabled="!ready" @click="player.resetView">Reset View</button>
                        <button class="primary" type="button" :disabled="!ready" @click="toggle">{{ playing ? "Pause" : "Play" }}</button>
                    </div>

                    <button type="button" @click="colorInput?.click()">BG Color</button>
                    <input ref="colorInput" v-model="background" type="color" aria-label="Background color" hidden>

                    <div class="button-row pending-control flex items-center gap-2">
                        <button type="button" title="Screenshots are not yet available" disabled>Screenshot</button>
                        <label class="checkbox-label flex items-center gap-1 text-xs"><input type="checkbox" disabled> Transparent image/export</label>
                    </div>

                    <button class="pending-control" type="button" title="Animation export is not yet available" disabled>Export Animation</button>
                    <label class="checkbox-label pending-control flex items-center gap-1 text-xs"><input type="checkbox" disabled> Use current camera in image/export</label>
                </div>

                <nav class="mobile-links flex-wrap gap-4 p-2 text-sm" aria-label="More links">
                    <a href="https://github.com/Jelosus2/BD2-L2D-Viewer" target="_blank" rel="noopener">GitHub</a>
                    <a href="https://ko-fi.com/jelosus1" target="_blank" rel="noopener">Ko-fi</a>
                    <button type="button" @click="changelogOpen = true">Changelog</button>
                </nav>
            </aside>

            <section class="stage min-h-0 min-w-0 p-2" :aria-label="selected?.label ?? 'Animation viewer'">
                <div class="canvas-frame relative h-full w-full overflow-hidden" :style="{ backgroundColor: background }">
                    <div ref="host" class="canvas-host absolute inset-0"></div>

                    <div class="canvas-tools absolute top-2 left-3 z-10 flex items-center gap-2">
                        <button type="button" aria-label="Inspect animation" title="Inspect mode is not yet available" disabled><InspectAnimationIcon :active="false" /></button>
                        <button type="button" aria-label="Select layers" title="Layers are not yet available" disabled><LayerSelectIcon :active="false" /></button>
                        <button type="button" :disabled="!ready" aria-label="Zoom out" @click="player.zoomBy(1 / 1.2)"><MinusIcon /></button>
                        <button type="button" :disabled="!ready" aria-label="Zoom in" @click="player.zoomBy(1.2)"><PlusIcon /></button>
                    </div>

                    <div v-if="!ready" class="message absolute inset-0 z-20 flex flex-wrap items-center justify-center gap-4 bg-gray-900 p-4" role="status">
                        {{ error || catalogError || "Loading model…" }}
                        <button v-if="error" type="button" @click="player.reload">Retry model</button>
                    </div>

                    <template v-if="isUltimate && ready">
                        <input
                            v-if="duration !== null"
                            v-model.number="position"
                            class="absolute right-3 bottom-2 left-3 z-10 accent-purple-400"
                            type="range"
                            min="0"
                            :max="duration"
                            step="0.001"
                            aria-label="Cutscene position"
                            @pointerdown="scrubbing = true"
                            @input="scrubbing = true"
                            @change="seek"
                            @pointercancel="scrubbing = false"
                        >
                        <span class="pointer-events-none absolute right-3 bottom-8 z-10 rounded bg-black/60 px-2 text-xs" aria-label="Cutscene time">
                            {{ cutscene.state.value.time.toFixed(2) }} / {{ duration === null ? "∞" : duration.toFixed(2) }} s
                        </span>
                    </template>
                </div>

                <span class="sr-only" role="status">{{ voiceLoading ? "Loading voices" : status }}</span>
            </section>

            <aside class="character-sidebar flex min-h-0 min-w-0 flex-col bg-gray-800" aria-label="Standing models">
                <div class="search-row mb-2 flex gap-2">
                    <input v-model="search" type="search" placeholder="Search..." aria-label="Search models">
                    <button type="button" aria-label="Filter characters" :class="{ filtered: category !== 'all' || ultimateOnly }" @click="filtersDialog?.showModal()">
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h18M6 12h12M10 19h4" /></svg>
                    </button>
                </div>

                <p v-if="catalogError" class="catalog-error p-2" role="alert">
                    {{ catalogError }}
                    <button type="button" @click="initialize">Retry catalog</button>
                </p>

                <div class="model-list flex-1 overflow-y-auto px-2 sidebar-scroll">
                    <button v-for="item in filtered" :key="item.id" class="character-row flex min-h-20 w-full items-center gap-2 rounded p-2 text-left" type="button" :aria-pressed="item.id === store.selectedId" @click="selectModel(item.id)">
                        <img :src="icons[item.id] || icons.unknown" class="size-16 shrink-0 rounded-full object-cover" alt="" width="64" height="64" loading="lazy" decoding="async">
                        <span class="min-w-0 text-lg">{{ item.label }}</span>
                        <span v-if="ultimateById.has(item.id)" class="ml-auto shrink-0 rounded bg-purple-500 px-2 text-xs font-bold">U</span>
                    </button>
                    <p v-if="items.length && !filtered.length">No characters found.</p>
                </div>
            </aside>
        </div>

        <dialog ref="filtersDialog" class="filters m-auto rounded border border-gray-700 bg-gray-800 p-4 text-white" aria-labelledby="filters-title">
            <h2 id="filters-title" class="mb-4 text-lg font-semibold">Filters</h2>
            <button type="button" :aria-pressed="ultimateOnly" @click="ultimateOnly = !ultimateOnly">Ultimate animations</button>
            <button type="button" :aria-pressed="category === 'character'" @click="category = category === 'character' ? 'all' : 'character'">Playable characters</button>
            <button type="button" :aria-pressed="category === 'npc'" @click="category = category === 'npc' ? 'all' : 'npc'">NPCs &amp; dialogue</button>
            <button type="button" :disabled="category === 'all' && !ultimateOnly" @click="resetFilters">Reset filters</button>
            <button type="button" @click="filtersDialog?.close()">Close</button>
        </dialog>

        <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
        <ChangelogModal v-if="changelogOpen" @close="changelogOpen = false" />
    </main>
</template>

<style scoped>
.nav-actions button,
.nav-actions a,
.canvas-tools button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
}

svg {
    width: 1.5rem;
    height: 1.5rem;
}

.nav-actions :deep(svg) {
    width: 1.75rem;
    height: 1.75rem;
}

.tabs button {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
}

.tabs .active {
    background: #4b5563;
}

.animation-list button {
    display: block;
    width: 100%;
    padding: 0.5rem;
    text-align: left;
}

.animation-list button[aria-pressed="true"],
.character-row[aria-pressed="true"] {
    background: #374151;
}

select,
.search-row input {
    min-width: 0;
    width: 100%;
    background: #374151;
    color: white;
}

.speed-control input {
    flex: 1;
    min-width: 0;
    accent-color: #facc15;
}

.speed-control span {
    min-width: 3rem;
    text-align: right;
}

.controls-bottom button,
.filters button {
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    background: #4b5563;
}

.button-row button {
    flex: 1;
}

.controls-bottom .primary {
    background: #4f35f4;
}

.canvas-host :deep(canvas) {
    display: block;
}

.message,
.catalog-error,
.character-row span {
    overflow-wrap: anywhere;
}

.search-row input {
    flex: 1;
    padding: 0.5rem;
}

.search-row button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    background: #374151;
    border-radius: 0.25rem;
}

.filtered {
    color: #a5b4fc;
}

.filters {
    width: min(24rem, calc(100% - 2rem));
}

.filters::backdrop {
    background: rgb(0 0 0 / 60%);
}

.filters button {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    text-align: left;
}

.filters button[aria-pressed="true"] {
    outline: 1px solid #a5b4fc;
}

button {
    cursor: pointer;
}

button:disabled {
    opacity: 0.45;
    cursor: default;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 2px;
}

.mobile-toggle,
.mobile-links {
    display: none !important;
}

@media (max-width: 1151px) {
    .desktop-action {
        display: none !important;
    }

    .mobile-toggle,
    .mobile-links {
        display: flex !important;
    }

    .controls-sidebar,
    .character-sidebar {
        display: none;
    }

    .mobile-open {
        grid-template-rows: minmax(0, 45%) minmax(0, 1fr);
    }

    .mobile-open .controls-sidebar,
    .mobile-open .character-sidebar {
        display: flex;
    }

    .mobile-open .stage {
        display: none;
    }

    .controls-sidebar {
        overflow-y: auto;
    }

    .animation-section {
        flex: none;
    }

    .animation-list {
        max-height: 6rem;
    }

    .pending-control {
        display: none !important;
    }

    .nav-actions :deep(svg) {
        width: 1.25rem;
        height: 1.25rem;
    }
}
</style>
