import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { SceneComponent, SceneNode, Vec2 } from "@/types/scene";
import type { SceneMedia } from "./loadSceneMedia";
import type { SpatialMatrix } from "@/scene/createSpatialMatrix";

import { resolveRectLayout } from "./resolveRectLayout";
import { createImageGeometry } from "@/scene/createImageGeometry";
import { createProjectedChildMatrix } from "@/scene/createProjectedChildMatrix";
import { SceneSpine } from "./SceneSpine";
import { SceneSlotMesh } from "./SceneSlotMesh";
import { MobileMultiplySlotMesh } from "./MobileMultiplySlotMesh";
import { SpriteDefaultImageMaterial } from "./SpriteDefaultImageMaterial";
import { AlphaClipImageMaterial } from "./AlphaClipImageMaterial";
import { RepeatingImageMaterial } from "./RepeatingImageMaterial";
import { NativeAlphaContainer, NativeImageMesh } from "./NativeImageMesh";
import { WorldSpriteMesh } from "./WorldSpriteMesh";
import { createSpatialMatrix, relativeSpatialMatrix } from "@/scene/createSpatialMatrix";
import { DissolveSlotMesh } from "./DissolveSlotMesh";
import { BLEND_MODES, MASK_TYPES, MaskData, Container, Mesh, MeshMaterial, Matrix, extensions } from "pixi.js";
import { DarkTintRenderer } from "@esotericsoftware/spine-pixi-v7";

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
    const nativeAlphaNodes = new Set<string>();
    const independentScales = scene.nodes.some((node) => node.inverseParentScale?.independentAxes);

    for (const node of [...scene.nodes].reverse())
    {
        if (!nativeAlphaNodes.has(node.id) && !node.components.some((component) => component.kind === "image" && component.nativeMaterial === "graph-additive"))
            continue;

        nativeAlphaNodes.add(node.id);

        if (node.parentId !== null)
            nativeAlphaNodes.add(node.parentId);
    }

    const root = nativeAlphaNodes.size ? new NativeAlphaContainer() : new Container();
    root.sortableChildren = scene.nodes.some((node) => node.components.some((component) => component.kind === "image" && component.worldSprite));

    const nodes = new Map<string, SceneNode>();
    const containers = new Map<string, Container>();
    const sizes = new Map<string, Vec2>();
    const spines = new Map<string, SceneSpine>();
    const images = new Map<string, {
        mesh: Mesh;
        mask?: Mesh;
        resize(size: Vec2, pivot: Vec2, uv: Extract<SceneComponent, { kind: "image" }>["uvRect"]): void;
    }>();

    const animatedSizes = new Map<string, Set<string>>();

    for (const track of scene.timeline.propertyTracks)
    {
        if (track.target.kind !== "node" || !/^layout\.sizeDelta\.[xy]$/.test(track.target.property))
            continue;

        const axes = animatedSizes.get(track.target.id) ?? new Set<string>();

        axes.add(track.target.property.slice(-1));
        animatedSizes.set(track.target.id, axes);
    }

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

        if (component.worldSprite)
        {
            let owner = [...nodes.values()].find((node) => node.components.includes(component));

            while (owner)
            {
                image.mesh.visible &&= owner.active;
                owner = owner.parentId === null ? undefined : nodes.get(owner.parentId);
            }
        }

        if (image.mesh instanceof NativeImageMesh)
        {
            image.mesh.vertexAlpha = a;
            image.mesh.alpha = 1;
        }
        else
        {
            image.mesh.alpha = a;
        }

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
        const worldTransforms = new Map<string, { matrix: Matrix; rotation: number }>();
        const spatialMatrices = new Map<string, SpatialMatrix>();

        for (const node of nodes.values())
        {
            let layout = layouts?.[node.id] ?? node.layout;
            const axes = animatedSizes.get(node.id);

            if (layouts?.[node.id] && axes && layout.kind === "rect" && node.layout.kind === "rect")
            {
                layout = {
                    ...layout,
                    sizeDelta: {
                        x: axes.has("x") ? node.layout.sizeDelta.x : layout.sizeDelta.x,
                        y: axes.has("y") ? node.layout.sizeDelta.y : layout.sizeDelta.y
                    }
                };
            }

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
                : { ...worldScales.get(node.parentId)! };

            let scale = layout.scale;

            if (node.inverseParentScale)
            {
                if (node.inverseParentScale.independentAxes)
                {
                    const parent = worldTransforms.get(node.parentId!)!;
                    const { a, b, c, d } = parent.matrix;
                    const cosine = Math.cos(parent.rotation);
                    const sine = Math.sin(parent.rotation);

                    parentScale.x = cosine * a + sine * b;
                    parentScale.y = -sine * c + cosine * d;
                }

                if (
                    ![parentScale.x, parentScale.y].every((value) => Number.isFinite(value) && value > 0) ||
                    (!node.inverseParentScale.independentAxes && parentScale.x !== parentScale.y)
                )
                {
                    throw new Error("Inverse scale requires supported positive parent scales.");
                }

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

            if (node.spatial)
            {
                const parent = node.parentId === null
                    ? undefined
                    : spatialMatrices.get(node.parentId);

                const matrix = createSpatialMatrix(node, position, scale, parent);

                spatialMatrices.set(node.id, matrix);
                container.transform.setFromMatrix(relativeSpatialMatrix(matrix, parent));
            }

            if (node.planeRotation)
            {
                const x = node.planeRotation.x * Math.PI / 180;
                const y = node.planeRotation.y * Math.PI / 180;
                const z = layout.rotationDegrees * Math.PI / 180;
                const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
                const cz = Math.cos(z), sz = Math.sin(z);

                container.transform.setFromMatrix(new Matrix(
                    (cy * cz + sy * sx * sz) * scale.x, -cx * sz * scale.x,
                    (cy * sz - sy * sx * cz) * scale.y, cx * cz * scale.y,
                    position.x, -position.y
                ));
            }

            if (node.projectedChild)
                container.transform.setFromMatrix(createProjectedChildMatrix(nodes.get(node.parentId!)!, node, position));

            if (node.boneFollower)
            {
                const follower = node.boneFollower;
                const spine = spines.get(follower.targetComponentId);
                const bone = spine?.skeleton.findBone(follower.bone);

                if (!spine || !bone)
                    throw new Error("Missing follower Spine bone.");

                container.position.set(bone.worldX * scene.layout.referencePixelsPerUnit, bone.worldY * scene.layout.referencePixelsPerUnit);
                container.scale.set(1, -Math.sign(spine.skeleton.scaleX * spine.skeleton.scaleY));

                worldScales.set(node.id, { x: parentScale.x, y: parentScale.y * container.scale.y });

                if (follower.rotation)
                    container.rotation = Math.atan2(bone.c, bone.a);
            }

            if (independentScales) {
                container.transform.updateLocalTransform();

                const parentTransform = node.parentId === null
                    ? undefined
                    : worldTransforms.get(node.parentId)!;

                worldTransforms.set(node.id, {
                    matrix: parentTransform
                        ? parentTransform.matrix.clone().append(container.localTransform)
                        : container.localTransform.clone(),
                    rotation: (parentTransform?.rotation ?? 0) - layout.rotationDegrees * Math.PI / 180
                });
            }

            container.alpha = node.opacity;
            container.visible = node.active;

            for (const component of node.components)
                refreshComponent(component, size, layout.kind === "rect" ? layout.pivot : { x: 0.5, y: 0.5 });
        }

        for (const node of nodes.values())
        {
            if (!node.spatial)
                continue;

            let owner: SceneNode | undefined = node;
            let visible = true;

            while (owner)
            {
                visible &&= owner.active;
                owner = owner.parentId === null
                    ? undefined
                    : nodes.get(owner.parentId);
            }

            if (!visible)
                continue;

            const matrix = spatialMatrices.get(node.id)!.values;

            for (const component of node.components)
            {
                if (!component.enabled)
                    continue;

                const meshes = component.kind === "spine"
                    ? spines.get(component.id)!.children.filter((child): child is Mesh => child instanceof Mesh && child.visible && child.renderable)
                    : [images.get(component.id)!.mesh];

                const scale = component.kind === "spine"
                    ? scene.layout.referencePixelsPerUnit * component.renderScale
                    : 1;

                for (const mesh of meshes)
                {
                    const vertices = mesh.geometry.getBuffer("aVertexPosition").data;

                    for (let index = 0; index < vertices.length; index += 2)
                    {
                        const depth = matrix[8] * vertices[index] * scale - matrix[9] * vertices[index + 1] * scale + matrix[11];

                        if (!Number.isFinite(depth) || Math.abs(depth) >= node.spatial.depthLimit)
                            throw new Error("Projected artwork crosses the validated camera clipping interval.");
                    }
                }
            }
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

            const container = nativeAlphaNodes.has(node.id) ? new NativeAlphaContainer() : new Container();
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

                    const dissolve = component.dissolve;
                    const noise = dissolve?.mode === "directional"
                        ? resources.items.get(dissolve.noiseMediaId)
                        : undefined;

                    if (dissolve?.mode === "directional" && noise?.kind !== "image")
                        throw new Error("Missing character dissolve noise texture.");

                    const spine = new SceneSpine(media.data, {
                        autoUpdate: false,
                        slotMeshFactory: () => dissolve
                            ? new DissolveSlotMesh(dissolve, media.rawTextures, noise?.kind === "image" ? noise.texture : undefined)
                            : settings.multiplyBlend === "mobile"
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

                    spine.initializePose(component.initialAnimation, component.initialLoop, component.initialMixSeconds);
                }
                else if (component.kind === "image" && media.kind === "image")
                {
                    const settings = scene.media[component.mediaId];
                    if (settings.kind !== "image")
                        throw new Error(`Missing image settings: ${component.id}`);

                    const prepared = createImageGeometry(component, settings, scene.layout.referencePixelsPerUnit);
                    const mask = node.mask?.imageComponentId === component.id ? node.mask : undefined;
                    const repeatsNpot = settings.wrapMode === "repeat" && ![settings.width, settings.height].every((size) => Number.isInteger(Math.log2(size)));

                    if (repeatsNpot && (mask || settings.premultiplyAlpha === "shader" || settings.mipmap !== false))
                        throw new Error("Unsupported masked or custom-alpha repeat image.");

                    const material = component.nativeMaterial ? undefined : repeatsNpot ? new RepeatingImageMaterial(media.texture) : mask
                        ? new AlphaClipImageMaterial(media.texture)
                        : settings.premultiplyAlpha === "shader"
                            ? new SpriteDefaultImageMaterial(media.texture)
                            : new MeshMaterial(media.texture);

                    const image = component.nativeMaterial
                        ? new NativeImageMesh(prepared.geometry, media.texture, component.nativeMaterial)
                        : component.worldSprite
                            ? new WorldSpriteMesh(prepared.geometry, material!, container)
                            : new Mesh(prepared.geometry, material!);

                    if (component.worldSprite)
                        root.addChild(image);
                    else
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

                    image.zIndex = component.worldSprite?.order ?? -1;
                    image.blendMode = {
                        normal: BLEND_MODES.NORMAL,
                        additive: BLEND_MODES.ADD,
                        multiply: BLEND_MODES.MULTIPLY,
                        screen: BLEND_MODES.SCREEN
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
