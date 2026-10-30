import type { PropertyTrack, ScalarPropertyKey } from "@/types/scene";

export function createPropertySampler(track: Extract<PropertyTrack, { kind: "scalar" }>): (timeSeconds: number) => number | undefined;
export function createPropertySampler(track: Extract<PropertyTrack, { kind: "boolean" }>): (timeSeconds: number) => boolean | undefined;
export function createPropertySampler(track: PropertyTrack): (timeSeconds: number) => number | boolean | undefined;
export function createPropertySampler(track: PropertyTrack) {
    function check(condition: unknown, message: string): asserts condition {
        if (!condition)
            throw new Error(`Invalid property track: ${message}`);
    }

    function finite(value: number): number {
        check(typeof value === "number" && Number.isFinite(value), "non-finite value");
        return value;
    }

    check(track?.kind === "scalar" || track?.kind === "boolean", "unknown track kind");
    check(Array.isArray(track.keys) && track.keys.length > 0, "empty or missing keys");

    const keys = track.kind === "scalar"
        ? track.keys.map((key): ScalarPropertyKey => {
            const time = finite(key?.time);
            const value = finite(key?.value);

            check(key.interpolation === "step" || key.interpolation === "linear" || key.interpolation === "cubic", "unknown interpolation");

            if (key.interpolation === "cubic")
            {
                check(Array.isArray(key.coefficients) && key.coefficients.length === 3, "invalid cubic coefficients");

                return {
                    time,
                    value,
                    interpolation: "cubic",
                    coefficients: [
                        finite(key.coefficients[0]),
                        finite(key.coefficients[1]),
                        finite(key.coefficients[2]),
                    ]
                };
            }

            return { time, value, interpolation: key.interpolation };
        })
        : track.keys.map((key) => {
            const time = finite(key?.time);
            check(typeof key.value === "boolean", "invalid boolean value");

            return { time, value: key.value };
        });

    keys.forEach((key, index) => {
        check(key.time >= 0 && (index === 0 || key.time > keys[index - 1].time), "negative or unordered key time");
    });

    return (timeSeconds: number): number | boolean | undefined => {
        finite(timeSeconds);
        check(timeSeconds >= 0, "negative sample time");

        let low = 0;
        let high = keys.length;

        while (low < high)
        {
            const middle = Math.floor((low + high) / 2);

            if (keys[middle].time <= timeSeconds)
                low = middle + 1;
            else
                high = middle;
        }

        if (low === 0)
            return undefined;

        const key = keys[low - 1];
        if (!("interpolation" in key) || key.interpolation === "step" || low === keys.length)
            return key.value;

        const value = key.value;
        const next = keys[low];
        const nextValue = next.value;

        check(typeof value === "number" && typeof nextValue === "number", "invalid scalar values");

        const delta = timeSeconds - key.time;
        if (key.interpolation === "linear")
            return finite(value + (nextValue - value) * (delta / (next.time - key.time)));

        const [a, b, c] = key.coefficients;
        return finite(((a * delta + b) * delta + c) * delta + value);
    };
}
