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
    multiplyBlend?: "spine-ui" | "normal" | "mobile";
}

export interface ImageMedia {
    kind: "image";
    file: MediaFile;
    width: number;
    height: number;
    mipmap?: false;
    premultiplyAlpha?: "shader";
    wrapMode?: "repeat";
}
