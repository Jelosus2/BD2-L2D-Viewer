import { readAsset } from "@/data/readAsset";

export interface CutscenePreviewEntry {
    id: string;
    label: string;
    catalogUrl: string;
    variant: "cutscene" | "loop";
}

export interface CutscenePreviewIndex {
    revision: string;
    defaultId: string;
    items: CutscenePreviewEntry[];
}

function check(condition: unknown, message: string): asserts condition {
    if (!condition)
        throw new Error(`Invalid cutscene preview index: ${message}`);
}

function object(value: unknown): Record<string, unknown> {
    check(value !== null && typeof value === "object" && !Array.isArray(value), "expected an object");
    return value as Record<string, unknown>;
}

export async function loadCutscenePreviewIndex(signal: AbortSignal): Promise<CutscenePreviewIndex> {
    const bytes = await readAsset({ url: "data/cutscene-previews.json" }, signal, "no-store");
    const data = object(JSON.parse(new TextDecoder().decode(bytes)) as unknown);

    check(data.schemaVersion === 1 && typeof data.revision === "string" && /^[a-f0-9]{16}$/.test(data.revision), "unsupported schema or revision");
    check(Array.isArray(data.items) && data.items.length > 0, "missing preview entries");

    const ids = new Set<string>();
    const items = data.items.map((value: unknown): CutscenePreviewEntry => {
        const item = object(value);
        const { id, label, catalogUrl, variant } = item;

        check(typeof id === "string" && /^CutScene\d+(?:_loop(?:_\d+)?)?$/.test(id) && !ids.has(id), "invalid or duplicate preview ID");
        check(typeof label === "string" && label.trim().length > 0 && label.trim() === label, "missing preview label");
        check(variant === "cutscene" || variant === "loop", "unknown preview variant");
        check(id.includes("_loop") === (variant === "loop") && catalogUrl === `data/${variant === "loop" ? "cutscene-loop" : "cutscene"}/prototype/${id}.json`,
            "catalog/variant mismatch");

        ids.add(id);

        return { id, label, catalogUrl, variant };
    });

    const defaultId = data.defaultId;
    check(typeof defaultId === "string" && ids.has(defaultId), "missing default preview");

    signal.throwIfAborted();
    return { revision: data.revision, defaultId, items };
}
