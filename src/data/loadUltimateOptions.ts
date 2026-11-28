import type { CutscenePreviewEntry } from "@/data/loadCutscenePreviewIndex";
import type { loadStandingPreviewIndex } from "@/data/loadStandingPreviewIndex";

import { readAsset } from "@/data/readAsset";
import { loadCutscenePreviewIndex } from "@/data/loadCutscenePreviewIndex";

export async function loadUltimateOptions(
    standing: Awaited<ReturnType<typeof loadStandingPreviewIndex>>,
    signal: AbortSignal
): Promise<Map<string, CutscenePreviewEntry[]>> {
    const [bytes, cutscenes] = await Promise.all([
        readAsset({ url: "data/ultimate-options.json" }, signal, "no-store"),
        loadCutscenePreviewIndex(signal)
    ]);

    const value = JSON.parse(new TextDecoder().decode(bytes));

    if (
        !value || value.schemaVersion !== 1 || value.kind !== "ultimate-options" ||
        !/^[a-f0-9]{16}$/.test(value.revision) || value.standingRevision !== standing.revision ||
        value.cutsceneRevision !== cutscenes.revision || !Array.isArray(value.items))
    {
        throw new Error("Ultimate options are stale; regenerate data/ultimate-options.json.");
    }

    const ids = new Set(standing.items.map((item) => item.id));
    const previews = new Map(cutscenes.items.map((item) => [item.id, item]));
    const result = new Map<string, CutscenePreviewEntry[]>();
    const claimed = new Set<string>();

    for (const item of value.items)
    {
        if (
            !item || typeof item.id !== "string" || !ids.has(item.id) || result.has(item.id) ||
            !Array.isArray(item.options) || item.options.length === 0 ||
            new Set(item.options).size !== item.options.length)
        {
            throw new Error("Invalid Ultimate option owner.");
        }

        const options = item.options.map((id: unknown) => {
            const entry = typeof id === "string" ? previews.get(id) : undefined;
            if (!entry)
                throw new Error("Missing prepared Ultimate animation.");

            claimed.add(entry.id);
            return entry;
        });

        if (options[0].variant !== "cutscene" || options.filter((entry: CutscenePreviewEntry) => entry.variant === "cutscene").length !== 1)
            throw new Error("Invalid full cutscene/loop order.");

        result.set(item.id, options);
    }

    if (claimed.size !== previews.size)
        throw new Error("Some prepared Ultimate animations are not linked.");

    signal.throwIfAborted();
    return result;
}
