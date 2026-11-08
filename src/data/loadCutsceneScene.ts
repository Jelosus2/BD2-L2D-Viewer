import type { ImageMedia, MediaFile, SpineMedia } from "@/types/media";
import type {
    Color,
    NodeLayout,
    PropertyTrack,
    ScalarPropertyKey,
    SceneComponent,
    SceneManifest,
    SceneNode,
    SceneTimeline,
    SpineClip,
    ImageSlicing,
    SceneLayoutProfile
} from "@/types/scene";
import type { AudioCue, AudioMedia } from "@/types/audio";

import { readAsset } from "@/data/readAsset";
import { createPropertySampler } from "@/scene/createPropertySampler";

export interface CutsceneScene extends Omit<SceneManifest, "media" | "timeline"> {
    media: Record<string, SpineMedia | ImageMedia | AudioMedia>;
    timeline: SceneTimeline;
}

export async function loadCutsceneScene(catalogUrl: string, signal: AbortSignal, variant: "cutscene" | "loop" = "cutscene"): Promise<{
    name: string;
    scene: CutsceneScene;
}> {
    check(variant === "cutscene" || variant === "loop", "unknown preview variant");

    const catalog = object(JSON.parse(new TextDecoder().decode(await readAsset({ url: catalogUrl }, signal, "no-store"))));
    check(catalog.schemaVersion === 1, "unsupported catalog schema");

    const revision = text(catalog.revision);
    const items = array(catalog.items);
    check(items.length === 1, "prototype requires one catalog item");

    const item = object(items[0]);
    const options = array(item.options);
    check(options.length === 1, "prototype requires one catalog option");

    const option = object(options[0]);
    check(option.id === variant, "unexpected catalog option");

    const raw = JSON.parse(new TextDecoder().decode(await readAsset({
        url: text(option.sceneUrl), sha256: hash(option.sceneSha256),
    }, signal)));
    const scene = parseScene(raw, revision, variant === "loop");
    check(scene.id === `${text(item.id)}:${variant}:prototype`, "catalog/scene identity mismatch");

    signal.throwIfAborted();

    return { name: text(item.name), scene };
}

