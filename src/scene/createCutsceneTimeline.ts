import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { CutsceneGraph } from "@/spine/createCutsceneGraph";
import type { SceneBindings } from "./createSceneBindings";
import type { SpineTrackBinding } from "@/spine/createSpineTrackBinding";
import type { SceneSpine } from "@/spine/SceneSpine";

import { createSceneBindings } from "./createSceneBindings";
import { createSpineTrackBinding } from "@/spine/createSpineTrackBinding";

export interface CutsceneTimeline {
    readonly time: number;
    readonly poseTime: number;
    readonly duration: number | null;
    readonly paused: boolean;
    advance(deltaSeconds: number): void;
    seek(timeSeconds: number): void;
    pause(): void;
    resume(): void;
    dispose(): void;
}

export function createCutsceneTimeline(scene: CutsceneScene, graph: CutsceneGraph): CutsceneTimeline {
    const data = structuredClone(scene);
    const initial = structuredClone([...graph.nodes.values()]);
    const duration = data.timeline.durationSeconds;
    let time = 0;
    let poseTime = 0;
    let pauseTime = 0;
    let pausePoseTime = 0;
    let paused = false;
    let disposed = false;
    let properties: SceneBindings | undefined;
    let tracks: SpineTrackBinding[] = [];

    function tick(seconds: number): number {
        const value = Math.trunc(seconds / 1e-12 + 0.5);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(value))
            throw new Error("Cutscene time is outside the supported tick range.");

        return value;
    }

    if (duration === null)
    {
        if (data.timeline.spineTracks.length || data.timeline.activationTracks.length || data.timeline.propertyTracks.length || data.timeline.audioCues.length)
            throw new Error("Continuous loops require an empty timeline.");
    }
    else
    {
        tick(duration);
    }

    const nativeBoundaries = new Set([
        ...data.timeline.spineTracks.flatMap((track) => track.clips.flatMap((clip) => [tick(clip.start) * 1e-12, tick(clip.start + clip.duration) * 1e-12])),
        ...data.timeline.activationTracks.flatMap((track) => track.ranges.flatMap((range) => [tick(range.start) * 1e-12, tick(range.start + range.duration) * 1e-12])),
    ]);

    const boundaries = [...new Set([
        ...nativeBoundaries,
        ...data.timeline.propertyTracks.flatMap((track) => track.kind === "boolean"
            ? track.keys.map((key) => key.time)
            : []),
        ...(duration === null ? [] : [duration])
    ])].filter((value) => value > 0 && (duration === null || value <= duration)).sort((a, b) => a - b);

    function check() {
        if (disposed)
            throw new Error("Cutscene timeline has been disposed.");
    }

    function forActiveSpines(action: (spine: SceneSpine) => void) {
        const active = new Map<string, boolean>();

        for (const node of graph.nodes.values())
        {
            const enabled = node.active && (node.parentId === null || active.get(node.parentId) === true);
            active.set(node.id, enabled);

            for (const component of node.components)
            {
                if (component.kind === "spine" && component.enabled && enabled)
                    action(graph.spines.get(component.id)!);
            }
        }
    }

    function pose() {
        forActiveSpines((spine) => spine.applyPose());
    }

    function update(delta: number) {
        forActiveSpines((spine) => spine.update(delta));
    }

    function sample(value: number) {
        properties!.evaluate(duration === null ? 0 : value);

        for (const track of tracks)
            track.evaluate(value);

        pose();
    }

    function runTo(target: number) {
        let boundaryIndex = boundaries.findIndex((value) => value > poseTime);
        if (boundaryIndex < 0)
            boundaryIndex = boundaries.length;

        while (poseTime < target)
        {
            let frame = Math.floor(poseTime * 120) + 1;

            while (frame / 120 <= poseTime)
                frame++;

            const next = Math.min(frame / 120, boundaries[boundaryIndex] ?? duration ?? Infinity);

            if (
                next > target && (duration === null
                    ? next - target > 1e-12
                    : tick(next) > tick(target))
            )
            {
                break;
            }

            update(next - poseTime);
            poseTime = next;
            sample(poseTime);

            if (poseTime === boundaries[boundaryIndex])
                boundaryIndex++;
        }

        time = target;
    }

    function releaseBindings() {
        for (const track of tracks)
            track.dispose();

        tracks = [];

        properties?.dispose();
        properties = undefined;
    }

    function reset() {
        releaseBindings();

        for (const node of structuredClone(initial))
            Object.assign(graph.nodes.get(node.id)!, node);

        for (const node of graph.nodes.values())
        {
            for (const component of node.components)
            {
                if (component.kind !== "spine")
                    continue;

                const spine = graph.spines.get(component.id)!;
                spine.state.clearTracks();
                spine.state.timeScale = 1;
                spine.skeleton.setSkinByName(component.skin);
                spine.skeleton.setToSetupPose();
                spine.skeleton.scaleX = component.flipX ? -1 : 1;
                spine.skeleton.scaleY = component.flipY ? -1 : 1;

                if (component.initialAnimation !== null)
                    spine.state.setAnimation(0, component.initialAnimation, component.initialLoop);

                spine.update(0);
                spine.applyPose();
            }
        }

        properties = createSceneBindings(data, graph);

        for (const track of data.timeline.spineTracks)
        {
            const spine = graph.spines.get(track.targetComponentId);
            if (!spine)
                throw new Error(`Missing timeline Spine: ${track.targetComponentId}`);

            tracks.push(createSpineTrackBinding(spine, track));
        }

        time = 0;
        poseTime = 0;
        pauseTime = 0;
        pausePoseTime = 0;
        sample(0);
    }

    try
    {
        reset();
    }
    catch (error)
    {
        releaseBindings();
        throw error;
    }

    return {
        get time() { return time; },
        get poseTime() { return poseTime; },
        get duration() { return duration; },
        get paused() { return paused; },
        advance(deltaSeconds) {
            check();
            tick(deltaSeconds);

            if (!paused)
            {
                runTo(duration === null ? time + deltaSeconds : Math.min(duration, time + deltaSeconds));
                return;
            }

            if (duration === null)
                return;

            const target = pauseTime + deltaSeconds;
            tick(target);

            let frame = Math.floor(pausePoseTime * 120) + 1;

            while (frame / 120 <= pausePoseTime)
                frame++;

            while (tick(frame / 120) <= tick(target))
            {
                const next = frame / 120;
                update(next - pausePoseTime);

                pausePoseTime = next;
                pose();
                frame++;
            }

            pauseTime = target;
        },
        seek(timeSeconds) {
            check();
            tick(timeSeconds);

            if (duration === null && timeSeconds !== 0)
                throw new Error("Continuous loops only support restarting at zero.");
            if (duration !== null && timeSeconds > duration)
                throw new Error("Seek time exceeds the cutscene duration.");

            reset();
            runTo(timeSeconds);

            if (paused)
            {
                for (const track of tracks)
                    track.pause();
            }
        },
        pause() {
            check();

            if (paused)
                return;

            for (const track of tracks)
                track.pause();

            pauseTime = 0;
            pausePoseTime = 0;
            paused = true;
        },
        resume() {
            check();

            if (!paused)
                return;

            for (const track of tracks)
                track.resume();

            paused = false;
        },
        dispose() {
            if (disposed)
                return;

            disposed = true;
            releaseBindings();
        }
    };
}
