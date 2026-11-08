import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { SceneComponent, SceneNode, Vec2 } from "@/types/scene";
import type { SceneMedia } from "./loadSceneMedia";

import { resolveRectLayout } from "./resolveRectLayout";
import { createImageGeometry } from "@/scene/createImageGeometry";
import { SceneSpine } from "./SceneSpine";
import { SceneSlotMesh } from "./SceneSlotMesh";
import { MobileMultiplySlotMesh } from "./MobileMultiplySlotMesh";
import { SpriteDefaultImageMaterial } from "./SpriteDefaultImageMaterial";
import { AlphaClipImageMaterial } from "./AlphaClipImageMaterial";
import { BLEND_MODES, MASK_TYPES, MaskData, Container, Mesh, MeshMaterial, extensions } from "pixi.js";
import { DarkTintRenderer } from "@esotericsoftware/spine-pixi";

export interface CutsceneGraph {
    readonly root: Container;
    readonly nodes: ReadonlyMap<string, SceneNode>;
    readonly spines: ReadonlyMap<string, SceneSpine>;
    refresh(): void;
    resize(size: Vec2): void;
    dispose(): void;
}


extensions.add(DarkTintRenderer);

export function createCutsceneGraph(scene: CutsceneScene, resources: SceneMedia): CutsceneGraph {
    const root = new Container();
    const nodes = new Map<string, SceneNode>();
    const containers = new Map<string, Container>();
    const sizes = new Map<string, Vec2>();
    const spines = new Map<string, SceneSpine>();
    const images = new Map<string, {
        mesh: Mesh;
        mask?: Mesh;
        resize(size: Vec2, pivot: Vec2, uv: Extract<SceneComponent, { kind: "image" }>["uvRect"]): void;
    }>();

    let hostSize = { ...scene.layout.referenceSize };
    let disposed = false;

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        root.destroy({ children: true, texture: false, baseTexture: false });
        nodes.clear();
        containers.clear();
        sizes.clear();
        spines.clear();
        images.clear();
    }

    function refreshComponent(component: SceneComponent, size: Vec2, pivot: Vec2) {
        const { r, g, b, a } = component.color;

        if (component.kind === "spine")
        {
            const spine = spines.get(component.id)!;
            spine.visible = component.enabled;
            spine.skeleton.color.set(r, g, b, a);
            return;
        }

        const image = images.get(component.id)!;
        image.mesh.visible = component.enabled;
        image.mesh.alpha = a;
        image.mesh.tint = [r, g, b];

        if (image.mask)
        {
            image.mask.visible = component.enabled;
            image.mask.alpha = a;
        }

        image.resize(size, pivot, component.uvRect);
    }

    function refresh() {
        if (disposed)
            throw new Error("Cutscene graph has been disposed.");

        const orientation = hostSize.x >= hostSize.y ? "landscape" : "portrait";
        const layouts = scene.layoutProfiles?.find((profile) => profile.orientation === orientation)?.nodeLayouts;
        const worldScales = new Map<string, Vec2>();

        for (const node of nodes.values())
        {
            const layout = layouts?.[node.id] ?? node.layout;
            const container = containers.get(node.id)!;
            let size = { x: 0, y: 0 };
            let position: Vec2;

            if (layout.kind === "rect")
            {
                const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
                const parentLayout = parent ? layouts?.[parent.id] ?? parent.layout : undefined;
                const parentSize = node.parentId === null && scene.layout.rootMode === "stretch-to-host"
                    ? hostSize
                    : parent && parentLayout?.kind === "rect"
                        ? sizes.get(parent.id)!
                        : { x: 0, y: 0 };

                const parentPivot = parentLayout?.kind === "rect"
                    ? parentLayout.pivot
                    : { x: 0.5, y: 0.5 };

                const resolved = resolveRectLayout(layout, parentSize, parentPivot);

                size = resolved.size;
                position = resolved.position;
            }
            else
            {
                position = layout.position;
            }

            sizes.set(node.id, size);

            container.position.set(position.x, -position.y);

            const parentScale = node.parentId === null
                ? { x: 1, y: 1 }
                : worldScales.get(node.parentId)!;

            let scale = layout.scale;

            if (node.inverseParentScale)
            {
                if (!Number.isFinite(parentScale.x) || parentScale.x <= 0 || parentScale.x !== parentScale.y)
                    throw new Error("Inverse scale requires a uniform positive parent scale.");

                const pixelsPerWorldUnit = hostSize.y / node.inverseParentScale.cameraHeight;

                scale = {
                    x: pixelsPerWorldUnit / parentScale.x,
                    y: pixelsPerWorldUnit / parentScale.y
                };

                if (!Number.isFinite(scale.x) || !Number.isFinite(scale.y))
                    throw new Error("Inverse scale exceeds the supported range.");
            }

            worldScales.set(node.id, {
                x: parentScale.x * scale.x,
                y: parentScale.y * scale.y
            });

            container.scale.set(scale.x, scale.y);
            container.rotation = -layout.rotationDegrees * Math.PI / 180;
            container.alpha = node.opacity;
            container.visible = node.active;

            for (const component of node.components)
                refreshComponent(component, size, layout.kind === "rect" ? layout.pivot : { x: 0.5, y: 0.5 });
        }
    }

    function resize(size: Vec2) {
        if (disposed)
            throw new Error("Cutscene graph has been disposed.");
        if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.x <= 0 || size.y <= 0)
            throw new Error("Invalid cutscene host size.");

        hostSize = { x: size.x, y: size.y };
        refresh();
    }

    try
    {
        for (const node of structuredClone(scene.nodes))
        {
            nodes.set(node.id, node);

            const container = new Container();
            container.sortableChildren = true;
            container.zIndex = node.order;

            const parent = node.parentId === null ? root : containers.get(node.parentId);
            if (!parent)
                throw new Error(`Missing graph parent: ${node.parentId}`);

            parent.addChild(container);
            containers.set(node.id, container);

            for (const component of node.components)
            {
                const media = resources.items.get(component.mediaId);
                if (!media || media.kind !== component.kind)
                    throw new Error(`Missing graph media: ${component.id}`);

                if (component.kind === "spine" && media.kind === "spine")
                {
                    const settings = scene.media[component.mediaId];
                    if (settings.kind !== "spine")
                        throw new Error(`Missing Spine settings: ${component.id}`);

                    const spine = new SceneSpine(media.data, {
                        autoUpdate: false,
                        slotMeshFactory: () => settings.multiplyBlend === "mobile"
                            ? new MobileMultiplySlotMesh(media.multiplyTextures)
                            : new SceneSlotMesh(media.multiplyTextures, settings.multiplyBlend === "normal", component.pmaVertexColors === true)
                    });

                    container.addChild(spine);
                    spines.set(component.id, spine);

                    spine.zIndex = -1;
                    spine.scale.set(scene.layout.referencePixelsPerUnit * component.renderScale);

                    if (component.skin !== "")
                        spine.skeleton.setSkinByName(component.skin);

                    spine.skeleton.setSlotsToSetupPose();
                    spine.skeleton.scaleX = component.flipX ? -1 : 1;
                    spine.skeleton.scaleY = component.flipY ? -1 : 1;
                    spine.state.timeScale = component.timeScale ?? 1;
                    spine.state.data.defaultMix = settings.defaultMixSeconds;

                    for (const mix of settings.mixes)
                        spine.state.data.setMix(mix.from, mix.to, mix.seconds);

                    if (component.initialAnimation !== null)
                        spine.state.setAnimation(0, component.initialAnimation, component.initialLoop);

                    spine.update(0);
                    spine.applyPose();
                }
                else if (component.kind === "image" && media.kind === "image")
                {
                    const settings = scene.media[component.mediaId];
                    if (settings.kind !== "image")
                        throw new Error(`Missing image settings: ${component.id}`);

                    const prepared = createImageGeometry(component, settings, scene.layout.referencePixelsPerUnit);
                    const mask = node.mask?.imageComponentId === component.id ? node.mask : undefined;
                    const material = mask ? new AlphaClipImageMaterial(media.texture) : settings.premultiplyAlpha === "shader"
                        ? new SpriteDefaultImageMaterial(media.texture)
                        : new MeshMaterial(media.texture);

                    const image = new Mesh(prepared.geometry, material);
                    container.addChild(image);

                    let maskMesh: Mesh | undefined;

                    if (mask)
                    {
                        maskMesh = new Mesh(prepared.geometry, new AlphaClipImageMaterial(media.texture));
                        container.addChild(maskMesh);

                        const data = new MaskData(maskMesh);
                        data.type = MASK_TYPES.STENCIL;
                        data.autoDetect = false;

                        container.mask = data;
                        image.renderable = mask.showGraphic;
                    }

                    images.set(component.id, { mesh: image, mask: maskMesh, resize: prepared.resize });

                    image.zIndex = -1;
                    image.blendMode = {
                        normal: BLEND_MODES.NORMAL,
                        additive: BLEND_MODES.ADD,
                        multiply: BLEND_MODES.MULTIPLY,
                    }[component.blendMode];
                }
            }
        }

        refresh();
        return { root, nodes, spines, refresh, resize, dispose };
    }
    catch (error)
    {
        dispose();
        throw error;
    }
}
