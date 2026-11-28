import type { StandingScene } from "@/data/loadStandingScene";

import { readAsset } from "@/data/readAsset";
import { resolveRectLayout } from "./resolveRectLayout";
import { SceneSlotMesh } from "./SceneSlotMesh";
import { ALPHA_MODES, Application, BaseTexture, Container, extensions, type FederatedPointerEvent } from "pixi.js";
import {
    AtlasAttachmentLoader,
    DarkTintRenderer,
    SkeletonBinary,
    Spine,
    SpineTexture,
    TextureAtlas,
} from "@esotericsoftware/spine-pixi-v7";

extensions.add(DarkTintRenderer);

export interface StandingPlayer {
    dispose(): void;
    animations: string[];
    skins: string[];
    setAnimation(name: string): void;
    setSkin(name: string): void;
    setPlaying(value: boolean): void;
    setSpeed(value: number): void;
    zoomBy(factor: number): void;
    resetView(): void;
}

export async function createStandingPreview(host: HTMLElement, scene: StandingScene, signal: AbortSignal, onInteract?: () => boolean | void): Promise<StandingPlayer> {
    const controller = new AbortController();
    const textures: BaseTexture[] = [];
    let atlas: TextureAtlas | undefined;
    let app: Application<HTMLCanvasElement> | undefined;
    let observer: ResizeObserver | undefined;
    let onVisibility: (() => void) | undefined;
    let removeInteraction: (() => void) | undefined;
    let disposed = false;
    let playing = true;
    let speed = 1;

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        controller.abort();
        signal.removeEventListener("abort", dispose);
        observer?.disconnect();
        removeInteraction?.();

        if (onVisibility)
            document.removeEventListener("visibilitychange", onVisibility);

        app?.destroy(true, {
            children: true,
            texture: false,
            baseTexture: false,
        });
        app = undefined;

        atlas?.dispose();
        atlas = undefined;

        for (const texture of textures)
            texture.destroy();

        textures.length = 0;
    }

    signal.addEventListener("abort", dispose, { once: true });

    try
    {
        signal.throwIfAborted();

        const { media, component } = scene;
        const [binary, atlasBytes] = await Promise.all([
            readAsset(media.skeleton, controller.signal),
            readAsset(media.atlas, controller.signal),
        ]);

        controller.signal.throwIfAborted();
        atlas = new TextureAtlas(new TextDecoder().decode(atlasBytes));

        const pageNames = new Set(atlas.pages.map((page) => page.name));
        if (pageNames.size !== atlas.pages.length ||
            pageNames.size !== Object.keys(media.pages).length)
            throw new Error("Atlas pages do not match scene media.");

        for (const page of atlas.pages)
        {
            if (!Object.prototype.hasOwnProperty.call(media.pages, page.name))
                throw new Error(`Atlas page not declared: ${page.name}`);

            const bytes = await readAsset(media.pages[page.name], controller.signal);
            const blob = new Blob([bytes]);
            controller.signal.throwIfAborted();

            const objectUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.src = objectUrl;

            try
            {
                await image.decode();
            }
            finally
            {
                URL.revokeObjectURL(objectUrl);
            }

            controller.signal.throwIfAborted();

            if (!Number.isSafeInteger(page.width) || page.width <= 0 ||
                !Number.isSafeInteger(page.height) || page.height <= 0)
                throw new Error(`Invalid atlas page dimensions: ${page.name}`);

            if (image.naturalWidth <= 0 || image.naturalHeight <= 0)
                throw new Error(`Invalid texture dimensions: ${page.name}`);

            const texture = new BaseTexture(image, {
                alphaMode: page.pma ? ALPHA_MODES.PMA : ALPHA_MODES.UNPACK,
            });

            textures.push(texture);

            const spineTexture = SpineTexture.from(texture);
            const uvSize = new Image(page.width, page.height);

            spineTexture.getImage = () => uvSize;
            page.setTexture(spineTexture);
        }

        const parser = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
        parser.scale = media.parseScale;
        const data = parser.readSkeletonData(new Uint8Array(binary));

        if (data.version !== media.version)
            throw new Error(`Spine version mismatch: ${data.version}`);

        const startupSequence = component.startupSequence ?? [{
            animation: component.initialAnimation,
            loop: component.initialLoop,
        }];

        for (const entry of startupSequence)
        {
            if (!data.findAnimation(entry.animation))
                throw new Error(`Animation not found: ${entry.animation}`);
        }

        if (!data.findSkin(component.skin))
            throw new Error(`Skin not found: ${component.skin}`);

        const application = new Application<HTMLCanvasElement>({
            autoStart: false,
            sharedTicker: false,
            backgroundAlpha: 0,
            antialias: true,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
        });

        app = application;
        host.appendChild(application.view);

        const spine = new Spine(data, {
            autoUpdate: false,
            slotMeshFactory: () => new SceneSlotMesh()
        });

        const camera = new Container();
        const canvasRoot = new Container();

        application.stage.addChild(camera);
        camera.addChild(canvasRoot);

        const view = { x: 0, y: 0, zoom: 1 };

        function updateCamera() {
            camera.pivot.set(host.clientWidth / 2, host.clientHeight / 2);
            camera.position.set(
                host.clientWidth / 2 + view.x,
                host.clientHeight / 2 + view.y
            );

            camera.scale.set(view.zoom);
            application.render();
        }

        function zoomBy(factor: number) {
            if (disposed)
                return;

            if (!Number.isFinite(factor) || factor <= 0)
                throw new Error("Invalid zoom factor.");

            view.zoom = Math.min(4, Math.max(0.25, view.zoom * factor));
            updateCamera();
        }

        function resetView() {
            if (disposed)
                return;

            Object.assign(view, { x: 0, y: 0, zoom: 1 });
            updateCamera();
        }

        let parent = canvasRoot;
        const containers = scene.nodes.map((node) => {
            const container = new Container();
            container.alpha = node.opacity;
            container.visible = node.active;

            parent.addChild(container);
            parent = container;

            return container;
        });

        parent.addChild(spine);
        spine.scale.set(scene.referencePixelsPerUnit * component.renderScale);

        spine.skeleton.setSkinByName(component.skin);
        spine.skeleton.setSlotsToSetupPose();
        spine.skeleton.scaleX = component.flipX ? -1 : 1;
        spine.skeleton.scaleY = component.flipY ? -1 : 1;

        const { r, g, b, a } = component.color;
        spine.skeleton.color.set(r, g, b, a);
        spine.visible = component.enabled;
        spine.state.data.defaultMix = media.defaultMixSeconds;

        for (const mix of media.mixes)
            spine.state.data.setMix(mix.from, mix.to, mix.seconds);

        function setAnimation(name: string) {
            if (disposed)
                return;

            if (name && !data.findAnimation(name))
                throw new Error(`Animation not found: ${name}`);

            spine.state.clearTracks();
            spine.skeleton.setToSetupPose();
            spine.skeleton.physicsConstraints.forEach((constraint) => constraint.reset());

            const sequence = name
                ? [{ animation: name, loop: true }]
                : startupSequence;

            sequence.forEach((entry, index) => {
                if (index === 0)
                    spine.state.setAnimation(0, entry.animation, entry.loop);
                else
                    spine.state.addAnimation(0, entry.animation, entry.loop, 0);
            });

            spine.update(0);
            application.render();
        }

        setAnimation("");

        function setSkin(name: string) {
            if (disposed)
                return;

            spine.skeleton.setSkinByName(name || component.skin);
            spine.skeleton.setSlotsToSetupPose();
            spine.update(0);
            application.render();
        }

        let gesture: { id: number; x: number; y: number; moved: boolean } | undefined;
        let pan: { id: number; x: number; y: number; moved: boolean } | undefined;

        function pointerDown(event: PointerEvent) {
            pan = event.button === 0 && event.isPrimary
                ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
                : undefined;
        }

        function pointerMove(event: PointerEvent) {
            if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8)
                gesture.moved = true;

            if (!pan || pan.id !== event.pointerId || !pan.moved && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) <= 8)
                return;

            pan.moved = true;
            const bounds = application.view.getBoundingClientRect();

            if (bounds.width > 0 && bounds.height > 0)
            {
                view.x += (event.clientX - pan.x) * host.clientWidth / bounds.width;
                view.y += (event.clientY - pan.y) * host.clientHeight / bounds.height;
            }

            pan.x = event.clientX;
            pan.y = event.clientY;

            updateCamera();
        }

        function clearGesture() {
            gesture = undefined;
            pan = undefined;
        }

        spine.eventMode = "static";
        spine.on("pointerdown", (event: FederatedPointerEvent) => {
            gesture = event.button === 0 && event.isPrimary
                ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
                : undefined;
        });

        spine.on("pointertap", (event: FederatedPointerEvent) => {
            const click = gesture;
            gesture = undefined;

            const current = spine.state.getCurrent(0);
            const motion = data.findAnimation("motion");
            if (
                !playing || !click || click.id !== event.pointerId || click.moved ||
                Math.hypot(event.clientX - click.x, event.clientY - click.y) > 8 ||
                current?.animation?.name !== "idle" || current.next || !motion ||
                !data.findAnimation("idle") || onInteract?.() === false
            )
            {
                return;
            }

            spine.state.setAnimation(0, "motion", false);
            spine.state.addAnimation(0, "idle", true, motion.duration);
        });

        window.addEventListener("pointermove", pointerMove, true);
        window.addEventListener("pointerup", clearGesture);
        window.addEventListener("pointercancel", clearGesture);
        window.addEventListener("blur", clearGesture);

        application.view.style.touchAction = "none";
        application.view.addEventListener("pointerdown", pointerDown);

        removeInteraction = () => {
            window.removeEventListener("pointermove", pointerMove, true);
            window.removeEventListener("pointerup", clearGesture);
            window.removeEventListener("pointercancel", clearGesture);
            window.removeEventListener("blur", clearGesture);
            application.view.removeEventListener("pointerdown", pointerDown);

            gesture = undefined;
            pan = undefined;
        };

        function resize() {
            if (disposed)
                return;

            const width = Math.max(1, host.clientWidth);
            const height = Math.max(1, host.clientHeight);
            application.renderer.resize(width, height);

            const orientation = width >= height ? "landscape" : "portrait";
            const profile = scene.layoutProfiles.find((value) => value.orientation === orientation);
            const referenceSize = profile?.referenceSize ?? scene.referenceSize;
            const xRatio = width / referenceSize.x;
            const yRatio = height / referenceSize.y;
            const fit = scene.screenMatch === "expand"
                ? Math.min(xRatio, yRatio)
                : Math.max(xRatio, yRatio);

            canvasRoot.position.set(width / 2, height / 2);
            canvasRoot.scale.set(fit);

            let parentSize = { x: width / fit, y: height / fit };
            let parentPivot = { x: 0.5, y: 0.5 };

            scene.nodes.forEach((node, index) => {
                const layout = profile?.nodeLayouts[node.id] ?? node.layout;
                const resolved = resolveRectLayout(layout, parentSize, parentPivot);
                const container = containers[index];

                container.position.set(resolved.position.x, -resolved.position.y);
                container.scale.set(layout.scale.x, layout.scale.y);
                container.rotation = -layout.rotationDegrees * Math.PI / 180;

                parentSize = resolved.size;
                parentPivot = layout.pivot;
            });

            updateCamera();
        }

        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        application.ticker.add(() => {
            spine.update(Math.min(application.ticker.deltaMS / 1000, 0.05) * speed);
        });

        onVisibility = () => {
            if (document.hidden || !playing)
                application.stop();
            else
                application.start();
        };

        document.addEventListener("visibilitychange", onVisibility);
        application.render();
        onVisibility();

        return {
            dispose,
            animations: data.animations.map((animation) => animation.name),
            skins: data.skins.map((skin) => skin.name),
            setAnimation,
            setSkin,
            setPlaying(value) {
                if (disposed)
                    return;

                playing = value;
                onVisibility?.();
            },
            setSpeed(value) {
                if (!Number.isFinite(value) || value < 0.1 || value > 4)
                    throw new Error("Invalid animation speed.");

                speed = value;
            },
            zoomBy,
            resetView
        };
    }
    catch (error)
    {
        dispose();
        throw error;
    }
}
