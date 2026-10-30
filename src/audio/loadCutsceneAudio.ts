import type { CutsceneScene } from "@/data/loadCutsceneScene";

import { readAsset } from "@/data/readAsset";

export type CutsceneVoiceLanguage = "JP" | "KR";

export interface CutsceneAudioResources {
    buffers: ReadonlyMap<string, AudioBuffer>;
    dispose(): void;
}

export async function loadCutsceneAudio(scene: CutsceneScene, language: CutsceneVoiceLanguage, context: BaseAudioContext, signal: AbortSignal): Promise<CutsceneAudioResources> {
    signal.throwIfAborted();

    if (language !== "JP" && language !== "KR")
        throw new Error("Unsupported cutscene voice language.");

    const buffers = new Map<string, AudioBuffer>();

    try
    {
        for (const [id, media] of Object.entries(scene.media))
        {
            if (media.kind !== "audio")
                continue;

            if (media.role !== "voice" && media.role !== "effect")
                throw new Error(`Unsupported cutscene audio role: ${media.role}`);

            const variant = media.variants[media.role === "voice" ? language : "default"];
            if (variant?.state !== "ready")
                throw new Error(`Cutscene audio is not prepared: ${id}`);

            const bytes = await readAsset(variant.file, signal);
            const buffer = await context.decodeAudioData(bytes);

            signal.throwIfAborted();

            if (Math.abs(buffer.duration - variant.durationSeconds) > 1 / buffer.sampleRate + 1e-9)
                throw new Error(`Decoded audio duration mismatch: ${id}`);

            buffers.set(id, buffer);
        }

        signal.throwIfAborted();

        return {
            buffers,
            dispose() {
                buffers.clear();
            }
        };
    }
    catch (error)
    {
        buffers.clear();
        throw error;
    }
}