function parseScene(value: unknown, revision: string, isLoop: boolean): CutsceneScene {
    const scene = object(value);
    check(scene.schemaVersion === 1 && scene.revision === revision, "scene schema/revision mismatch");
    check(scene.variant === (isLoop ? "cutscene-loop-prototype" : "cutscene-prototype"), "unsupported scene variant");

    const rawLayout = object(scene.layout);
    const rootMode = choice(rawLayout.rootMode, ["authored", "stretch-to-host"]);
    check(rawLayout.scaleMode === "scale-with-screen-size", "unsupported canvas layout");

    const landscapeReferenceSize = rawLayout.landscapeReferenceSize === undefined
        ? undefined
        : vector(rawLayout.landscapeReferenceSize, Number.MIN_VALUE);

    check(rootMode !== "stretch-to-host" || landscapeReferenceSize !== undefined, "native host requires a landscape reference");

    const mode = choice(object(rawLayout.screenMatch).mode, ["expand", "shrink"]);
    const media = new Map(Object.entries(object(scene.media)).map(([id, value]) => [text(id), parseMedia(value)]));
    check(media.size > 0, "empty media dictionary");

    const components = new Map<string, SceneComponent>();
    const nodeIds = new Set<string>();
    const siblings = new Set<string>();
    const usedMedia = new Set<string>();
    const nodes = array(scene.nodes).map((value, index): SceneNode => {
        const raw = object(value);
        const id = text(raw.id);
        check(!nodeIds.has(id), "duplicate node ID");

        const parentId = raw.parentId === null ? null : text(raw.parentId);
        check(index === 0 ? parentId === null : parentId !== null && nodeIds.has(parentId), "expected one root and parent-first hierarchy");

        const order = integer(raw.order);
        const sibling = JSON.stringify([parentId, order]);
        check(!siblings.has(sibling), "duplicate sibling order");

        siblings.add(sibling);
        nodeIds.add(id);

        const layout = parseLayout(raw.layout);
        const entries = array(raw.components).map((value): SceneComponent => {
            const component = parseComponent(value);
            check(component.kind !== "spine" || component.timeScale === undefined || isLoop, "per-instance Spine time scale requires a loop");
            check(layout.kind === "rect", "visual component requires a RectTransform");
            check(!components.has(component.id), "duplicate component ID");

            const asset = media.get(component.mediaId);
            check(asset?.kind === component.kind, "missing or incompatible component media");
            check(component.kind !== "image" || asset?.kind !== "image" ||
                asset.premultiplyAlpha !== "shader" || component.blendMode === "normal",
                "shader-premultiplied image requires normal blending");

            check(component.kind !== "image" || asset?.kind !== "image" ||
                asset.wrapMode !== "repeat" || !component.slicing,
                "repeat sampling requires an unsliced image");

            if (component.kind === "image" && component.slicing && asset?.kind === "image")
            {
                const { left, bottom, right, top } = component.slicing.border;
                const uv = component.uvRect;

                check(uv.width > 0 && uv.height > 0 && [uv.x, uv.y, uv.x + uv.width, uv.y + uv.height].every((value) => value >= 0 && value <= 1),
                    "sliced image region exceeds its texture");

                check(left + right <= uv.width * asset.width && bottom + top <= uv.height * asset.height && left + bottom + right + top > 0,
                    "invalid sliced image borders");
            }

            components.set(component.id, component);
            usedMedia.add(component.mediaId);

            return component;
        });

        return {
            id,
            parentId,
            order,
            active: boolean(raw.active),
            opacity: number(raw.opacity,
            0,
            1),
            layout,
            components: entries,
            ...(raw.mask === undefined ? {} : { mask: {
                imageComponentId: text(object(raw.mask).imageComponentId),
                showGraphic: boolean(object(raw.mask).showGraphic)
            } }),
            ...(raw.inverseParentScale === undefined ? {} : {
                inverseParentScale: {
                    cameraHeight: number(object(raw.inverseParentScale).cameraHeight, Number.MIN_VALUE)
                }
            })
        };
    });

    check(nodes.length > 0 && nodes[0].layout.kind === "rect", "missing authored root rectangle");

    const maskDepths = new Map<string, number>();

    for (const node of nodes)
    {
        const depth = (node.parentId === null ? 0 : maskDepths.get(node.parentId)!) + (node.mask ? 1 : 0);
        check(depth <= 8, "mask nesting exceeds native stencil depth");

        maskDepths.set(node.id, depth);

        if (!node.mask)
            continue;

        const image = node.components.find((component) => component.id === node.mask!.imageComponentId);
        const asset = image && media.get(image.mediaId);

        check(image?.kind === "image" && image.enabled && image.blendMode === "normal" && asset?.kind === "image" && asset.premultiplyAlpha !== "shader",
            "invalid mask image");
    }

    if (rootMode === "stretch-to-host")
    {
        const root = nodes[0].layout;

        check(
            root.kind === "rect" && root.anchorMin.x === 0 && root.anchorMin.y === 0 &&
            root.anchorMax.x === 1 && root.anchorMax.y === 1 &&
            root.pivot.x === 0.5 && root.pivot.y === 0.5 &&
            root.anchoredPosition.x === 0 && root.anchoredPosition.y === 0 &&
            root.sizeDelta.x === 0 && root.sizeDelta.y === 0 &&
            root.scale.x === 1 && root.scale.y === 1 && root.rotationDegrees === 0,
            "native host requires a centered full-stretch root"
        );
    }

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const timeline = object(scene.timeline);
    const clipIds = new Set<string>();
    const spineTargets = new Set<string>();
    const spineTracks = array(timeline.spineTracks).map((value) => {
        const track = object(value);
        const targetComponentId = text(track.targetComponentId);
        check(components.get(targetComponentId)?.kind === "spine", "invalid Spine track target");

        const trackIndex = integer(track.trackIndex);
        const target = JSON.stringify([targetComponentId, trackIndex]);
        check(!spineTargets.has(target), "duplicate Spine track");

        spineTargets.add(target);

        const overlap = track.overlap === undefined
            ? undefined
            : choice(track.overlap, ["animation-state"]);

        check(!isLoop || overlap === undefined, "overlapping tracks require a full cutscene");

        const clips = array(track.clips).map((value) => {
            const clip = parseClip(value);
            check(!clipIds.has(clip.id), "duplicate clip ID");
            check(overlap !== undefined || clip.startExclusive === undefined, "exclusive start requires an overlap policy");

            clipIds.add(clip.id);
            number(clip.start + clip.duration);
            number(clip.clipIn + clip.duration * clip.speed);

            return clip;
        });

        const tick = (value: number) => integer(Math.trunc(value / 1e-12 + 0.5));

        if (overlap === undefined)
        {
            let previousEnd = 0;

            for (const clip of clips)
            {
                check(tick(clip.start) >= tick(previousEnd), "unordered or overlapping Spine clips");
                previousEnd = clip.start + clip.duration;
            }
        }
        else
        {
            const times = clips.map((clip) => ({
                start: tick(clip.start),
                end: tick(clip.start + clip.duration)
            }));

            times.forEach((time, index) => {
                check(time.end > time.start && (index === 0 || (time.start > times[index - 1].start && time.end > times[index - 1].end)),
                    "simultaneous starts or nested clip ends");

                check(index < 2 || time.start >= times[index - 2].end, "more than two overlapping clips");
                number(clips[index].speed, 0.001, 1000);
            });

            check(times.some((time, index) => index > 0 && time.start < times[index - 1].end), "overlap policy requires overlapping clips");
        }

        return {
            targetComponentId,
            trackIndex,
            clips,
            ...(overlap ? { overlap } : {})
        };
    });

    const activationTargets = new Set<string>();
    const activationTracks = array(timeline.activationTracks).map((value) => {
        const track = object(value);
        const targetNodeId = text(track.targetNodeId);
        check(byId.has(targetNodeId) && !activationTargets.has(targetNodeId), "invalid or duplicate activation target");

        activationTargets.add(targetNodeId);
        let previousStart = 0;

        const ranges = array(track.ranges).map((value) => {
            const range = object(value);
            const start = number(range.start, 0);
            const duration = number(range.duration, Number.MIN_VALUE);
            check(start >= previousStart, "unordered activation ranges");

            previousStart = start;
            number(start + duration);

            return { start, duration };
        });

        return {
            targetNodeId,
            ranges,
            postPlaybackState: choice(track.postPlaybackState, ["active", "inactive", "restore", "leave"])
        };
    });

    const propertyTargets = new Set<string>();
    const propertyTracks = array(timeline.propertyTracks).map((value): PropertyTrack => {
        const raw = object(value);
        const target = object(raw.target);
        const kind = choice(raw.kind, ["scalar", "boolean"]);
        const targetKind = choice(target.kind, ["node", "component"]);
        const id = text(target.id);
        check(targetKind === "node" ? byId.has(id) : components.has(id), "missing property target");

        let track: PropertyTrack;
        if (kind === "boolean")
        {
            const keys = array(raw.keys).map((value) => {
                const key = object(value);
                check(key.interpolation === undefined && key.coefficients === undefined, "invalid boolean key");

                return { time: number(key.time, 0), value: boolean(key.value) };
            });

            if (targetKind === "node")
            {
                check(target.property === "active" && !activationTargets.has(id), "competing active-state control");
                track = { kind,target: { kind: "node", id, property: "active" }, keys };
            }
            else
            {
                check(target.property === "enabled", "unsupported boolean component property");
                track = { kind, target: { kind: "component", id, property: "enabled" }, keys };
            }
        }
        else
        {
            const keys = array(raw.keys).map(parseScalarKey);

            if (targetKind === "node")
            {
                const property = choice(target.property, [
                    "opacity", "layout.rotationDegrees",
                    "layout.scale.x", "layout.scale.y",
                    "layout.position.x", "layout.position.y",
                    "layout.anchoredPosition.x", "layout.anchoredPosition.y",
                    "layout.anchorMin.x", "layout.anchorMin.y",
                    "layout.anchorMax.x", "layout.anchorMax.y",
                    "layout.pivot.x", "layout.pivot.y",
                    "layout.sizeDelta.x", "layout.sizeDelta.y",
                ]);

                const layout = byId.get(id)?.layout;

                check(rootMode !== "stretch-to-host" || id !== nodes[0].id || !property.startsWith("layout."), "animated loaded-root layout requires separate support");
                check(!property.startsWith("layout.position.") || layout?.kind === "transform", "position on a rect node");
                check(
                    !/^layout\.(anchorMin|anchorMax|anchoredPosition|pivot|sizeDelta)\./.test(property) || layout?.kind === "rect",
                    "rect property on a transform node"
                );

                track = { kind, target: { kind: "node", id, property }, keys };
            }
            else
            {
                const property = choice(target.property, ["color.r", "color.g", "color.b", "color.a", "uvRect.x", "uvRect.y"]);

                if (property.startsWith("uvRect."))
                {
                    const component = components.get(id)!;
                    const asset = media.get(component.mediaId);

                    check(component.kind === "image" && !component.slicing && asset?.kind === "image" && asset.wrapMode === "repeat",
                        "animated UV requires an unsliced repeating image");
                }

                track = { kind, target: { kind: "component", id, property }, keys };
            }
        }

        const address = JSON.stringify(track.target);
        check(!propertyTargets.has(address), "duplicate animated property");

        propertyTargets.add(address);
        createPropertySampler(track);

        return track;
    });

    const audioIds = new Set<string>();
    let previousAudioStart = 0;

    const audioCues = array(timeline.audioCues).map((value): AudioCue => {
        const entry = object(value);
        const id = text(entry.id);
        const mediaId = text(entry.mediaId);
        const asset = media.get(mediaId);

        check(!audioIds.has(id) && !clipIds.has(id), "duplicate audio cue ID");
        check(asset?.kind === "audio", "invalid audio cue media");

        const cue = {
            id,
            mediaId,
            start: number(entry.start, 0),
            sourceWindowSeconds: number(entry.sourceWindowSeconds, Number.MIN_VALUE),
            offsetSeconds: number(entry.offsetSeconds, 0),
            gain: number(entry.gain, 0, 1),
            clipEndPolicy: {
                mode: choice(object(entry.clipEndPolicy).mode, ["let-finish", "stop"]),
            }
        };

        check(cue.start >= previousAudioStart, "unordered audio cues");
        number(cue.start + cue.sourceWindowSeconds);

        for (const variant of Object.values(asset.variants))
            check(variant?.state === "ready" && cue.offsetSeconds < variant.durationSeconds, "audio offset exceeds recording");

        audioIds.add(id);
        usedMedia.add(mediaId);
        previousAudioStart = cue.start;

        return cue;
    });

    check(usedMedia.size === media.size, "unreferenced media");

    const propertyPeriodSeconds = timeline.propertyPeriodSeconds === undefined
        ? undefined
        : number(timeline.propertyPeriodSeconds, 1e-12);

    check(propertyPeriodSeconds === undefined || (isLoop && Number.isSafeInteger(Math.trunc(propertyPeriodSeconds / 1e-12 + 0.5))),
        "invalid property repeat period");

    let durationSeconds: number | null = null;
    if (isLoop)
    {
        check(timeline.durationSeconds === null && spineTracks.length === 0 &&
            activationTracks.length === 0 && audioCues.length === 0,
            "loop contains unsupported timeline tracks");

        check(propertyPeriodSeconds === undefined
            ? propertyTracks.length === 0
            : propertyTracks.length > 0 && propertyTracks.every((track) => track.kind === "scalar" && track.keys[0].time === 0),
            "loop requires scalar properties and a repeat period");

        check(nodes.every((node) => node.active), "loop contains inactive nodes");

        const spines = [...components.values()].filter((component) => component.kind === "spine" && component.enabled);
        check(spines.length > 0 && spines.every((component) => component.kind === "spine" &&
            component.initialAnimation !== null && component.initialLoop), "missing authored Spine loop");
    }
    else
    {
        durationSeconds = number(timeline.durationSeconds, Number.MIN_VALUE);
        check(audioCues.every((cue) => cue.start <= durationSeconds!), "audio cue starts after scene end");
    }

    const profileIds = new Set<string>();
    const orientations = new Set<string>();
    let profileNodes: string | undefined;

    const layoutProfiles = scene.layoutProfiles === undefined
        ? undefined
        : array(scene.layoutProfiles).map((value): SceneLayoutProfile => {
            const profile = object(value);
            const id = text(profile.id);
            const orientation = choice(profile.orientation, ["portrait", "landscape"]);
            check(!profileIds.has(id) && !orientations.has(orientation), "duplicate layout profile");

            profileIds.add(id);
            orientations.add(orientation);

            const referenceSize = vector(profile.referenceSize, Number.MIN_VALUE);
            const expected = orientation === "portrait"
                ? vector(rawLayout.referenceSize, Number.MIN_VALUE)
                : landscapeReferenceSize ?? vector(rawLayout.referenceSize, Number.MIN_VALUE);

            check(referenceSize.x === expected.x && referenceSize.y === expected.y, "profile reference differs from canvas");

            const entries = Object.entries(object(profile.nodeLayouts));
            check(entries.length > 0, "empty profile overrides");

            const keys = JSON.stringify(entries.map(([nodeId]) => nodeId).sort());
            profileNodes ??= keys;

            check(keys === profileNodes, "profile node mismatch");

            const nodeLayouts = Object.fromEntries(entries.map(([nodeId, value]) => {
                const layout = parseLayout(value);
                check(nodeId !== nodes[0].id && byId.get(nodeId)?.layout.kind === "rect" && layout.kind === "rect", "unknown profile node, loaded-root override or incompatible layout");

                return [nodeId, layout];
            }));

            return { id, orientation, referenceSize, nodeLayouts };
        });

    check(layoutProfiles === undefined || layoutProfiles.length === 2, "expected both layout orientations");
    check(!layoutProfiles?.some((profile) => propertyTracks.some((track) =>
        track.target.kind === "node" && track.target.property.startsWith("layout.") &&
        Object.prototype.hasOwnProperty.call(profile.nodeLayouts, track.target.id))),
        "layout profile overrides animated layout");

    for (const node of nodes.filter((node) => node.inverseParentScale !== undefined))
    {
        check(rootMode === "stretch-to-host" && node.parentId !== null && node.layout.kind === "rect", "inverse scale requires a native child rectangle");
        check(!propertyTracks.some((track) => track.target.kind === "node" && track.target.id === node.id &&
            track.target.property.startsWith("layout.scale.")), "inverse scale target is animated");

        let parentId: string | null = node.parentId;

        while (parentId !== null)
        {
            const parent: SceneNode = byId.get(parentId)!;
            check(parent.inverseParentScale === undefined, "nested inverse scales");

            for (const layout of [parent.layout, ...(layoutProfiles ?? []).map((profile) => profile.nodeLayouts[parentId!]).filter(Boolean)])
                check(layout.scale.x === layout.scale.y && layout.scale.x > 0, "inverse scale requires uniform positive parents");

            parentId = parent.parentId;
        }
    }

    const coverage = object(scene.coverage);

    return {
        schemaVersion: 1,
        revision,
        id: text(scene.id),
        variant: isLoop ? "cutscene-loop-prototype" : "cutscene-prototype",
        layout: {
            rootMode,
            scaleMode: "scale-with-screen-size",
            referenceSize: vector(rawLayout.referenceSize, Number.MIN_VALUE),
            landscapeReferenceSize,
            referencePixelsPerUnit: number(rawLayout.referencePixelsPerUnit, Number.MIN_VALUE),
            screenMatch: { mode }
        },
        ...(layoutProfiles === undefined ? {} : { layoutProfiles }),
        media: Object.fromEntries(media),
        nodes,
        timeline: {
            durationSeconds,
            ...(propertyPeriodSeconds === undefined ? {} : { propertyPeriodSeconds }),
            spineTracks,
            activationTracks,
            propertyTracks,
            audioCues
        },
        coverage: {
            excluded: array(coverage.excluded).map(text),
            unresolved: array(coverage.unresolved).map(text)
        }
    };
}

