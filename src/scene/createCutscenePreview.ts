import type { CutsceneScene } from "@/data/loadCutsceneScene";

import { Application } from "pixi.js";
import { loadCutsceneMedia } from "@/spine/loadCutsceneMedia";
import { createCutsceneGraph } from "@/spine/createCutsceneGraph";
import { createCutsceneTimeline } from "@/scene/createCutsceneTimeline";

export interface CutscenePreviewSnapshot {
    time: number;
    duration: number | null;
    playing: boolean;
}

export interface CutscenePreview {
    play(): void;
    pause(): void;
    replay(): void;
    seek(timeSeconds: number): void;
    dispose(): void;
}

export async function createCutscenePreview(
    host: HTMLElement,
    scene: CutsceneScene,
    signal: AbortSignal,
    onChange: (snapshot: CutscenePreviewSnapshot) => void,
    onError: (error: unknown) => void,
): Promise<CutscenePreview> {
    const controller = new AbortController();
    let resources: Awaited<ReturnType<typeof loadCutsceneMedia>> | undefined;
    let graph: ReturnType<typeof createCutsceneGraph> | undefined;
    let timeline: ReturnType<typeof createCutsceneTimeline> | undefined;
    let app: Application<HTMLCanvasElement> | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let last = 0;
    let playing = false;
    let disposed = false;
    let previous: CutscenePreviewSnapshot | undefined;

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        cancelAnimationFrame(frame);
        observer?.disconnect();
        signal.removeEventListener("abort", dispose);
        document.removeEventListener("visibilitychange", visibility);

        timeline?.dispose();
        timeline = undefined;

        graph?.dispose();
        graph = undefined;

        app?.destroy(true, { children: true, texture: false, baseTexture: false });
        app = undefined;

        controller.abort(signal.aborted ? signal.reason : undefined);

        resources?.dispose();
        resources = undefined;
    }

    function publish() {
        const snapshot = { time: timeline!.time, duration: timeline!.duration, playing };
        if (previous?.time === snapshot.time && previous.playing === playing)
            return;

        previous = snapshot;
        onChange(snapshot);
    }

    function advance() {
        const now = performance.now();
        timeline!.advance(Math.max(0, now - last) / 1000);
        last = now;

        const duration = timeline!.duration;

        if (playing && duration !== null && timeline!.time >= duration)
        {
            playing = false;
            timeline!.pause();
        }
    }

    function draw() {
        app!.render();
        publish();
    }

    function tick() {
        if (disposed || document.hidden)
            return;

        try
        {
            advance();
            draw();

            frame = requestAnimationFrame(tick);
        }
        catch (error)
        {
            dispose();
            onError(error);
        }
    }

    function visibility() {
        cancelAnimationFrame(frame);
        last = performance.now();

        if (!disposed && !document.hidden)
            frame = requestAnimationFrame(tick);
    }

    function command(action: () => void) {
        if (disposed)
            throw new Error("Cutscene preview has been disposed.");

        action();
        draw();

        last = performance.now();
    }

    signal.addEventListener("abort", dispose, { once: true });

    try
    {
        signal.throwIfAborted();

        resources = await loadCutsceneMedia(scene, controller.signal);
        controller.signal.throwIfAborted();

        graph = createCutsceneGraph(scene, resources);
        timeline = createCutsceneTimeline(scene, graph);
        timeline.pause();

        app = new Application<HTMLCanvasElement>({
            autoStart: false,
            sharedTicker: false,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2)
        });
        app.stage.addChild(graph.root);
        app.view.setAttribute("aria-label", "Cutscene preview");
        app.view.setAttribute("role", "img");

        host.appendChild(app.view);

        function resize() {
            if (disposed)
                return;

            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            const reference = width >= height
                ? scene.layout.landscapeReferenceSize ?? scene.layout.referenceSize
                : scene.layout.referenceSize;

            const ratios = [width / reference.x, height / reference.y];
            const scale = scene.layout.screenMatch?.mode === "shrink"
                ? Math.max(...ratios)
                : Math.min(...ratios);

            app!.renderer.resize(width, height);
            graph!.root.position.set(width / 2, height / 2);
            graph!.root.scale.set(scale);
            graph!.resize({ x: width / scale, y: height / scale });

            draw();
        }

        observer = new ResizeObserver(resize);
        observer.observe(host);

        resize();
        controller.signal.throwIfAborted();
        document.addEventListener("visibilitychange", visibility);
        visibility();

        return {
            play() {
                command(() => {
                    const duration = timeline!.duration;
                    if (duration !== null && timeline!.time >= duration)
                        timeline!.seek(0);

                    timeline!.resume();
                    playing = true;
                });
            },
            pause() {
                command(() => {
                    if (!document.hidden)
                        advance();

                    timeline!.pause();
                    playing = false;
                });
            },
            replay() {
                command(() => {
                    timeline!.seek(0);
                    timeline!.resume();
                    playing = true;
                });
            },
            seek(timeSeconds) {
                command(() => {
                    timeline!.seek(timeSeconds);

                    const duration = timeline!.duration;
                    if (duration !== null && timeline!.time >= duration)
                    {
                        timeline!.pause();
                        playing = false;
                    }
                });
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
