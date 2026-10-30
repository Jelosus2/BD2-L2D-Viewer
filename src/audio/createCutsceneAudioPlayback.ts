import type { AudioCue } from "@/types/audio";

export interface CutsceneAudioPlayback {
    readonly time: number;
    play(timeSeconds: number): void;
    pause(): void;
    dispose(): void;
}

export function createCutsceneAudioPlayback(
    cues: readonly AudioCue[],
    buffers: ReadonlyMap<string, AudioBuffer>,
    context: BaseAudioContext,
    output: AudioNode = context.destination,
): CutsceneAudioPlayback {
    const clips = cues.map((cue) => {
        const buffer = buffers.get(cue.mediaId);

        if (!buffer)
            throw new Error(`Missing cutscene audio buffer: ${cue.mediaId}`);
        if (cue.clipEndPolicy.mode === "fade")
            throw new Error("Cutscene audio fades require separate support.");

        const length = Math.max(0, buffer.duration - cue.offsetSeconds);

        return {
            buffer,
            start: cue.start,
            offset: cue.offsetSeconds,
            gain: cue.gain,
            end: cue.start + (cue.clipEndPolicy.mode === "stop"
                ? Math.min(length, cue.sourceWindowSeconds)
                : length)
        };
    });

    const voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
    let position = 0;
    let startedAt = 0;
    let running = false;
    let disposed = false;

    function check() {
        if (disposed)
            throw new Error("Cutscene audio playback has been disposed.");
    }

    function time() {
        return position + (running ? Math.max(0, context.currentTime - startedAt) : 0);
    }

    function release(voice: { source: AudioBufferSourceNode; gain: GainNode }) {
        voice.source.onended = null;
        voice.source.disconnect();
        voice.gain.disconnect();
        voices.delete(voice);
    }

    function stopVoices() {
        for (const voice of voices)
        {
            voice.source.stop();
            release(voice);
        }
    }

    return {
        get time() {
            return time();
        },
        play(timeSeconds) {
            check();

            if (!Number.isFinite(timeSeconds) || timeSeconds < 0)
                throw new Error("Invalid cutscene audio time.");
            if (context.state === "closed")
                throw new Error("Cutscene audio context has been closed.");

            stopVoices();
            position = timeSeconds;
            startedAt = context.currentTime;
            running = true;

            try
            {
                for (const clip of clips)
                {
                    if (timeSeconds >= clip.end)
                        continue;

                    const source = context.createBufferSource();
                    const gain = context.createGain();
                    const voice = { source, gain };

                    source.buffer = clip.buffer;
                    gain.gain.value = clip.gain;
                    source.onended = () => release(voice);

                    try
                    {
                        source.connect(gain);
                        gain.connect(output);
                        source.start(
                            startedAt + Math.max(0, clip.start - timeSeconds),
                            clip.offset + Math.max(0, timeSeconds - clip.start),
                            clip.end - Math.max(timeSeconds, clip.start),
                        );
                        voices.add(voice);
                    }
                    catch (error)
                    {
                        release(voice);
                        throw error;
                    }
                }
            }
            catch (error)
            {
                stopVoices();
                running = false;
                throw error;
            }
        },
        pause() {
            check();

            position = time();
            running = false;

            stopVoices();
        },
        dispose() {
            if (disposed)
                return;

            position = time();
            running = false;
            disposed = true;

            stopVoices();
            clips.length = 0;
        }
    };
}
