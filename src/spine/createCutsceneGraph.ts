import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { SceneComponent, SceneNode, Vec2 } from "@/types/scene";
import type { SceneMedia } from "./loadSceneMedia";

import { resolveRectLayout } from "./resolveRectLayout";
import { createImageGeometry } from "@/scene/createImageGeometry";
import { SceneSpine } from "./SceneSpine";
import { SceneSlotMesh } from "./SceneSlotMesh";
import { BLEND_MODES, Container, Mesh, MeshMaterial, extensions } from "pixi.js";
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
        resize(size: Vec2, pivot: Vec2): void;
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
        image.resize(size, pivot);
    }

    function refresh() {
        if (disposed)
            throw new Error("Cutscene graph has been disposed.");

        for (const node of nodes.values())
        {
            const layout = node.layout;
            const container = containers.get(node.id)!;
            let size = { x: 0, y: 0 };
            let position: Vec2;

            if (layout.kind === "rect")
            {
                const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
                const parentSize = node.parentId === null && scene.layout.rootMode === "stretch-to-host"
                    ? hostSize
                    : parent?.layout.kind === "rect"
                        ? sizes.get(parent.id)!
                        : { x: 0, y: 0 };

                const parentPivot = parent?.layout.kind === "rect" ? parent.layout.pivot : { x: 0.5, y: 0.5 };
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
            container.scale.set(layout.scale.x, layout.scale.y);
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
                        slotMeshFactory: () => new SceneSlotMesh(),
                    });

                    container.addChild(spine);
                    spines.set(component.id, spine);

                    spine.zIndex = -1;
                    spine.scale.set(scene.layout.referencePixelsPerUnit * component.renderScale);
                    spine.skeleton.setSkinByName(component.skin);
                    spine.skeleton.setSlotsToSetupPose();
                    spine.skeleton.scaleX = component.flipX ? -1 : 1;
                    spine.skeleton.scaleY = component.flipY ? -1 : 1;
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
                    const image = new Mesh(prepared.geometry, new MeshMaterial(media.texture));

                    container.addChild(image);
                    images.set(component.id, { mesh: image, resize: prepared.resize });

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
