import type { MediaFile } from "@/types/media";

type AssetRequest = Pick<MediaFile, "url"> & Partial<Pick<MediaFile, "sha256" | "bytes">>;

export async function readAsset(file: AssetRequest, signal: AbortSignal, cache: RequestCache = "default"): Promise<ArrayBuffer> {
    signal.throwIfAborted();

    const base = new URL(import.meta.env.BASE_URL, document.baseURI);
    const url = new URL(file.url, base);

    if (
        !file.url || file.url.trim() !== file.url ||
        /^[a-z][a-z\d+.-]*:/i.test(file.url) ||
        file.url.startsWith("/") || file.url.includes("\\") ||
        url.origin !== base.origin || !url.pathname.startsWith(base.pathname) ||
        url.search || url.hash
    )
    {
        throw new Error(`Expected an app-relative asset path: ${file.url}`);
    }

    if (file.bytes !== undefined && (!Number.isSafeInteger(file.bytes) || file.bytes < 0))
        throw new Error(`Invalid byte count: ${file.url}`);

    if (file.sha256 !== undefined && !/^[a-f\d]{64}$/i.test(file.sha256))
        throw new Error(`Invalid SHA-256: ${file.url}`);

    const response = await fetch(url, { signal, cache });
    if (!response.ok)
        throw new Error(`Could not load ${file.url}: HTTP ${response.status}`);

    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();

    if (file.bytes !== undefined && bytes.byteLength !== file.bytes)
        throw new Error(`Byte count mismatch: ${file.url}`);

    if (file.sha256 !== undefined)
    {
        if (!globalThis.crypto?.subtle)
            throw new Error("Asset verification requires HTTPS or localhost.");

        const digest = await crypto.subtle.digest("SHA-256", bytes);
        signal.throwIfAborted();

        const actual = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
        if (actual !== file.sha256.toLowerCase())
            throw new Error(`SHA-256 mismatch: ${file.url}`);
    }

    return bytes;
}
