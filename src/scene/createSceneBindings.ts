import type { CutsceneScene } from "@/data/loadCutsceneScene";
import type { CutsceneGraph } from "@/spine/createCutsceneGraph";
import type { PropertyTrack } from "@/types/scene";

import { createPropertySampler } from "@/scene/createPropertySampler";

export interface SceneBindings {
    evaluate(timeSeconds: number): void;
    dispose(): void;
}

interface Property<Value> {
    read(): Value;
    write(value: Value): void;
}

export function createSceneBindings(scene: CutsceneScene, graph: CutsceneGraph): SceneBindings {
    let disposed = false;
    let evaluated = false;
    const components = new Map([...graph.nodes.values()].flatMap((node) => node.components.map((component) => [component.id, component] as const)));

    function node(id: string) {
        const value = graph.nodes.get(id);
        if (!value)
            throw new Error(`Missing animated node: ${id}`);

        return value;
    }

    function component(id: string) {
        const value = components.get(id);
        if (!value)
            throw new Error(`Missing animated component: ${id}`);

        return value;
    }

    function field<ObjectType, Key extends keyof ObjectType>(object: ObjectType, key: Key): Property<ObjectType[Key]> {
        return {
            read: () => object[key],
            write: (value) => {
                object[key] = value;
            }
        };
    }

    function scalar(target: Extract<PropertyTrack, { kind: "scalar" }>["target"]): Property<number> {
        if (target.kind === "component")
        {
            const color = component(target.id).color;
            const properties = {
                "color.r": field(color, "r"),
                "color.g": field(color, "g"),
                "color.b": field(color, "b"),
                "color.a": field(color, "a"),
            };

            return properties[target.property];
        }

        const value = node(target.id);

        if (target.property === "opacity")
            return field(value, "opacity");
        if (target.property === "layout.rotationDegrees")
            return field(value.layout, "rotationDegrees");

        const [, name, axis] = target.property.split(".");
        const layout = value.layout;
        const vector = name === "scale" ? layout.scale
            : name === "position" && layout.kind === "transform" ? layout.position
            : name === "anchoredPosition" && layout.kind === "rect" ? layout.anchoredPosition
            : name === "anchorMin" && layout.kind === "rect" ? layout.anchorMin
            : name === "anchorMax" && layout.kind === "rect" ? layout.anchorMax
            : name === "pivot" && layout.kind === "rect" ? layout.pivot
            : name === "sizeDelta" && layout.kind === "rect" ? layout.sizeDelta
            : undefined;

        if (!vector || (axis !== "x" && axis !== "y"))
            throw new Error(`Invalid animated layout property: ${target.property}`);

        return field(vector, axis);
    }

    function animate<Value>(property: Property<Value>, sample: (time: number) => Value | undefined) {
        const initial = property.read();

        return (time: number) => {
            const value = sample(time) ?? initial;
            return () => property.write(value);
        };
    }

    const properties = scene.timeline.propertyTracks.map((track) => {
        if (track.kind === "scalar")
            return animate(scalar(track.target), createPropertySampler(track));

        const target = track.target;
        const property = target.kind === "node"
            ? field(node(target.id), "active")
            : field(component(target.id), "enabled");

        return animate(property, createPropertySampler(track));
    });

    function tick(seconds: number): number {
        const value = Math.trunc(seconds / 1e-12 + 0.5);
        if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(value))
            throw new Error("Scene time is outside the supported tick range.");

        return value;
    }

    const activations = scene.timeline.activationTracks.map((track) => {
        const target = node(track.targetNodeId);
        const policy = track.postPlaybackState;
        const ranges = track.ranges.map((range) => ({
            start: tick(range.start),
            end: tick(range.start + range.duration),
        }));
        let initial: boolean | undefined;

        return {
            apply(time: number) {
                initial ??= target.active;
                target.active = ranges.some((range) => time >= range.start && time < range.end);
            },
            finish() {
                if (initial === undefined || policy === "leave")
                    return;

                target.active = policy === "restore" ? initial : policy === "active";
            }
        };
    });

    return {
        evaluate(timeSeconds) {
            if (disposed)
                throw new Error("Scene bindings have been disposed.");

            const time = tick(timeSeconds);
            const writes = properties.map((prepare) => prepare(timeSeconds));

            for (const write of writes)
                write();

            for (const activation of activations)
                activation.apply(time);

            evaluated = true;
            graph.refresh();
        },
        dispose() {
            if (disposed)
                return;

            disposed = true;

            for (const activation of activations)
                activation.finish();
            if (evaluated && activations.length > 0)
                graph.refresh();

            properties.length = 0;
            activations.length = 0;

            components.clear();
        }
    };
}
