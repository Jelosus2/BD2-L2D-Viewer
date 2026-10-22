import type { StandingScene } from "@/data/loadStandingScene";

import { readAsset } from "@/data/readAsset";
import { resolveRectLayout } from "@/spine/resolveRectLayout";
import { ALPHA_MODES, Application, BaseTexture, Container, extensions } from "pixi.js";
import {
    AtlasAttachmentLoader,
    DarkSlotMesh,
    DarkTintRenderer,
    SkeletonBinary,
    Spine,
    SpineTexture,
    TextureAtlas,
} from "@esotericsoftware/spine-pixi";

extensions.add(DarkTintRenderer);

export async function createStandingPreview(host: HTMLElement, scene: StandingScene, signal: AbortSignal): Promise<{ dispose(): void }> {
    const controller = new AbortController();
    const textures: BaseTexture[] = [];
    let atlas: TextureAtlas | undefined;
    let app: Application<HTMLCanvasElement> | undefined;
    let observer: ResizeObserver | undefined;
    let onVisibility: (() => void) | undefined;
    let disposed = false;

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        controller.abort();
        signal.removeEventListener("abort", dispose);
        observer?.disconnect();

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

            const bytes = await readAsset(media.pages[page.name]!, controller.signal);
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
        if (!data.findAnimation(component.initialAnimation))
            throw new Error(`Animation not found: ${component.initialAnimation}`);
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
            slotMeshFactory: () => new DarkSlotMesh(),
        });

        const canvasRoot = new Container();
        application.stage.addChild(canvasRoot);

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

        spine.state.setAnimation(0, component.initialAnimation, component.initialLoop);
        spine.update(0);

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
                const container = containers[index]!;

                container.position.set(resolved.position.x, -resolved.position.y);
                container.scale.set(layout.scale.x, layout.scale.y);
                container.rotation = -layout.rotationDegrees * Math.PI / 180;

                parentSize = resolved.size;
                parentPivot = layout.pivot;
            });
        }

        observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        application.ticker.add(() => {
            spine.update(Math.min(application.ticker.deltaMS / 1000, 0.05));
        });

        onVisibility = () => {
            if (document.hidden)
                application.stop();
            else
                application.start();
        };

        document.addEventListener("visibilitychange", onVisibility);
        application.render();
        onVisibility();

        return { dispose };
    }
    catch (error)
    {
        dispose();
        throw error;
    }
}
