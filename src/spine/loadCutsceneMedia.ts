import type { SkeletonData } from "@esotericsoftware/spine-pixi";
import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { SceneMedia } from "./loadSceneMedia";
import type { ImageMedia, SpineMedia } from "@/types/media";

import { loadSceneMedia } from "./loadSceneMedia";

export async function loadCutsceneMedia(scene: CutsceneScene, signal: AbortSignal): Promise<SceneMedia> {
    const visualMedia: Record<string, ImageMedia | SpineMedia> = {};

    for (const [id, media] of Object.entries(scene.media))
    {
        if (media.kind !== "audio")
            visualMedia[id] = media;
    }

    const resources = await loadSceneMedia(visualMedia, signal);

    try
    {
        signal.throwIfAborted();
        const dataByComponent = new Map<string, SkeletonData>();

        for (const node of scene.nodes)
        {
            for (const component of node.components)
            {
                const media = resources.items.get(component.mediaId);
                if (!media || media.kind !== component.kind)
                    throw new Error(`Missing component media: ${component.id}`);

                if (component.kind !== "spine" || media.kind !== "spine")
                    continue;

                if (!media.data.findSkin(component.skin))
                    throw new Error(`Skin not found: ${component.skin}`);
                if (component.initialAnimation !== null && !media.data.findAnimation(component.initialAnimation))
                    throw new Error(`Animation not found: ${component.initialAnimation}`);

                dataByComponent.set(component.id, media.data);
            }
        }

        for (const track of scene.timeline.spineTracks)
        {
            const data = dataByComponent.get(track.targetComponentId);
            if (!data)
                throw new Error(`Missing Spine target: ${track.targetComponentId}`);

            for (const clip of track.clips)
            {
                if (!data.findAnimation(clip.animation))
                    throw new Error(`Animation not found: ${clip.animation}`);
            }
        }

        signal.throwIfAborted();
        return resources;
    }
    catch (error)
    {
        resources.dispose();
        throw error;
    }
}
