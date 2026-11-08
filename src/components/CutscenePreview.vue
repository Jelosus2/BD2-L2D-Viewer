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
    },
    "locator-position": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000204_loop_3.json",
        variant: "loop",
    },
    "locator-scale": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000801_loop.json",
        variant: "loop",
    },
    "locator-fallback": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004192_loop.json",
        variant: "loop",
    },
    "depth-003801": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003801_loop.json",
        variant: "loop",
    },
    "depth-000306": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000306_loop_2.json",
        variant: "loop",
    },
    "depth-003403": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003403_loop.json",
        variant: "loop",
    },
    "receiver-000501": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000501_loop.json",
        variant: "loop",
    },
    "receiver-003892": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003892_loop_3.json",
        variant: "loop",
    },
    "receiver-067604": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067604_loop_2.json",
        variant: "loop",
    },
    "disabled-000203": {
        catalogUrl: "data/cutscene/prototype/CutScene000203.json",
        variant: "cutscene",
    },
    "disabled-001002": {
        catalogUrl: "data/cutscene/prototype/CutScene001002.json",
        variant: "cutscene",
    },
    "disabled-004102": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004102_loop.json",
        variant: "loop",
    },
        "director-000806": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000806_loop.json",
        variant: "loop",
    },
    "director-000806-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000806_loop_2.json",
        variant: "loop",
    },
        "property-003501": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003501_loop_2.json",
        variant: "loop",
    },
    "property-003601": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003601_loop.json",
        variant: "loop",
    },
    "property-066403": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene066403_loop.json",
        variant: "loop",
    },
        "spine-003392": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003392_loop.json",
        variant: "loop",
    },
    "spine-021291": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene021291_loop.json",
        variant: "loop",
    },
    "control-101103": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene101103_loop.json",
        variant: "loop",
    },
    "loop-067502": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067502_loop.json",
        variant: "loop",
    },
    "loop-003303": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003303_loop.json",
        variant: "loop",
    },
    "loop2-067502": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067502_loop_2.json",
        variant: "loop",
    },
    "loop2-067503": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067503_loop_2.json",
        variant: "loop",
    },
    "multiply-000206": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000206_loop.json",
        variant: "loop",
    },
    "multiply-000206-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000206_loop_2.json",
        variant: "loop",
    },
    "partial-061002": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061002_loop.json",
        variant: "loop",
    },
    "partial-061002-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061002_loop_2.json",
        variant: "loop",
    },
    "partial-061404": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061404_loop.json",
        variant: "loop",
    },
    "partial-061404-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061404_loop_2.json",
        variant: "loop",
    },
    "partial-101102": {
        catalogUrl: "data/cutscene/prototype/CutScene101102.json",
        variant: "cutscene",
    },
    "partial-101102-loop": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene101102_loop.json",
        variant: "loop",
    },
    "ui-001101": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene001101_loop.json",
        variant: "loop",
    },
    "ui-001101-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene001101_loop_2.json",
        variant: "loop",
    },
    "ui-003202": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003202_loop.json",
        variant: "loop",
    },
    "ui-003202-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003202_loop_2.json",
        variant: "loop",
    },
    "fallback-060502": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene060502_loop.json",
        variant: "loop",
    },
    "fallback-101101": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene101101_loop.json",
        variant: "loop",
    },
    "group-000504": {
        catalogUrl: "data/cutscene/prototype/CutScene000504.json",
        variant: "cutscene",
    },
    "overlap-101101": {
        catalogUrl: "data/cutscene/prototype/CutScene101101.json",
        variant: "cutscene",
    },
    "overlap-001207": {
        catalogUrl: "data/cutscene/prototype/CutScene001207.json",
        variant: "cutscene",
    },
    "root-101102-loop-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene101102_loop_2.json",
        variant: "loop",
    },
    "root-002403": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene002403_loop.json",
        variant: "loop",
    },
    "root-021001": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene021001_loop.json",
        variant: "loop",
    },
    "root-021001-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene021001_loop_2.json",
        variant: "loop",
    },
    "root-021301": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene021301_loop.json",
        variant: "loop",
    },
    "root-021301-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene021301_loop_2.json",
        variant: "loop",
    },
    "root-066403-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene066403_loop_2.json",
        variant: "loop",
    },
    "root-066801-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene066801_loop_2.json",
        variant: "loop",
    },
    "root-103201-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene103201_loop_2.json",
        variant: "loop",
    },
    "root-103401-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene103401_loop_2.json",
        variant: "loop",
    },
    "director-full-000206": {
        catalogUrl: "data/cutscene/prototype/CutScene000206.json",
        variant: "cutscene",
    },
    "director-full-000301": {
        catalogUrl: "data/cutscene/prototype/CutScene000301.json",
        variant: "cutscene",
    },
    "mobile-061305": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061305_loop.json",
        variant: "loop",
    },
    "mobile-061305-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061305_loop_2.json",
        variant: "loop",
    },
    "control-full-061305": {
        catalogUrl: "data/cutscene/prototype/CutScene061305.json",
        variant: "cutscene",
    },
    "control-full-067301": {
        catalogUrl: "data/cutscene/prototype/CutScene067301.json",
        variant: "cutscene",
    },
    "pma-000401": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000401_loop.json",
        variant: "loop",
    },
    "pma-full-060601": {
        catalogUrl: "data/cutscene/prototype/CutScene060601.json",
        variant: "cutscene",
    },
    "pma-default-103301": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene103301_loop.json",
        variant: "loop",
    },
    "hierarchy-001092": {
        catalogUrl: "data/cutscene/prototype/CutScene001092.json",
        variant: "cutscene",
    },
    "hierarchy-004302": {
        catalogUrl: "data/cutscene/prototype/CutScene004302.json",
        variant: "cutscene",
    },
    "clip-in-001006": {
        catalogUrl: "data/cutscene/prototype/CutScene001006.json",
        variant: "cutscene",
    },
    "clip-in-021101": {
        catalogUrl: "data/cutscene/prototype/CutScene021101.json",
        variant: "cutscene",
    },
    "canvas-alpha-000807": {
        catalogUrl: "data/cutscene/prototype/CutScene000807.json",
        variant: "cutscene",
    },
    "canvas-alpha-003601-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003601_loop_2.json",
        variant: "loop",
    },
    "pivot-003392": {
        catalogUrl: "data/cutscene/prototype/CutScene003392.json",
        variant: "cutscene",
    },
    "particle-000201": {
        catalogUrl: "data/cutscene/prototype/CutScene000201.json",
        variant: "cutscene",
    },
    "particle-061492-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene061492_loop_2.json",
        variant: "loop",
    },
    "sprite-000304": {
        catalogUrl: "data/cutscene/prototype/CutScene000304.json",
        variant: "cutscene",
    },
    "sprite-000604-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000604_loop.json",
        variant: "loop",
    },
    "sprite-000604-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000604_loop_2.json",
        variant: "loop",
    },
    "sprite-000706-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000706_loop.json",
        variant: "loop",
    },
    "sprite-000706-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000706_loop_2.json",
        variant: "loop",
    },
    "sprite-000706-3": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000706_loop_3.json",
        variant: "loop",
    },
    "depth-full-000396": {
        catalogUrl: "data/cutscene/prototype/CutScene000396.json",
        variant: "cutscene",
    },
    "depth-scale-full-004192": {
        catalogUrl: "data/cutscene/prototype/CutScene004192.json",
        variant: "cutscene",
    },
    "rect-local-003403": {
        catalogUrl: "data/cutscene/prototype/CutScene003403.json",
        variant: "cutscene",
    },
    "game-time-020801": {
        catalogUrl: "data/cutscene/prototype/CutScene020801.json",
        variant: "cutscene",
    },
    "uv-067504-loop": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067504_loop.json",
        variant: "loop",
    },
    "batch01-lathel-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000103_loop.json",
        variant: "loop",
    },
    "batch01-lathel-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000103_loop_2.json",
        variant: "loop",
    },
    "batch01-eclipse": {
        catalogUrl: "data/cutscene/prototype/CutScene000707.json",
        variant: "cutscene",
    },
    "batch01-rafina": {
        catalogUrl: "data/cutscene/prototype/CutScene060706.json",
        variant: "cutscene",
    },
    "batch01-refithea": {
        catalogUrl: "data/cutscene/prototype/CutScene066802.json",
        variant: "cutscene",
    },
    "batch02-teresse-3": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene001107_loop_3.json",
        variant: "loop",
    },
    "batch02-liberta-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003802_loop_2.json",
        variant: "loop",
    },
    "batch02-darian": {
        catalogUrl: "data/cutscene/prototype/CutScene004002.json",
        variant: "cutscene",
    },
    "batch02-tyr-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004101_loop.json",
        variant: "loop",
    },
    "batch02-tyr-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004101_loop_2.json",
        variant: "loop",
    },
    "batch02-helena": {
        catalogUrl: "data/cutscene/prototype/CutScene061002.json",
        variant: "cutscene",
    },
    "batch02-michaela-beach": {
        catalogUrl: "data/cutscene/prototype/CutScene067401.json",
        variant: "cutscene",
    },
    "batch02-michaela-beach-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067401_loop_2.json",
        variant: "loop",
    },
    "batch02-michaela-queen-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067402_loop_2.json",
        variant: "loop",
    },
    "batch03-loen": {
        catalogUrl: "data/cutscene/prototype/CutScene003201.json",
        variant: "cutscene",
    },
    "batch03-tyr": {
        catalogUrl: "data/cutscene/prototype/CutScene004101.json",
        variant: "cutscene",
    },
    "batch03-palette-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004201_loop.json",
        variant: "loop",
    },
    "batch03-palette-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004201_loop_2.json",
        variant: "loop",
    },
    "batch03-palette-3": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004201_loop_3.json",
        variant: "loop",
    },
    "batch03-zenith": {
        catalogUrl: "data/cutscene/prototype/CutScene061402.json",
        variant: "cutscene",
    },
    "batch03-nartas": {
        catalogUrl: "data/cutscene/prototype/CutScene065802.json",
        variant: "cutscene",
    },
    "batch03-angelica": {
        catalogUrl: "data/cutscene/prototype/CutScene066402.json",
        variant: "cutscene",
    },
    "batch03-granadair": {
        catalogUrl: "data/cutscene/prototype/CutScene067701.json",
        variant: "cutscene",
    },
    "batch04-olivier-full": {
        catalogUrl: "data/cutscene/prototype/CutScene003604.json",
        variant: "cutscene",
    },
    "batch04-olivier-loop": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003604_loop.json",
        variant: "loop",
    },
    "batch04-palette": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene004202_loop.json",
        variant: "loop",
    },
    "batch04-goblin-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene020601_loop.json",
        variant: "loop",
    },
    "batch04-goblin-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene020601_loop_2.json",
        variant: "loop",
    },
    "batch04-yuri": {
        catalogUrl: "data/cutscene/prototype/CutScene065193.json",
        variant: "cutscene",
    },
    "batch04-aquila": {
        catalogUrl: "data/cutscene/prototype/CutScene067902.json",
        variant: "cutscene",
    },
    "batch05-rou": {
        catalogUrl: "data/cutscene/prototype/CutScene000501.json",
        variant: "cutscene",
    },
    "batch05-olivier": {
        catalogUrl: "data/cutscene/prototype/CutScene003603.json",
        variant: "cutscene",
    },
    "batch05-blade": {
        catalogUrl: "data/cutscene/prototype/CutScene003701.json",
        variant: "cutscene",
    },
    "batch05-hikage": {
        catalogUrl: "data/cutscene/prototype/CutScene020501.json",
        variant: "cutscene",
    },
    "batch05-tenka": {
        catalogUrl: "data/cutscene/prototype/CutScene021201.json",
        variant: "cutscene",
    },
    "batch05-rafina": {
        catalogUrl: "data/cutscene/prototype/CutScene060701.json",
        variant: "cutscene",
    },
    "batch05-elise": {
        catalogUrl: "data/cutscene/prototype/CutScene060802.json",
        variant: "cutscene",
    },
    "batch06-nebris": {
        catalogUrl: "data/cutscene/prototype/CutScene003303.json",
        variant: "cutscene",
    },
    "batch06-morpeah": {
        catalogUrl: "data/cutscene/prototype/CutScene003402.json",
        variant: "cutscene",
    },
    "batch06-blade": {
        catalogUrl: "data/cutscene/prototype/CutScene003703.json",
        variant: "cutscene",
    },
    "batch06-liberta": {
        catalogUrl: "data/cutscene/prototype/CutScene003801.json",
        variant: "cutscene",
    },
    "batch06-priestess": {
        catalogUrl: "data/cutscene/prototype/CutScene020701.json",
        variant: "cutscene",
    },
    "batch06-ventana": {
        catalogUrl: "data/cutscene/prototype/CutScene067004.json",
        variant: "cutscene",
    },
    "batch06-venaka": {
        catalogUrl: "data/cutscene/prototype/CutScene067202.json",
        variant: "cutscene",
    },
    "batch06-luvencia": {
        catalogUrl: "data/cutscene/prototype/CutScene067503.json",
        variant: "cutscene",
    },
    "batch07-morpeah-loop": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003402_loop.json",
        variant: "loop",
    },
    "batch07-liberta": {
        catalogUrl: "data/cutscene/prototype/CutScene003892.json",
        variant: "cutscene",
    },
    "batch07-eleaneer": {
        catalogUrl: "data/cutscene/prototype/CutScene061101.json",
        variant: "cutscene",
    },
    "batch07-granadair": {
        catalogUrl: "data/cutscene/prototype/CutScene067702.json",
        variant: "cutscene",
    },
    "batch07-mamonir": {
        catalogUrl: "data/cutscene/prototype/CutScene067801.json",
        variant: "cutscene",
    },
    "batch07-aquila-loop": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067902_loop.json",
        variant: "loop",
    },
    "batch08-eclipse-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene000708_loop_2.json",
        variant: "loop",
    },
    "batch08-liberta": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene003803_loop.json",
        variant: "loop",
    },
    "batch08-ren": {
        catalogUrl: "data/cutscene/prototype/CutScene021301.json",
        variant: "cutscene",
    },
    "batch08-elise-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene060804_loop.json",
        variant: "loop",
    },
    "batch08-elise-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene060804_loop_2.json",
        variant: "loop",
    },
    "batch08-dalvi": {
        catalogUrl: "data/cutscene/prototype/CutScene061392.json",
        variant: "cutscene",
    },
    "batch08-ventana-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067002_loop_2.json",
        variant: "loop",
    },
    "batch08-mamonir-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene067803_loop_2.json",
        variant: "loop",
    },
    "batch08-wiggle": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene100501_loop.json",
        variant: "loop",
    },
    "batch09-eris-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene020002_loop.json",
        variant: "loop",
    },
    "batch09-eris-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene020002_loop_2.json",
        variant: "loop",
    },
    "batch09-roxy": {
        catalogUrl: "data/cutscene/prototype/CutScene020102.json",
        variant: "cutscene",
    },
    "batch09-angelica": {
        catalogUrl: "data/cutscene/prototype/CutScene066403.json",
        variant: "cutscene",
    },
    "update-liatris-full": {
        catalogUrl: "data/cutscene/prototype/CutScene001297.json",
        variant: "cutscene",
    },
    "update-liatris-loop-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene001297_loop.json",
        variant: "loop",
    },
    "update-liatris-loop-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene001297_loop_2.json",
        variant: "loop",
    },
    "update-valze-full": {
        catalogUrl: "data/cutscene/prototype/CutScene068001.json",
        variant: "cutscene",
    },
    "update-valze-loop-1": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene068001_loop.json",
        variant: "loop",
    },
    "update-valze-loop-2": {
        catalogUrl: "data/cutscene-loop/prototype/CutScene068001_loop_2.json",
        variant: "loop",
    },
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
                <option value="locator-position">000204 — Loop 3</option>
                <option value="locator-scale">000801 — Loop</option>
                <option value="locator-fallback">004192 — Loop</option>
                <option value="depth-003801">003801 - Loop</option>
                <option value="depth-000306">000306 - Loop 2</option>
                <option value="depth-003403">003403 - Loop</option>
                <option value="receiver-000501">000501 - Loop</option>
                <option value="receiver-003892">003892 - Loop 3</option>
                <option value="receiver-067604">067604 - Loop 2</option>
                <option value="disabled-000203">000203 - Full cutscene</option>
                <option value="disabled-001002">001002 - Full cutscene</option>
                <option value="disabled-004102">004102 - Loop</option>
                <option value="director-000806">000806 - Loop 1</option>
                <option value="director-000806-2">000806 - Loop 2</option>
                <option value="property-003501">003501 - Loop 2</option>
                <option value="property-003601">003601 - Loop</option>
                <option value="property-066403">066403 - Loop</option>
                <option value="spine-003392">003392 - Loop</option>
                <option value="spine-021291">021291 - Loop</option>
                <option value="control-101103">101103 - Loop</option>
                <option value="loop-067502">067502 - Loop</option>
                <option value="loop-003303">003303 - Loop</option>
                <option value="loop2-067502">067502 - Loop 2</option>
                <option value="loop2-067503">067503 - Loop 2</option>
                <option value="multiply-000206">000206 - Loop 1</option>
                <option value="multiply-000206-2">000206 - Loop 2</option>
                <option value="partial-061002">061002 - Loop</option>
                <option value="partial-061002-2">061002 - Loop 2</option>
                <option value="partial-061404">061404 - Loop 1</option>
                <option value="partial-061404-2">061404 - Loop 2</option>
                <option value="partial-101102">101102 - Full cutscene</option>
                <option value="partial-101102-loop">101102 - Loop</option>
                <option value="ui-001101">001101 - Loop 1</option>
                <option value="ui-001101-2">001101 - Loop 2</option>
                <option value="ui-003202">003202 - Loop 1</option>
                <option value="ui-003202-2">003202 - Loop 2</option>
                <option value="fallback-060502">060502 - Loop</option>
                <option value="fallback-101101">101101 - Loop</option>
                <option value="group-000504">000504 - Full cutscene</option>
                <option value="overlap-101101">101101 - Full cutscene</option>
                <option value="overlap-001207">001207 - Full cutscene</option>
                <option value="root-101102-loop-2">101102 - Loop 2</option>
                <option value="root-002403">002403 - Loop</option>
                <option value="root-021001">021001 - Loop 1</option>
                <option value="root-021001-2">021001 - Loop 2</option>
                <option value="root-021301">021301 - Loop 1</option>
                <option value="root-021301-2">021301 - Loop 2</option>
                <option value="root-066403-2">066403 - Loop 2</option>
                <option value="root-066801-2">066801 - Loop 2</option>
                <option value="root-103201-2">103201 - Loop 2</option>
                <option value="root-103401-2">103401 - Loop 2</option>
                <option value="director-full-000206">000206 - Full cutscene</option>
                <option value="director-full-000301">000301 - Full cutscene</option>
                <option value="mobile-061305">061305 - Loop 1</option>
                <option value="mobile-061305-2">061305 - Loop 2</option>
                <option value="control-full-061305">061305 - Full cutscene</option>
                <option value="control-full-067301">067301 - Full cutscene</option>
                <option value="pma-000401">000401 - Loop 1</option>
                <option value="pma-full-060601">060601 - Full cutscene</option>
                <option value="pma-default-103301">103301 - Loop 1</option>
                <option value="hierarchy-001092">Sylvia: Crimson Lotus - Full cutscene</option>
                <option value="hierarchy-004302">Nekyndalia: Unraveling Mummy - Full cutscene</option>
                <option value="clip-in-001006">Sylvia: Bikini Agent - Full cutscene</option>
                <option value="clip-in-021101">Kyouka Uzen: Eternal Chains - Full cutscene</option>
                <option value="canvas-alpha-000807">Rubia: Maid Bikini - Full cutscene</option>
                <option value="canvas-alpha-003601-2">Olivier: Faithful Wings - Loop 2</option>
                <option value="pivot-003392">Nebris: Lucky Bikini - Full cutscene</option>
                <option value="particle-000201">Justia: Knight of Blood - Full cutscene</option>
                <option value="particle-061492-2">Zenith: Stranger Bunny - Loop 2</option>
                <option value="sprite-000304">Scheherazade: Code Name S - Full cutscene</option>
                <option value="sprite-000604-1">Olstein: Sage of Blue Clouds - Loop 1</option>
                <option value="sprite-000604-2">Olstein: Sage of Blue Clouds - Loop 2</option>
                <option value="sprite-000706-1">Eclipse: Nightmare Bunny - Loop 1</option>
                <option value="sprite-000706-2">Eclipse: Nightmare Bunny - Loop 2</option>
                <option value="sprite-000706-3">Eclipse: Nightmare Bunny - Loop 3</option>
                <option value="depth-full-000396">Scheherazade: Deliberate Ace - Full cutscene</option>
                <option value="depth-scale-full-004192">Tyr: Clumsy Wuff - Full cutscene</option>
                <option value="rect-local-003403">Morpeah: Apostle - Full cutscene</option>
                <option value="game-time-020801">High Elf Archer: Daughter of Starwind - Full cutscene</option>
                <option value="uv-067504-loop">Luvencia: Ocean Vanguard - Loop 1</option>
                <option value="batch01-lathel-1">Lathel: Homunculus - Loop 1</option>
                <option value="batch01-lathel-2">Lathel: Homunculus - Loop 2</option>
                <option value="batch01-eclipse">Eclipse: Beach Vacation - Full cutscene</option>
                <option value="batch01-rafina">Rafina: Game Club - Full cutscene</option>
                <option value="batch01-refithea">Refithea: Pure White Blessing - Full cutscene</option>
                <option value="batch02-teresse-3">Teresse: Beachside Angel - Loop 3</option>
                <option value="batch02-liberta-2">Liberta: Onsen Manager - Loop 2</option>
                <option value="batch02-darian">Darian: Bittersweet Bunny - Full cutscene</option>
                <option value="batch02-tyr-1">Tyr: Starlight Guardian - Loop 1</option>
                <option value="batch02-tyr-2">Tyr: Starlight Guardian - Loop 2</option>
                <option value="batch02-helena">Helena: B-Rank Idol - Full cutscene</option>
                <option value="batch02-michaela-beach">Michaela: Beachside Justice - Full cutscene</option>
                <option value="batch02-michaela-beach-2">Michaela: Beachside Justice - Loop 2</option>
                <option value="batch02-michaela-queen-2">Michaela: Queen of Signatures - Loop 2</option>
                <option value="batch03-loen">Loen: Last Hope - Full cutscene</option>
                <option value="batch03-tyr">Tyr: Starlight Guardian - Full cutscene</option>
                <option value="batch03-palette-1">Palette: Shattered Dream - Loop 1</option>
                <option value="batch03-palette-2">Palette: Shattered Dream - Loop 2</option>
                <option value="batch03-palette-3">Palette: Shattered Dream - Loop 3</option>
                <option value="batch03-zenith">Zenith: Robin Hood - Full cutscene</option>
                <option value="batch03-nartas">Nartas: Anonymous Sage - Full cutscene</option>
                <option value="batch03-angelica">Angelica: Pool Party - Full cutscene</option>
                <option value="batch03-granadair">Granadair: Shrine Maiden of Purification - Full cutscene</option>
                <option value="batch04-olivier-full">Olivier: Retired Legend - Full cutscene</option>
                <option value="batch04-olivier-loop">Olivier: Retired Legend - Loop</option>
                <option value="batch04-palette">Palette: Miracle Violet - Loop</option>
                <option value="batch04-goblin-1">Goblin Slayer: Orcbolg - Loop 1</option>
                <option value="batch04-goblin-2">Goblin Slayer: Orcbolg - Loop 2</option>
                <option value="batch04-yuri">Yuri: Forever Mascot - Full cutscene</option>
                <option value="batch04-aquila">Aquila: Sealed Desires - Full cutscene</option>
                <option value="batch05-rou">Rou: White Cat - Full cutscene</option>
                <option value="batch05-olivier">Olivier: Fallen Wings - Full cutscene</option>
                <option value="batch05-blade">Blade: Apostle - Full cutscene</option>
                <option value="batch05-hikage">Hikage: Kind Ruthlessness - Full cutscene</option>
                <option value="batch05-tenka">Tenka Izumo: Ame-no-Mitori - Full cutscene</option>
                <option value="batch05-rafina">Rafina: Steel Engine - Full cutscene</option>
                <option value="batch05-elise">Elise: Code Name O - Full cutscene</option>
                <option value="batch06-nebris">Nebris: New Hire - Full cutscene</option>
                <option value="batch06-morpeah">Morpeah: Daydream Bunny - Full cutscene</option>
                <option value="batch06-blade">Blade: Young Lady - Full cutscene</option>
                <option value="batch06-liberta">Liberta: Dark Saintess - Full cutscene</option>
                <option value="batch06-priestess">Priestess: Earth Mother Believer - Full cutscene</option>
                <option value="batch06-ventana">Ventana: Onsen Practitioner - Full cutscene</option>
                <option value="batch06-venaka">Venaka: Wind Dancer - Full cutscene</option>
                <option value="batch06-luvencia">Luvencia: Wild Dog - Full cutscene</option>
                <option value="batch07-morpeah-loop">Morpeah: Daydream Bunny - Loop</option>
                <option value="batch07-liberta">Liberta: Hedonist - Full cutscene</option>
                <option value="batch07-eleaneer">Eleaneer: Piercing Magic Bow - Full cutscene</option>
                <option value="batch07-granadair">Granadair: Queen of Gluttis - Full cutscene</option>
                <option value="batch07-mamonir">Mamonir: Night of Death - Full cutscene</option>
                <option value="batch07-aquila-loop">Aquila: Sealed Desires - Loop</option>
                <option value="batch08-eclipse-2">Eclipse: Dream Bride - Loop 2</option>
                <option value="batch08-liberta">Liberta: Miracle Rose - Loop</option>
                <option value="batch08-ren">Ren Yamashiro: Lord of the Cosmos - Full cutscene</option>
                <option value="batch08-elise-1">Elise: Naive Lady - Loop 1</option>
                <option value="batch08-elise-2">Elise: Naive Lady - Loop 2</option>
                <option value="batch08-dalvi">Dalvi: Butterfly Dream - Full cutscene</option>
                <option value="batch08-ventana-2">Ventana: Snow White - Loop 2</option>
                <option value="batch08-mamonir-2">Mamonir: Miracle Marine - Loop 2</option>
                <option value="batch08-wiggle">Wiggle: Bomb Fanatic - Loop</option>
                <option value="batch09-eris-1">Eris: Your Very Own Cat - Loop 1</option>
                <option value="batch09-eris-2">Eris: Your Very Own Cat - Loop 2</option>
                <option value="batch09-roxy">Roxy: Emerging Desire - Full cutscene</option>
                <option value="batch09-angelica">Angelica: Neon Savior - Full cutscene</option>
                <option value="update-liatris-full">Liatris: Sweet Temptation - Full cutscene</option>
                <option value="update-liatris-loop-1">Liatris: Sweet Temptation - Loop 1</option>
                <option value="update-liatris-loop-2">Liatris: Sweet Temptation - Loop 2</option>
                <option value="update-valze-full">Valze: Night of Betrayal - Full cutscene</option>
                <option value="update-valze-loop-1">Valze: Night of Betrayal - Loop 1</option>
                <option value="update-valze-loop-2">Valze: Night of Betrayal - Loop 2</option>
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
