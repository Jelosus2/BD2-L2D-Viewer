import type { MediaFile } from "@/types/media";

import { readAsset } from "@/data/readAsset";

export type StandingVoiceLanguage = "JP" | "KR";
export interface StandingVoiceLine { line: number; file: MediaFile }
export interface StandingPreviewEntry {
    id: string;
    label: string;
    kind: "character" | "npc";
    catalogUrl: string;
    voices: Record<StandingVoiceLanguage, StandingVoiceLine[]> | null;
}

function check(condition: unknown, message: string): asserts condition {
    if (!condition)
        throw new Error(`Invalid standing preview index: ${message}`);
}

function object(value: unknown): Record<string, unknown> {
    check(value !== null && typeof value === "object" && !Array.isArray(value), "expected object");
    return value as Record<string, unknown>;
}

export async function loadStandingPreviewIndex(signal: AbortSignal): Promise<{
    defaultId: string;
    items: StandingPreviewEntry[];
    aliases: Record<string, string>;
    revision: string;
}> {
    const value = object(JSON.parse(new TextDecoder().decode(
        await readAsset({ url: "data/standing-previews.json" }, signal, "no-store")
    )));

    check(value.schemaVersion === 1 && value.kind === "standing-preview-index" && typeof value.revision === "string" && /^[a-f0-9]{16}$/.test(value.revision), "unsupported schema/revision");
    check(Array.isArray(value.items) && value.items.length > 0, "empty catalog");

    const seen = new Set<string>();
    const items = value.items.map((raw): StandingPreviewEntry => {
        const entry = object(raw);

        check(typeof entry.id === "string" && /^(?:\d+|npc-[A-Za-z0-9_-]+)$/.test(entry.id) && !seen.has(entry.id), "invalid or duplicate ID");
        check(typeof entry.label === "string" && entry.label.trim().length > 0, "empty label");
        check(entry.kind === "character" || entry.kind === "npc", "invalid category");
        check(entry.catalogUrl === `data/prototype/${entry.id}.json`, "catalog owner mismatch");

        seen.add(entry.id);

        let voices: StandingPreviewEntry["voices"] = null;

        if (entry.voices !== null)
        {
            const source = object(entry.voices);
            const language = (key: StandingVoiceLanguage): StandingVoiceLine[] => {
                const lines = source[key];

                check(Array.isArray(lines) && lines.length === 3, "expected three lines per language");

                return lines.map((rawLine, index) => {
                    const line = object(rawLine);
                    const file = object(line.file);

                    check(line.line === index + 1 && typeof file.sha256 === "string" && /^[a-f0-9]{64}$/.test(file.sha256) &&
                        file.url === `assets/audio/standing/${file.sha256}.webm` && typeof file.bytes === "number" &&
                        Number.isSafeInteger(file.bytes) && file.bytes > 4, "invalid voice file/order");

                    return {
                        line: index + 1,
                        file: {
                            url: file.url,
                            sha256: file.sha256,
                            bytes: file.bytes
                        }
                    };
                });
            };

            voices = { JP: language("JP"), KR: language("KR") };
        }

        check(entry.kind !== "character" || /^\d+$/.test(entry.id) && voices !== null, "invalid character identity/voice lines");

        return {
            id: entry.id,
            label: entry.label,
            kind: entry.kind,
            catalogUrl: entry.catalogUrl as string,
            voices
        };
    });

    const aliases: Record<string, string> = Object.create(null);
    check(value.aliases === undefined || Array.isArray(value.aliases), "invalid aliases");

    for (const raw of value.aliases ?? [])
    {
        const alias = object(raw);

        check(typeof alias.id === "string" &&
            /^(?:\d+|npc-[A-Za-z0-9_-]+)$/.test(alias.id) &&
            !seen.has(alias.id) &&
            !Object.prototype.hasOwnProperty.call(aliases, alias.id) &&
            typeof alias.canonicalId === "string" &&
            seen.has(alias.canonicalId), "invalid alias target/identity");

        aliases[alias.id] = alias.canonicalId;
    }

    check(typeof value.defaultId === "string" && seen.has(value.defaultId), "missing default entry");
    signal.throwIfAborted();

    return { revision: value.revision, defaultId: value.defaultId, items, aliases };
}
