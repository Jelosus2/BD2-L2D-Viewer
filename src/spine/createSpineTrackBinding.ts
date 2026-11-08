import type { Spine, TrackEntry } from "@esotericsoftware/spine-pixi";
import type { SpineClip, SpineTrack } from "@/types/scene";

export interface SpineTrackBinding {
    readonly boundaries: readonly number[];
    evaluate(timeSeconds: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
}

export function createSpineTrackBinding(spine: Spine, track: SpineTrack): SpineTrackBinding {
    const state = spine.state;
    const index = track.trackIndex;
    let active: SpineClip | undefined;
    let lastStarted: SpineClip | undefined;
    let startedEntry: TrackEntry | null = null;
    let pausedEntry: TrackEntry | null = null;
    let previousTimeScale = 1;
    let paused = false;
    let disposed = false;

    function tick(seconds: number): number {
        const value = Math.trunc(seconds / 1e-12 + 0.5);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(value))
            throw new Error("Spine track time is outside the supported tick range.");

        return value;
    }

    const clips = structuredClone(track.clips).map((clip) => {
        if (!spine.skeleton.data.findAnimation(clip.animation))
            throw new Error(`Animation not found: ${clip.animation}`);

        return { clip, start: tick(clip.start), end: tick(clip.start + clip.duration) };
    });

    const candidates = track.overlap === "animation-state" ? [...clips].reverse() : clips;
    const boundaries = Object.freeze([...new Set(clips.flatMap((clip) => [clip.start, clip.end]))].sort((a, b) => a - b).map((value) => value * 1e-12));

    const listener = {
        dispose(entry: TrackEntry) {
            if (entry === startedEntry)
                startedEntry = null;

            if (entry === pausedEntry)
                pausedEntry = null;
        }
    };

    function check() {
        if (disposed)
            throw new Error("Spine track binding has been disposed.");
    }

    function finish() {
        if (!lastStarted || !startedEntry || state.getCurrent(index) !== startedEntry)
            return;

        const end = lastStarted.end;
        if (end.mode === "continue")
            return;

        if (end.mode === "freeze")
            startedEntry.timeScale = 0;
        else
            state.setEmptyAnimation(index, end.seconds);

        startedEntry = null;
    }

    function start(clip: SpineClip, timeSeconds: number) {
        const localTime = (timeSeconds - clip.start) * clip.speed + clip.clipIn;
        const trackTime = localTime * clip.speed;

        if (!Number.isFinite(trackTime))
            throw new Error("Spine clip time overflow.");

        const mix = clip.mix.mode === "explicit" ? clip.mix.seconds : 0;
        let entry: TrackEntry;

        if (!state.getCurrent(index) && mix > 0)
        {
            state.setEmptyAnimation(index, 0);
            entry = state.addAnimation(index, clip.animation, clip.loop, 0);
        }
        else
        {
            entry = state.setAnimation(index, clip.animation, clip.loop);
        }

        entry.trackTime = trackTime;
        entry.timeScale = clip.speed;
        entry.alpha = clip.alpha;
        entry.holdPrevious = clip.holdPrevious;
        entry.attachmentThreshold = clip.thresholds.attachment;
        entry.eventThreshold = clip.thresholds.event;
        entry.drawOrderThreshold = clip.thresholds.drawOrder;

        if (clip.mix.mode === "explicit")
            entry.mixDuration = clip.mix.seconds;

        startedEntry = entry;
        lastStarted = clip;

        spine.update(0);
        state.apply(spine.skeleton);
        spine.skeleton.updateWorldTransform();
    }

    state.addListener(listener);

    return {
        boundaries,
        evaluate(timeSeconds) {
            check();

            const time = tick(timeSeconds);
            const next = candidates.find(({ clip, start, end }) => (clip.startExclusive ? time > start : time >= start) && time < end)?.clip;

            if (next === active)
                return;

            if (next)
                start(next, timeSeconds);
            else if (active)
                finish();

            active = next;
        },
        pause() {
            check();

            if (paused || lastStarted?.pauseWithScene === false)
                return;

            const current = state.getCurrent(index);

            if (current && current === startedEntry)
            {
                previousTimeScale = current.timeScale;
                current.timeScale = 0;
                pausedEntry = current;
            }

            paused = true;
        },
        resume() {
            check();

            if (!paused)
                return;

            const current = state.getCurrent(index);
            if (current && current === pausedEntry)
                current.timeScale = previousTimeScale;

            pausedEntry = null;
            paused = false;
        },
        dispose() {
            if (disposed)
                return;

            disposed = true;
            if (!paused)
                finish();

            state.removeListener(listener);

            startedEntry = null;
            pausedEntry = null;
            active = undefined;
            lastStarted = undefined;
        }
    };
}
