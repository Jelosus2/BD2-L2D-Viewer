import type { CutscenePreviewEntry } from "@/data/loadCutscenePreviewIndex";
import type { CutscenePreview, CutscenePreviewSnapshot } from "@/scene/createCutscenePreview";
import type { Ref } from "vue";

import { loadCutsceneScene } from "@/data/loadCutsceneScene";
import { createCutscenePreview } from "@/scene/createCutscenePreview";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import { onBeforeUnmount, ref, watch } from "vue";

export function useCutscenePlayer(host: Ref<HTMLDivElement | null>, entry: Readonly<Ref<CutscenePreviewEntry | undefined>>) {
    const settings = useSettingsStore();
    const store = useViewerStore();
    const status = ref("Loading");
    const error = ref("");
    const state = ref<CutscenePreviewSnapshot>({ time: 0, duration: null, playing: false });
    const selectionVersion = ref(0);

    let controller: AbortController | undefined;
    let player: CutscenePreview | undefined;

    function close() {
        controller?.abort();
        controller = undefined;
        player?.dispose();
        player = undefined;

        status.value = "Loading";
        state.value = { time: 0, duration: null, playing: false };
    }

    function fail(reason: unknown, current: AbortController) {
        if (controller !== current || current.signal.aborted)
            return;

        close();

        error.value = reason instanceof Error ? reason.message : String(reason);
        status.value = "Failed";
    }

    async function control(action: (current: CutscenePreview) => void | Promise<void>) {
        const current = controller;
        if (!player || !current)
            return;

        try
        {
            await action(player);
        }
        catch (reason)
        {
            fail(reason, current);
        }
    }

    async function reload(preserve = false) {
        const previous = preserve ? { ...state.value } : undefined;

        close();
        error.value = "";

        const element = host.value;
        const selected = entry.value;

        if (!element || !selected)
            return;

        const current = new AbortController();
        controller = current;

        try
        {
            const { scene } = await loadCutsceneScene(selected.catalogUrl, current.signal, selected.variant);
            current.signal.throwIfAborted();

            const created = await createCutscenePreview(element, scene, current.signal, (snapshot) => {
                if (controller === current && !current.signal.aborted)
                    state.value = snapshot;
            }, (reason) => fail(reason, current), settings.audioLanguage);

            if (controller !== current || current.signal.aborted)
            {
                created.dispose();
                return;
            }

            player = created;
            created.setSpeed(store.speed);

            if (previous)
                created.seek(previous.time);

            status.value = "Ready";

            if (previous?.playing)
                await created.play();
        }
        catch (reason)
        {
            fail(reason, current);
        }
    }

    watch(entry, () => {
        close();
        selectionVersion.value++;
    }, { flush: "sync" });

    watch([host, selectionVersion, () => settings.audioLanguage], (value, previous) => {
        void reload(entry.value !== undefined && value[1] === previous?.[1]);
    }, { immediate: true, flush: "post" });

    watch(() => store.speed, (value) => {
        void control((current) => current.setSpeed(value));
    });

    onBeforeUnmount(close);

    return {
        status,
        error,
        state,
        reload: () => reload(),
        toggle: () => control((current) => state.value.playing ? current.pause() : current.play()),
        seek: (time: number) => control((current) => current.seek(time)),
        zoomBy: (factor: number) => { void control((current) => current.zoomBy(factor)); },
        resetView: () => { void control((current) => current.resetView()); }
    };
}
