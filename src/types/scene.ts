import type { AudioCue, AudioMedia } from "./audio";
import type { ImageMedia, SpineMedia } from "./media";

export interface Vec2 {
    x: number;
    y: number;
}

export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

export type NodeLayout = {
    scale: Vec2;
    rotationDegrees: number;
} & (
        | {
            kind: "rect";
            anchorMin: Vec2;
            anchorMax: Vec2;
            pivot: Vec2;
            anchoredPosition: Vec2;
            sizeDelta: Vec2;
        }
        | { kind: "transform"; position: Vec2 }
    );

export interface SceneLayout {
    rootMode: "stretch-to-host" | "authored";
    referenceSize: Vec2;
    landscapeReferenceSize?: Vec2;
    referencePixelsPerUnit: number;
    scaleMode: "constant-pixel-size" | "scale-with-screen-size";
    screenMatch?:
    | { mode: "match-width-or-height"; match: number }
    | { mode: "expand" | "shrink" };
}

export interface ImageSlicing {
    border: { left: number; bottom: number; right: number; top: number };
    pixelsPerUnit: number;
    fillCenter: boolean;
}

export type SceneComponent = {
    id: string;
    enabled: boolean;
    color: Color;
} & (
        | {
            kind: "spine";
            mediaId: string;
            skin: string;
            flipX: boolean;
            flipY: boolean;
            renderScale: number;
            initialAnimation: string | null;
            initialLoop: boolean;
            startupSequence?: Array<{ animation: string; loop: boolean }>;
            pmaVertexColors?: true;
            timeScale?: number;
            initialMixSeconds?: number;
            dissolve?: CharacterDissolve;
        }
        | {
            kind: "image";
            mediaId: string;
            blendMode: "normal" | "additive" | "multiply" | "screen";
            nativeMaterial?: "mobile-multiply" | "graph-additive";
            uvRect: { x: number; y: number; width: number; height: number };
            slicing?: ImageSlicing;
            worldSprite?: {
                positions: number[];
                uvs: number[];
                indices: number[];
                order: number;
            };
        }
    );

export interface SceneNode {
    id: string;
    parentId: string | null;
    order: number;
    active: boolean;
    opacity: number;
    layout: NodeLayout;
    components: SceneComponent[];
    inverseParentScale?: { cameraHeight: number; independentAxes?: true };
    mask?: { imageComponentId: string; showGraphic: boolean };
    planeRotation?: Vec2;
    boneFollower?: { targetComponentId: string; bone: string; rotation: boolean };
    projectionScaleZ?: number;
    projectedChild?: { depth: number };
    spatial?: {
        depth: number;
        scaleZ: number;
        rotation: Vec2;
        depthLimit: number;
    };
}

export type SpineMix =
    | { mode: "skeleton-default" }
    | { mode: "explicit"; seconds: number };

export type SpineClipEnd =
    | { mode: "continue" }
    | { mode: "freeze" }
    | { mode: "mix-out"; seconds: number };

export interface SpineClip {
    id: string;
    animation: string;
    start: number;
    duration: number;
    clipIn: number;
    speed: number;
    loop: boolean;
    mix: SpineMix;
    end: SpineClipEnd;
    alpha: number;
    holdPrevious: boolean;
    pauseWithScene: boolean;
    thresholds: { attachment: number; event: number; drawOrder: number };
    startExclusive?: true;
}

export interface SpineTrack {
    targetComponentId: string;
    trackIndex: number;
    clips: SpineClip[];
    overlap?: "animation-state";
}

export interface ActivationTrack {
    targetNodeId: string;
    ranges: Array<{ start: number; duration: number }>;
    postPlaybackState: "active" | "inactive" | "restore" | "leave";
}

export type NodeScalarProperty =
    | "opacity"
    | "layout.rotationDegrees"
    | `layout.${"position"| "anchoredPosition"| "anchorMin"| "anchorMax"| "scale"| "pivot"| "sizeDelta"}.${"x"| "y"}`
    | `planeRotation.${"x" | "y"}`
    | "projectionScaleZ"
    | "spatial.depth"
    | "spatial.scaleZ"
    | `spatial.rotation.${"x" | "y"}`;;

export type ScalarPropertyKey = {
    time: number;
    value: number;
} & (
    | { interpolation: "step" }
    | { interpolation: "linear" }
    | {
        interpolation: "cubic";
        coefficients: [cubic: number, quadratic: number, linear: number];
    }
);

export type PropertyTrack =
    | {
        kind: "scalar";
        target:
        | { kind: "node"; id: string; property: NodeScalarProperty }
        | {
            kind: "component";
            id: string;
            property:
                | `color.${"r" | "g" | "b" | "a"}`
                | `uvRect.${"x" | "y"}`
                | "dissolve.amount"
                | "dissolve.angle"
                | `dissolve.dissolveColor.${"r" | "g" | "b" | "a"}`;
        };
        keys: ScalarPropertyKey[];
    }
    | {
        kind: "boolean";
        target:
        | { kind: "node"; id: string; property: "active" }
        | { kind: "component"; id: string; property: "enabled" };
        keys: Array<{ time: number; value: boolean }>;
    }
    | {
        kind: "threshold";
        target: { kind: "node"; id: string; property: "active" };
        keys: ScalarPropertyKey[];
    };

export interface SceneTimeline {
    durationSeconds: number | null;
    spineTracks: SpineTrack[];
    activationTracks: ActivationTrack[];
    propertyTracks: PropertyTrack[];
    audioCues: AudioCue[];
    propertyPeriodSeconds?: number;
}

export interface SceneManifest {
    schemaVersion: 1;
    revision: string;
    id: string;
    variant: string;
    layout: SceneLayout;
    media: Record<string, SpineMedia | ImageMedia | AudioMedia>;
    nodes: SceneNode[];
    timeline: SceneTimeline;
    coverage: { excluded: string[]; unresolved: string[] };
    layoutProfiles?: SceneLayoutProfile[];
}

export interface SceneLayoutProfile {
    id: string;
    orientation: "portrait" | "landscape";
    referenceSize: Vec2;
    nodeLayouts: Record<string, NodeLayout>;
}

export type CharacterDissolve = {
    amount: number;
    dissolveColor: Color;
} & (
    | { mode: "noise-30" | "noise-50" }
    | {
        mode: "directional";
        noiseMediaId: string;
        noiseScale: number;
        noiseStrength: number;
        angle: number;
        width: number;
        externalNoise: number;
        edgeColor: Color;
    }
);