function parseLayout(value: unknown): NodeLayout {
    const entry = object(value);
    const common = { scale: vector(entry.scale), rotationDegrees: number(entry.rotationDegrees) };

    if (entry.kind === "transform")
        return { ...common, kind: "transform", position: vector(entry.position) };

    check(entry.kind === "rect", "unknown node layout");

    const anchorMin = vector(entry.anchorMin);
    const anchorMax = vector(entry.anchorMax);

    return {
        ...common,
        kind: "rect",
        anchorMin,
        anchorMax,
        pivot: vector(entry.pivot),
        anchoredPosition: vector(entry.anchoredPosition),
        sizeDelta: vector(entry.sizeDelta)
    };
}

function parseComponent(value: unknown): SceneComponent {
    const entry = object(value);
    const common = { id: text(entry.id), mediaId: text(entry.mediaId), enabled: boolean(entry.enabled), color: color(entry.color) };

    if (entry.kind === "image")
    {
        const uv = object(entry.uvRect);
        const slicing = entry.slicing === undefined ? undefined : parseImageSlicing(entry.slicing);

        return {
            ...common,
            kind: "image",
            blendMode: choice(entry.blendMode, ["normal", "additive", "multiply"]),
            ...(slicing === undefined ? {} : { slicing }),
            uvRect: {
                x: number(uv.x),
                y: number(uv.y),
                width: number(uv.width),
                height: number(uv.height)
            }
        };
    }

    check(entry.kind === "spine" && entry.startupSequence === undefined, "unsupported component/startup sequence");
    check(entry.pmaVertexColors === undefined || entry.pmaVertexColors === true, "unsupported Spine vertex color policy");

    return {
        ...common,
        kind: "spine",
        skin: entry.skin === "" ? "" : text(entry.skin),
        flipX: boolean(entry.flipX),
        flipY: boolean(entry.flipY),
        renderScale: number(entry.renderScale, Number.MIN_VALUE),
        initialAnimation: entry.initialAnimation === null ? null : text(entry.initialAnimation),
        initialLoop: boolean(entry.initialLoop),
        ...(entry.timeScale === undefined ? {} : { timeScale: number(entry.timeScale, 0.001, 1000) }),
        ...(entry.pmaVertexColors === true ? { pmaVertexColors: true as const } : {})
    };
}

