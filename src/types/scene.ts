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
        }
        | {
            kind: "image";
            mediaId: string;
            blendMode: "normal" | "additive" | "multiply";
            uvRect: { x: number; y: number; width: number; height: number };
            slicing?: ImageSlicing;
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
}

export interface SpineTrack {
    targetComponentId: string;
    trackIndex: number;
    clips: SpineClip[];
}

export interface ActivationTrack {
    targetNodeId: string;
    ranges: Array<{ start: number; duration: number }>;
    postPlaybackState: "active" | "inactive" | "restore" | "leave";
}

export type NodeScalarProperty =
    | "opacity"
    | "layout.rotationDegrees"
    | `layout.${"position"| "anchoredPosition"| "anchorMin"| "anchorMax"| "scale"| "pivot"| "sizeDelta"}.${"x"| "y"}`;

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
            property: `color.${"r" | "g" | "b" | "a"}`;
        };
        keys: ScalarPropertyKey[];
    }
    | {
        kind: "boolean";
        target:
        | { kind: "node"; id: string; property: "active" }
        | { kind: "component"; id: string; property: "enabled" };
        keys: Array<{ time: number; value: boolean }>;
    };

export interface SceneTimeline {
    durationSeconds: number | null;
    spineTracks: SpineTrack[];
    activationTracks: ActivationTrack[];
    propertyTracks: PropertyTrack[];
    audioCues: AudioCue[];
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
