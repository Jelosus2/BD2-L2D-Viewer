import type { SceneNode } from "@/types/scene";

import { Matrix } from "pixi.js";

function rotation(node: SceneNode): number[][] {
    const x = (node.planeRotation?.x ?? 0) * Math.PI / 180;
    const y = (node.planeRotation?.y ?? 0) * Math.PI / 180;
    const z = node.layout.rotationDegrees * Math.PI / 180;
    const cx = Math.cos(x), sx = Math.sin(x);
    const cy = Math.cos(y), sy = Math.sin(y);
    const cz = Math.cos(z), sz = Math.sin(z);

    return [
        [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
        [cx * sz, cx * cz, -sx],
        [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx]
    ];
}

export function createProjectedChildMatrix(parent: SceneNode, child: SceneNode, position: { x: number; y: number }): Matrix {
    if (!parent.planeRotation || parent.projectionScaleZ === undefined || !child.projectedChild)
        throw new Error("Missing nested image projection metadata.");

    const p = rotation(parent);
    const c = rotation(child);
    const scales = [parent.layout.scale.x, parent.layout.scale.y, parent.projectionScaleZ];

    const combined = (row: number, column: number): number => p[row].reduce((sum, value, axis) => sum + value * scales[axis] * c[axis][column], 0);

    const a = p[0][0] * scales[0], b = -p[1][0] * scales[0];
    const cc = -p[0][1] * scales[1], d = p[1][1] * scales[1];
    const determinant = a * d - b * cc;

    if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-8)
        throw new Error("Singular nested image projection.");

    const inverse = (x: number, y: number): [number, number] => [(d * x - cc * y) / determinant, (-b * x + a * y) / determinant];

    const columnX = inverse(combined(0, 0), -combined(1, 0));
    const columnY = inverse(-combined(0, 1), combined(1, 1));
    const depth = child.projectedChild.depth * scales[2];
    const offset = inverse(p[0][2] * depth, -p[1][2] * depth);

    const matrix = new Matrix(
        columnX[0] * child.layout.scale.x, columnX[1] * child.layout.scale.x,
        columnY[0] * child.layout.scale.y, columnY[1] * child.layout.scale.y,
        position.x + offset[0], -position.y + offset[1]
    );

    if (![matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty].every(Number.isFinite))
        throw new Error("Invalid nested image projection.");

    return matrix;
}