function parseImageSlicing(value: unknown): ImageSlicing {
    const entry = object(value);
    const border = object(entry.border);

    return {
        border: {
            left: number(border.left, 0),
            bottom: number(border.bottom, 0),
            right: number(border.right, 0),
            top: number(border.top, 0),
        },
        pixelsPerUnit: number(entry.pixelsPerUnit, Number.MIN_VALUE),
        fillCenter: boolean(entry.fillCenter)
    };
}

function parseMedia(value: unknown): SpineMedia | ImageMedia | AudioMedia {
    const entry = object(value);

    if (entry.kind === "image")
    {
        check(entry.wrapMode === undefined || entry.wrapMode === "repeat", "unsupported image wrap mode");

        const width = integer(entry.width, 1), height = integer(entry.height, 1);
        check(entry.wrapMode !== "repeat" || [width, height].every((value) => Number.isInteger(Math.log2(value))), "repeat image dimensions must be powers of two");

        check(entry.mipmap === undefined || entry.mipmap === false, "unsupported image mipmap policy");
        check(entry.premultiplyAlpha === undefined || entry.premultiplyAlpha === "shader", "unsupported image alpha policy");

        return {
            kind: "image",
            file: file(entry.file),
            width,
            height,
            ...(entry.wrapMode === "repeat" ? { wrapMode: "repeat" as const } : {}),
            ...(entry.mipmap === false ? { mipmap: false as const } : {}),
            ...(entry.premultiplyAlpha === "shader" ? { premultiplyAlpha: "shader" as const } : {})
        };
    }

    if (entry.kind === "audio")
        return parseAudioMedia(entry);

    check(entry.kind === "spine" && /^4\.1\.\d+$/.test(text(entry.version)), "expected Spine 4.1 or image media");
    const pages = Object.entries(object(entry.pages));

    check(pages.length > 0 && pages.every(([name]) => /^[^/\\]+\.png$/.test(name)), "invalid atlas page names");
    const pairs = new Set<string>();

    return {
        kind: "spine",
        version: text(entry.version),
        skeleton: file(entry.skeleton),
        atlas: file(entry.atlas),
        pages: Object.fromEntries(pages.map(([name, value]) => [name, file(value)])),
        ...(entry.multiplyBlend === undefined ? {} : {
            multiplyBlend: choice(entry.multiplyBlend, ["spine-ui", "normal", "mobile"]),
        }),
        parseScale: number(entry.parseScale, Number.MIN_VALUE), defaultMixSeconds: number(entry.defaultMixSeconds, 0),
        mixes: array(entry.mixes).map((value) => {
            const mix = object(value);
            const from = text(mix.from), to = text(mix.to);
            const pair = JSON.stringify([from, to]);
            check(!pairs.has(pair), "duplicate animation mix");

            pairs.add(pair);

            return { from, to, seconds: number(mix.seconds, 0) };
        })
    };
}

