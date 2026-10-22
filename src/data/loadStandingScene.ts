import type { MediaFile, SpineMedia } from "@/types/media";
import type { NodeLayout, SceneComponent, SceneLayoutProfile, SceneNode, Vec2 } from "@/types/scene";

import { readAsset } from "@/data/readAsset";

type RectLayout = Extract<NodeLayout, { kind: "rect" }>;

interface StandingNode extends Pick<SceneNode, "id" | "active" | "opacity"> {
    layout: RectLayout;
}

interface StandingLayoutProfile extends Omit<SceneLayoutProfile, "nodeLayouts"> {
    nodeLayouts: Record<string, RectLayout>;
}

export interface StandingScene {
    name: string;
    media: SpineMedia;
    referenceSize: Vec2;
    referencePixelsPerUnit: number;
    screenMatch: "expand" | "shrink";
    nodes: StandingNode[];
    layoutProfiles: StandingLayoutProfile[];
    component: Extract<SceneComponent, { kind: "spine" }> & { initialAnimation: string };
}

export async function loadStandingScene(catalogUrl: string, signal: AbortSignal): Promise<StandingScene> {
    const catalog = object(JSON.parse(new TextDecoder().decode(
        await readAsset({ url: catalogUrl }, signal, "no-store")
    )));
    check(catalog.schemaVersion === 1, "unsupported catalog schema");

    const revision = text(catalog.revision);
    const items = array(catalog.items);
    check(items.length === 1, "prototype requires one catalog item");

    const item = object(items[0]);
    const options = array(item.options);
    check(options.length === 1, "prototype requires one catalog option");

    const option = object(options[0]);
    const scene = object(JSON.parse(new TextDecoder().decode(await readAsset({
        url: text(option.sceneUrl), sha256: hash(option.sceneSha256),
    }, signal))));
    check(scene.schemaVersion === 1 && scene.revision === revision, "scene schema/revision mismatch");
    check(scene.variant === "standing-prototype" || scene.variant === "standing-source", "unsupported scene variant");

    const timeline = object(scene.timeline);
    check(timeline.durationSeconds === null, "finite timelines are not supported yet");

    for (const key of ["spineTracks", "activationTracks", "propertyTracks", "audioCues"])
        check(array(timeline[key]).length === 0, `${key} are not supported yet`);

    const layout = object(scene.layout);
    check(layout.rootMode === "authored" && layout.scaleMode === "scale-with-screen-size", "unsupported canvas layout");
    check(layout.landscapeReferenceSize === undefined, "use layoutProfiles for landscape overrides");

    const mode = object(layout.screenMatch).mode;
    check(mode === "expand" || mode === "shrink", "unsupported screen matching mode");

    const rawNodes = array(scene.nodes).map(object);
    check(rawNodes.length > 0, "empty hierarchy");

    const ids = rawNodes.map((node) => text(node.id));
    check(new Set(ids).size === ids.length, "duplicate node ID");

    const nodes = rawNodes.map((node, index): StandingNode => {
        check(node.parentId === (index === 0 ? null : ids[index - 1]), "expected a parent-first chain");
        check(node.order === 0, "unsupported node order");
        check(array(node.components).length === (index === rawNodes.length - 1 ? 1 : 0), "expected one Spine component on the last node");

        return {
            id: ids[index]!,
            active: boolean(node.active),
            opacity: number(node.opacity, 0, 1),
            layout: rect(node.layout),
        };
    });

    const last = nodes[nodes.length - 1]!;
    check(last.layout.pivot.x === 0.5 && last.layout.pivot.y === 0.5, "Spine node requires a centered pivot");

    const profileIds = new Set<string>();
    const orientations = new Set<string>();

    const layoutProfiles = array(scene.layoutProfiles ?? []).map((value): StandingLayoutProfile => {
        const profile = object(value);
        const id = text(profile.id);
        const orientation = profile.orientation;
        check(!profileIds.has(id), "duplicate profile ID");
        check((orientation === "portrait" || orientation === "landscape") && !orientations.has(orientation), "invalid or duplicate profile orientation");

        profileIds.add(id);
        orientations.add(orientation);
        const overrides = object(profile.nodeLayouts);
        check(Object.keys(overrides).length === nodes.length &&
            ids.every((nodeId) => Object.prototype.hasOwnProperty.call(overrides, nodeId)), "profile node mismatch");

        const nodeLayouts = Object.fromEntries(ids.map((nodeId) => [nodeId, rect(overrides[nodeId])]));
        check(nodeLayouts[last.id]!.pivot.x === 0.5 && nodeLayouts[last.id]!.pivot.y === 0.5,
            "Spine profile requires a centered pivot");

        return { id, orientation, referenceSize: vector(profile.referenceSize, Number.MIN_VALUE), nodeLayouts };
    });

    check(scene.variant !== "standing-source" || layoutProfiles.length === 2, "source scene requires both profiles");

    const component = object(array(rawNodes[rawNodes.length - 1]!.components)[0]);
    check(component.kind === "spine", "expected a Spine component");

    const color = object(component.color);
    const mediaId = text(component.mediaId);
    const media = object(object(scene.media)[mediaId]);
    check(media.kind === "spine", "component media must be Spine");

    const version = text(media.version);
    check(/^4\.1\.\d+$/.test(version), "expected Spine 4.1");

    const pages = Object.entries(object(media.pages));
    check(pages.length > 0, "no atlas pages declared");

    return {
        name: text(item.name),
        referenceSize: vector(layout.referenceSize, Number.MIN_VALUE),
        referencePixelsPerUnit: number(layout.referencePixelsPerUnit, Number.MIN_VALUE),
        screenMatch: mode,
        nodes,
        layoutProfiles,
        media: {
            kind: "spine",
            version,
            skeleton: file(media.skeleton),
            atlas: file(media.atlas),
            pages: Object.fromEntries(pages.map(([name, value]) => [name, file(value)])),
            parseScale: number(media.parseScale, Number.MIN_VALUE),
            defaultMixSeconds: number(media.defaultMixSeconds, 0),
            mixes: array(media.mixes).map((value) => {
                const mix = object(value);
                return { from: text(mix.from), to: text(mix.to), seconds: number(mix.seconds, 0) };
            }),
        },
        component: {
            kind: "spine",
            id: text(component.id),
            mediaId,
            enabled: boolean(component.enabled),
            skin: text(component.skin),
            initialAnimation: text(component.initialAnimation),
            initialLoop: boolean(component.initialLoop),
            flipX: boolean(component.flipX),
            flipY: boolean(component.flipY),
            renderScale: number(component.renderScale, Number.MIN_VALUE),
            color: {
                r: number(color.r, 0, 1), g: number(color.g, 0, 1),
                b: number(color.b, 0, 1), a: number(color.a, 0, 1),
            },
        },
    };
}

