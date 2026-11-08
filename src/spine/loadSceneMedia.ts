import type { ImageMedia, MediaFile, SpineMedia } from "@/types/media";
import type { SkeletonData } from "@esotericsoftware/spine-pixi";

import { readAsset } from "@/data/readAsset";
import { ALPHA_MODES, MIPMAP_MODES, WRAP_MODES, BaseTexture, Texture } from "pixi.js";
import { AtlasAttachmentLoader, SkeletonBinary, SpineTexture, TextureAtlas } from "@esotericsoftware/spine-pixi";

export type LoadedMedia =
    | { kind: "image"; texture: Texture }
    | {
        kind: "spine";
        data: SkeletonData;
        multiplyTextures?: ReadonlyMap<SpineTexture, SpineTexture>;
    };

export interface SceneMedia {
    readonly items: ReadonlyMap<string, LoadedMedia>;
    dispose(): void;
}

export async function loadSceneMedia(media: Readonly<Record<string, ImageMedia | SpineMedia>>, signal: AbortSignal): Promise<SceneMedia> {
    const controller = new AbortController();
    const items = new Map<string, LoadedMedia>();
    const bases = new Set<BaseTexture>();
    const images = new Set<Texture>();
    const atlases = new Set<TextureAtlas>();
    let disposed = false;

    function dispose() {
        if (disposed)
            return;

        disposed = true;

        controller.abort(signal.aborted ? signal.reason : undefined);
        signal.removeEventListener("abort", dispose);

        for (const image of images)
            image.destroy(false);

        for (const atlas of atlases)
            atlas.dispose();

        for (const base of bases)
            base.destroy();

        items.clear();
        images.clear();
        atlases.clear();
        bases.clear();
    }

    async function decode(file: MediaFile): Promise<HTMLImageElement> {
        const bytes = await readAsset(file, controller.signal);
        controller.signal.throwIfAborted();

        const image = new Image();
        const url = URL.createObjectURL(new Blob([bytes]));

        let rejectAbort: (reason: unknown) => void = () => {};
        const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
        const onAbort = () => {
            rejectAbort(controller.signal.reason);
            image.src = "";
        };

        controller.signal.addEventListener("abort", onAbort, { once: true });

        try
        {
            image.src = url;
            controller.signal.throwIfAborted();

            await Promise.race([image.decode(), aborted]);
            controller.signal.throwIfAborted();

            if (image.naturalWidth <= 0 || image.naturalHeight <= 0)
                throw new Error(`Invalid image dimensions: ${file.url}`);

            return image;
        }
        finally
        {
            controller.signal.removeEventListener("abort", onAbort);
            URL.revokeObjectURL(url);
        }
    }

    function base(image: HTMLImageElement, alphaMode: ALPHA_MODES): BaseTexture {
        controller.signal.throwIfAborted();

        const texture = new BaseTexture(image, { alphaMode });
        bases.add(texture);

        return texture;
    }

    async function loadSpine(media: SpineMedia): Promise<LoadedMedia> {
        const [binary, atlasBytes] = await Promise.all([
            readAsset(media.skeleton, controller.signal),
            readAsset(media.atlas, controller.signal),
        ]);

        controller.signal.throwIfAborted();

        const atlas = new TextureAtlas(new TextDecoder().decode(atlasBytes));
        atlases.add(atlas);

        const multiplyTextures = (media.multiplyBlend === "spine-ui" || media.multiplyBlend === "mobile")
            ? new Map<SpineTexture, SpineTexture>()
            : undefined;

        const names = new Set(atlas.pages.map((page) => page.name));
        if (names.size === 0 || names.size !== atlas.pages.length || names.size !== Object.keys(media.pages).length)
            throw new Error("Atlas pages do not match scene media.");

        for (const page of atlas.pages)
        {
            if (!Object.prototype.hasOwnProperty.call(media.pages, page.name))
                throw new Error(`Atlas page not declared: ${page.name}`);
            if (!Number.isSafeInteger(page.width) || page.width <= 0 || !Number.isSafeInteger(page.height) || page.height <= 0)
                throw new Error(`Invalid atlas dimensions: ${page.name}`);

            const image = await decode(media.pages[page.name]);
            const texture = base(image, page.pma ? ALPHA_MODES.PMA : ALPHA_MODES.UNPACK);
            const spineTexture = SpineTexture.from(texture);
            const logicalImage = new Image(page.width, page.height);

            spineTexture.getImage = () => logicalImage;
            page.setTexture(spineTexture);

            if (multiplyTextures)
            {
                const raw = SpineTexture.from(base(image, ALPHA_MODES.NPM));
                images.add(raw.texture);

                raw.getImage = () => logicalImage;
                raw.setFilters(page.minFilter, page.magFilter);
                raw.setWraps(page.uWrap, page.vWrap);

                multiplyTextures.set(spineTexture, raw);
            }
        }

        const parser = new SkeletonBinary(new AtlasAttachmentLoader(atlas));
        parser.scale = media.parseScale;

        const data = parser.readSkeletonData(new Uint8Array(binary));
        if (data.version !== media.version || !/^4\.1\.\d+$/.test(data.version))
            throw new Error(`Spine version mismatch: ${data.version}`);

        for (const mix of media.mixes)
        {
            if (!data.findAnimation(mix.from) || !data.findAnimation(mix.to))
                throw new Error(`Animation mix not found: ${mix.from} -> ${mix.to}`);
        }

        return {
            kind: "spine",
            data,
            ...(multiplyTextures ? { multiplyTextures } : {}),
        };
    }

    signal.addEventListener("abort", dispose, { once: true });

    try
    {
        signal.throwIfAborted();

        for (const [id, entry] of Object.entries(media))
        {
            controller.signal.throwIfAborted();

            if (entry.kind === "spine")
            {
                const loaded = await loadSpine(entry);

                controller.signal.throwIfAborted();
                items.set(id, loaded);
            }
            else
            {
                const image = await decode(entry.file);
                if (image.naturalWidth !== entry.width || image.naturalHeight !== entry.height)
                    throw new Error(`Image dimensions do not match scene media: ${entry.file.url}`);

                const texture = new Texture(base(image, entry.premultiplyAlpha === "shader" ? ALPHA_MODES.NPM : ALPHA_MODES.UNPACK));

                if (entry.wrapMode === "repeat")
                    texture.baseTexture.wrapMode = WRAP_MODES.REPEAT;

                if (entry.mipmap === false)
                    texture.baseTexture.mipmap = MIPMAP_MODES.OFF;

                images.add(texture);
                items.set(id, { kind: "image", texture });
            }
        }

        controller.signal.throwIfAborted();
        return { items, dispose };
    }
    catch (error)
    {
        dispose();
        throw error;
    }
}