function parseAudioMedia(entry: Record<string, unknown>): AudioMedia {
    const role = choice(entry.role, ["voice", "effect"]);
    const variants = object(entry.variants);
    const languages = role === "voice" ? ["JP", "KR"] : ["default"];

    check(Object.keys(variants).length === languages.length &&
        languages.every((language) => Object.prototype.hasOwnProperty.call(variants, language)),
        "invalid audio language variants");

    return {
        kind: "audio",
        role,
        variants: Object.fromEntries(languages.map((language) => {
            const variant = object(variants[language]);
            check(variant.state === "ready", "prototype requires prepared audio");

            return [language, {
                state: "ready" as const,
                file: file(variant.file),
                durationSeconds: number(variant.durationSeconds, Number.MIN_VALUE),
            }];
        }))
    };
}

function parseClip(value: unknown): SpineClip {
    const entry = object(value), mix = object(entry.mix), end = object(entry.end), thresholds = object(entry.thresholds);
    const mixMode = choice(mix.mode, ["skeleton-default", "explicit"]);
    const endMode = choice(end.mode, ["continue", "freeze", "mix-out"]);
    check(entry.startExclusive === undefined || entry.startExclusive === true, "invalid exclusive clip start");

    return {
        id: text(entry.id),
        animation: text(entry.animation),
        start: number(entry.start, 0),
        ...(entry.startExclusive === true ? { startExclusive: true as const } : {}),
        duration: number(entry.duration, Number.MIN_VALUE),
        clipIn: number(entry.clipIn, 0),
        speed: number(entry.speed, Number.MIN_VALUE),
        loop: boolean(entry.loop),
        alpha: number(entry.alpha, 0, 1),
        holdPrevious: boolean(entry.holdPrevious),
        pauseWithScene: boolean(entry.pauseWithScene),
        mix: mixMode === "explicit" ? { mode: mixMode, seconds: number(mix.seconds, 0) } : { mode: mixMode },
        end: endMode === "mix-out" ? { mode: endMode, seconds: number(end.seconds, 0) } : { mode: endMode },
        thresholds: {
            attachment: number(thresholds.attachment, 0, 1),
            event: number(thresholds.event, 0, 1),
            drawOrder: number(thresholds.drawOrder, 0, 1)
        }
    };
}

