import type { StandingVoiceLine } from "@/data/loadStandingPreviewIndex";

import { readAsset } from "@/data/readAsset";

export interface StandingVoices {
    playNext(): Promise<void>;
    dispose(): void;
}

export async function createStandingVoices(lines: StandingVoiceLine[], signal: AbortSignal): Promise<StandingVoices> {
    const clips: HTMLAudioElement[] = [];
    const urls: string[] = [];

    let active: HTMLAudioElement | undefined;
    let index = 0;
    let disposed = false;

    function stop() {
        active?.pause();
        if (active)
        {
            try
            {
                active.currentTime = 0;
            }
            catch { /* Metadata may still be loading. */ }
        }

        active = undefined;
    }

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        signal.removeEventListener("abort", dispose);
        stop();

        for (const clip of clips)
        {
            clip.onended = null;
            clip.pause();
            clip.removeAttribute("src");
            clip.load();
        }

        clips.length = 0;
        urls.forEach((url) => URL.revokeObjectURL(url));
        urls.length = 0;
    }

    signal.addEventListener("abort", dispose, { once: true });

    try
    {
        signal.throwIfAborted();

        if (lines.length !== 3)
            throw new Error("Expected three standing voice lines.");

        for (const line of lines)
        {
            const bytes = await readAsset(line.file, signal);
            signal.throwIfAborted();

            const url = URL.createObjectURL(new Blob([bytes], { type: "audio/webm" }));
            const clip = new Audio();

            urls.push(url);
            clips.push(clip);
            clip.preload = "auto";
            clip.src = url;
            clip.onended = () => { if (active === clip) active = undefined; };
            clip.load();
        }

        return {
            async playNext() {
                signal.throwIfAborted();

                if (disposed)
                    throw new Error("Standing voices have been disposed.");

                stop();

                const clip = clips[index];
                index = (index + 1) % clips.length;
                active = clip;

                try
                {
                    clip.currentTime = 0;
                    await clip.play();
                }
                catch (error)
                {
                    const interrupted = disposed || active !== clip;

                    if (active === clip)
                        active = undefined;

                    if (!interrupted)
                        throw error;
                }
            },
            dispose
        };
    }
    catch (error)
    {
        dispose();
        throw error;
    }
}
