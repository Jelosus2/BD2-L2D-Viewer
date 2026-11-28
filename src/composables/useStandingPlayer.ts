import type { StandingPreviewEntry } from "@/data/loadStandingPreviewIndex";
import type { StandingVoices } from "@/audio/createStandingVoices";
import type { StandingPlayer } from "@/spine/createStandingPreview";
import type { Ref } from "vue";

import { onBeforeUnmount, ref, watch } from "vue";
import { loadStandingScene } from "@/data/loadStandingScene";
import { createStandingPreview } from "@/spine/createStandingPreview";
import { createStandingVoices } from "@/audio/createStandingVoices";
import { useViewerStore } from "@/stores/viewerStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function useStandingPlayer(host: Ref<HTMLDivElement | null>, entry: Readonly<Ref<StandingPreviewEntry | undefined>>) {
    const store = useViewerStore();
    const settings = useSettingsStore();
    const status = ref("Loading");
    const error = ref("");
    const animations = ref<string[]>([]);
    const skins = ref<string[]>([]);
    const voiceLoading = ref(false);

    let controller: AbortController | undefined;
    let voiceController: AbortController | undefined;
    let player: StandingPlayer | undefined;
    let voices: StandingVoices | undefined;

    function close() {
        controller?.abort();
        controller = undefined;
        voiceController?.abort();
        voiceController = undefined;
        voices?.dispose();
        voices = undefined;
        player?.dispose();
        player = undefined;

        animations.value = [];
        skins.value = [];
        voiceLoading.value = false;
        status.value = "Loading";
    }

    function fail(reason: unknown, current: AbortController) {
        if (controller !== current || current.signal.aborted)
            return;

        close();

        error.value = reason instanceof Error ? reason.message : String(reason);
        status.value = "Failed";
    }

    async function loadVoices() {
        voiceController?.abort();
        voiceController = undefined;
        voices?.dispose();
        voices = undefined;
        voiceLoading.value = false;

        const current = controller;
        const lines = entry.value?.voices?.[settings.audioLanguage];

        if (!current || !player || !lines)
            return;

        const request = new AbortController();
        voiceController = request;
        voiceLoading.value = true;

        try
        {
            const created = await createStandingVoices(lines, request.signal);

            if (controller !== current || voiceController !== request || request.signal.aborted)
            {
                created.dispose();
                return;
            }

            voices = created;
        }
        catch (reason)
        {
            if (voiceController === request && !request.signal.aborted)
                fail(reason, current);
        }
        finally
        {
            if (voiceController === request)
                voiceLoading.value = false;
        }
    }

    async function reload() {
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
            const scene = await loadStandingScene(selected.catalogUrl, current.signal);
            current.signal.throwIfAborted();

            const created = await createStandingPreview(element, scene, current.signal, () => {
                if (controller !== current || current.signal.aborted || selected.voices && !voices)
                    return false;

                void voices?.playNext().catch((reason) => fail(reason, current));
                return true;
            });

            if (controller !== current || current.signal.aborted)
            {
                created.dispose();
                return;
            }

            animations.value = created.animations;
            skins.value = created.skins;
            store.animation = created.animations.includes(store.animation) ? store.animation : "";
            store.skin = created.skins.includes(store.skin) ? store.skin : "";

            player = created;
            created.setSkin(store.skin);
            created.setAnimation(store.animation);
            created.setSpeed(store.speed);
            created.setPlaying(store.playing);
            status.value = "Ready";

            await loadVoices();
        }
        catch (reason)
        {
            fail(reason, current);
        }
    }

    const selectionVersion = ref(0);

    watch(entry, () => {
        close();
        selectionVersion.value++;
    }, { flush: "sync" });

    watch([host, selectionVersion], () => {
        void reload();
    }, { immediate: true, flush: "post" });

    watch(() => settings.audioLanguage, () => { void loadVoices(); });
    watch(() => store.animation, (name) => player?.setAnimation(name));
    watch(() => store.skin, (name) => player?.setSkin(name));
    watch(() => store.playing, (value) => player?.setPlaying(value));
    watch(() => store.speed, (value) => player?.setSpeed(value));
    onBeforeUnmount(close);

    return {
        status,
        error,
        animations,
        skins,
        voiceLoading,
        reload,
        zoomBy: (factor: number) => player?.zoomBy(factor),
        resetView: () => player?.resetView()
    };
}
