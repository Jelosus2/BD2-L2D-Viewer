import type { MediaFile } from "./media";

export type AudioVariant =
    | { state: "ready"; file: MediaFile; durationSeconds: number }
    | { state: "unavailable"; reason: string };

export interface AudioMedia {
    kind: "audio";
    role: "voice" | "effect" | "music";
    variants: Partial<Record<"JP" | "KR" | "default", AudioVariant>>;
}

export type AudioEndPolicy =
    | { mode: "let-finish" }
    | { mode: "stop" }
    | { mode: "fade"; seconds: number };

export interface AudioCue {
    id: string;
    mediaId: string;
    start: number;
    sourceWindowSeconds: number;
    offsetSeconds: number;
    gain: number;
    clipEndPolicy: AudioEndPolicy;
}