function parseScalarKey(value: unknown): ScalarPropertyKey {
    const entry = object(value);
    const time = number(entry.time, 0), scalar = number(entry.value);
    const interpolation = choice(entry.interpolation, ["step", "linear", "cubic"]);

    if (interpolation !== "cubic")
        return { time, value: scalar, interpolation };

    const coefficients = array(entry.coefficients);
    check(coefficients.length === 3, "invalid cubic coefficients");

    return {
        time,
        value: scalar,
        interpolation,
        coefficients: [number(coefficients[0]), number(coefficients[1]), number(coefficients[2])]
    };
}

function check(condition: unknown, message: string): asserts condition {
    if (!condition)
        throw new Error(`Invalid cutscene preview: ${message}`);
}

function object(value: unknown): Record<string, unknown> {
    check(value !== null && typeof value === "object" && !Array.isArray(value), "expected object");
    return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
    check(Array.isArray(value), "expected array");
    return value;
}

function text(value: unknown): string {
    check(typeof value === "string" && value.trim().length > 0, "expected nonempty string");
    return value;
}

function number(value: unknown, min = -Infinity, max = Infinity): number {
    check(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max, "invalid number");
    return value;
}

function integer(value: unknown, min = 0): number {
    const result = number(value, min);
    check(Number.isSafeInteger(result), "invalid integer");

    return result;
}

function boolean(value: unknown): boolean {
    check(typeof value === "boolean", "expected boolean");
    return value;
}

function vector(value: unknown, min = -Infinity, max = Infinity) {
    const entry = object(value);
    return { x: number(entry.x, min, max), y: number(entry.y, min, max) };
}

function color(value: unknown): Color {
    const entry = object(value);
    return { r: number(entry.r, 0, 1), g: number(entry.g, 0, 1), b: number(entry.b, 0, 1), a: number(entry.a, 0, 1) };
}

function choice<const T extends string>(value: unknown, values: readonly T[]): T {
    check(typeof value === "string" && values.includes(value as T), "unsupported value");
    return value as T;
}

function hash(value: unknown): string {
    const result = text(value);
    check(/^[a-f\d]{64}$/i.test(result), "invalid SHA-256");

    return result;
}

function file(value: unknown): MediaFile {
    const entry = object(value);
    return { url: text(entry.url), sha256: hash(entry.sha256), bytes: integer(entry.bytes, 1) };
}
