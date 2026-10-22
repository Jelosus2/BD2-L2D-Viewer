export interface MediaFile {
    url: string;
    sha256: string;
    bytes: number;
}

export interface SpineMedia {
    kind: "spine";
    version: string;
    skeleton: MediaFile;
    atlas: MediaFile;
    pages: Record<string, MediaFile>;
    parseScale: number;
    defaultMixSeconds: number;
    mixes: Array<{ from: string; to: string; seconds: number }>;
}

export interface ImageMedia {
    kind: "image";
    file: MediaFile;
    width: number;
    height: number;
}
