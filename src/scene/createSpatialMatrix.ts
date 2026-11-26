import type { SceneNode, Vec2 } from "@/types/scene";

import { Matrix } from "pixi.js";

export interface SpatialMatrix {
    values: number[];
    projected: Matrix;
}

export function createSpatialMatrix(node: SceneNode, position: Vec2, scale: Vec2, parent?: SpatialMatrix): SpatialMatrix {
    const spatial = node.spatial;
    if (!spatial)
        throw new Error("Missing spatial transform.");

    const x = spatial.rotation.x * Math.PI / 180;
    const y = spatial.rotation.y * Math.PI / 180;
    const z = node.layout.rotationDegrees * Math.PI / 180;
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);

    const local = [
        (cy * cz + sy * sx * sz) * scale.x,
        (-cy * sz + sy * sx * cz) * scale.y,
        sy * cx * spatial.scaleZ,
        position.x,

        cx * sz * scale.x,
        cx * cz * scale.y,
        -sx * spatial.scaleZ,
        position.y,

        (-sy * cz + cy * sx * sz) * scale.x,
        (sy * sz + cy * sx * cz) * scale.y,
        cy * cx * spatial.scaleZ,
        spatial.depth
    ];

    const values = parent ? local.map((_value, index) => {
        const row = Math.floor(index / 4);
        const column = index % 4;
        const p = parent.values;

        return [0, 1, 2].reduce(
            (sum, axis) => sum + p[row * 4 + axis] * local[axis * 4 + column],
            column === 3 ? p[row * 4 + 3] : 0
        );
    }) : local;

    if (!values.every(Number.isFinite))
        throw new Error("Invalid spatial matrix.");

    return {
        values,
        projected: new Matrix(
            values[0], -values[4],
            -values[1], values[5],
            values[3], -values[7]
        )
    };
}

export function relativeSpatialMatrix(current: SpatialMatrix, parent?: SpatialMatrix): Matrix {
    if (!parent)
        return current.projected.clone();

    const p = parent.projected;
    const determinant = p.a * p.d - p.b * p.c;

    if (!Number.isFinite(determinant))
        throw new Error("Invalid spatial projection determinant.");

    if (Math.abs(determinant) <= 1e-12)
    {
        if (
            [0, 1, 2, 4, 5, 6].every((index) => Math.abs(parent.values[index]) <= 1e-10) &&
            Math.abs(current.projected.tx - p.tx) <= 1e-8 &&
            Math.abs(current.projected.ty - p.ty) <= 1e-8
        )
        {
            return new Matrix();
        }

        throw new Error("Spatial parent projects to a singular plane.");
    }

    return p.clone().invert().append(current.projected);
}