function rect(value: unknown): RectLayout {
    const entry = object(value);
    check(entry.kind === "rect", "expected rect layout");

    const anchorMin = vector(entry.anchorMin, 0);
    const anchorMax = vector(entry.anchorMax, 0);
    const pivot = vector(entry.pivot, 0);
    check(anchorMin.x <= anchorMax.x && anchorMax.x <= 1 &&
        anchorMin.y <= anchorMax.y && anchorMax.y <= 1 && pivot.x <= 1 && pivot.y <= 1, "invalid anchors/pivot");

    return {
        kind: "rect",
        anchorMin,
        anchorMax,
        pivot,
        anchoredPosition: vector(entry.anchoredPosition),
        sizeDelta: vector(entry.sizeDelta),
        scale: vector(entry.scale),
        rotationDegrees: number(entry.rotationDegrees)
    };
}

function check(condition: unknown, message: string): asserts condition {
    if (!condition)
        throw new Error(`Invalid standing preview: ${message}`);
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

function boolean(value: unknown): boolean {
    check(typeof value === "boolean", "expected boolean");
    return value;
}

function vector(value: unknown, min = -Infinity): Vec2 {
    const entry = object(value);
    return { x: number(entry.x, min), y: number(entry.y, min) };
}

function hash(value: unknown): string {
    const result = text(value);
    check(/^[a-f\d]{64}$/i.test(result), "invalid SHA-256");

    return result;
}

function file(value: unknown): MediaFile {
    const entry = object(value);
    const bytes = number(entry.bytes, 0);
    check(Number.isSafeInteger(bytes), "invalid byte count");

    return { url: text(entry.url), sha256: hash(entry.sha256), bytes };
}
