import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { CutsceneVoiceLanguage, CutsceneAudioResources } from "@/audio/loadCutsceneAudio";

import { loadCutsceneMedia } from "@/spine/loadCutsceneMedia";
import { createCutsceneGraph } from "@/spine/createCutsceneGraph";
import { createCutsceneTimeline } from "@/scene/createCutsceneTimeline";
import { loadCutsceneAudio } from "@/audio/loadCutsceneAudio";
import { createCutsceneAudioPlayback } from "@/audio/createCutsceneAudioPlayback";
import { Application } from "pixi.js";

export interface CutscenePreviewSnapshot {
    time: number;
    duration: number | null;
    playing: boolean;
}

export interface CutscenePreview {
    play(): Promise<void>;
    pause(): void;
    replay(): Promise<void>;
    seek(timeSeconds: number): void;
    dispose(): void;
}

export async function createCutscenePreview(
    host: HTMLElement,
    scene: CutsceneScene,
    signal: AbortSignal,
    onChange: (snapshot: CutscenePreviewSnapshot) => void,
    onError: (error: unknown) => void,
    language: CutsceneVoiceLanguage = "JP"
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
    let audioContext: AudioContext | undefined;
    let audioResources: CutsceneAudioResources | undefined;
    let audio: ReturnType<typeof createCutsceneAudioPlayback> | undefined;
    let audioRunning = false;
    let commandVersion = 0;
    let wasHidden = document.hidden;

    function dispose() {
        if (disposed)
            return;

        disposed = true;
        commandVersion++;

        cancelAnimationFrame(frame);
        observer?.disconnect();
        signal.removeEventListener("abort", dispose);
        document.removeEventListener("visibilitychange", visibility);

        controller.abort(signal.aborted ? signal.reason : undefined);
        audioRunning = false;
        audio?.dispose();
        audio = undefined;
        audioResources?.dispose();
        audioResources = undefined;

        const context = audioContext;
        audioContext = undefined;

        if (context && context.state !== "closed")
            void context.close().catch(() => {});

        timeline?.dispose();
        timeline = undefined;

        graph?.dispose();
        graph = undefined;

        app?.destroy(true, { children: true, texture: false, baseTexture: false });
        app = undefined;

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
        const delta = playing && audio
            ? Math.max(0, audio.time - timeline!.time)
            : Math.max(0, now - last) / 1000;

        timeline!.advance(delta);
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

            if (!disposed)
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
        if (disposed)
            return;

        try
        {
            if (document.hidden)
            {
                audio?.pause();
                if (!wasHidden)
                    advance();

                wasHidden = true;
                last = performance.now();
                return;
            }

            if (wasHidden && audioRunning)
            {
                audio!.play(audio!.time);
                const version = commandVersion;

                void audioContext!.resume().catch((error) => {
                    if (!disposed && !document.hidden && version === commandVersion)
                    {
                        dispose();
                        onError(error);
                    }
                });
            }

            wasHidden = false;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }
        catch (error)
        {
            dispose();
            onError(error);
        }
    }

    function command(action: () => void) {
        if (disposed)
            throw new Error("Cutscene preview has been disposed.");

        action();
        draw();

        last = performance.now();
    }

    async function start(restart: boolean) {
        if (disposed)
            throw new Error("Cutscene preview has been disposed.");

        if (playing && !restart)
            return;

        const version = ++commandVersion;
        const context = audioContext;

        command(() => {
            audio?.pause();
            audioRunning = false;

            const duration = timeline!.duration;
            if (restart || (duration !== null && timeline!.time >= duration))
                timeline!.seek(0);

            timeline!.pause();
            playing = false;
        });

        if (disposed || version !== commandVersion)
            return;

        if (context)
            await context.resume();

        if (disposed || version !== commandVersion)
            return;

        if (context && context.state !== "running")
            throw new Error("Could not start cutscene audio playback.");

        command(() => {
            audio?.play(timeline!.time);
            audioRunning = audio !== undefined;

            if (document.hidden)
                audio?.pause();

            timeline!.resume();
            playing = true;
        });
    }

    signal.addEventListener("abort", dispose, { once: true });

    try
    {
        signal.throwIfAborted();

        const visualMedia = await loadCutsceneMedia(scene, controller.signal);

        if (disposed)
            visualMedia.dispose();
        else
            resources = visualMedia;

        controller.signal.throwIfAborted();

        if (scene.timeline.audioCues.length > 0)
        {
            audioContext = new AudioContext();

            const decoded = await loadCutsceneAudio(scene, language, audioContext, controller.signal);

            if (disposed)
                decoded.dispose();
            else
                audioResources = decoded;

            controller.signal.throwIfAborted();
            audio = createCutsceneAudioPlayback(scene.timeline.audioCues, decoded.buffers, audioContext);
        }

        graph = createCutsceneGraph(scene, visualMedia);
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
                return start(false);
            },
            pause() {
                commandVersion++;

                command(() => {
                    audio?.pause();

                    if (!document.hidden)
                        advance();

                    audioRunning = false;
                    timeline!.pause();
                    playing = false;
                });
            },
            replay() {
                return start(true);
            },
            seek(timeSeconds) {
                commandVersion++;

                command(() => {
                    timeline!.seek(timeSeconds);
                    audio?.pause();
                    audioRunning = false;

                    const duration = timeline!.duration;

                    if (duration !== null && timeline!.time >= duration)
                    {
                        timeline!.pause();
                        playing = false;
                    }

                    if (playing && audio)
                    {
                        audio.play(timeline!.time);
                        audioRunning = true;

                        if (document.hidden)
                            audio.pause();
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
