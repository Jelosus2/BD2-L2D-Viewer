import type { ImageMedia } from "@/types/media";
import type { SceneComponent, Vec2 } from "@/types/scene";

import { Geometry } from "pixi.js";

export function createImageGeometry(component: Extract<SceneComponent, { kind: "image" }>, media: ImageMedia, referencePixelsPerUnit: number) {
    const uv = component.uvRect;
    const right = uv.x + uv.width;
    const top = uv.y + uv.height;
    const slicing = component.slicing;
    const uvs: number[] = [];
    const indices: number[] = [];

    function validateUv(uv = component.uvRect) {
        const values = [uv.x, uv.y, uv.x + uv.width, uv.y + uv.height];

        if (!values.every(Number.isFinite) || ((slicing || media.wrapMode !== "repeat") && !values.every((value) => value >= 0 && value <= 1)))
            throw new Error(`Unsupported image UV coordinates: ${component.id}`);
    }

    validateUv();

    if (slicing && media.wrapMode === "repeat")
        throw new Error(`Repeated sliced images are not supported: ${component.id}`);

    if (slicing)
    {
        const border = slicing.border;
        const u = [uv.x, uv.x + border.left / media.width, right - border.right / media.width, right];
        const v = [1 - top, 1 - top + border.top / media.height, 1 - uv.y - border.bottom / media.height, 1 - uv.y];

        for (const y of v)
        {
            for (const x of u)
            {
                uvs.push(x, y);
            }
        }

        for (let y = 0; y < 3; y++)
        {
            for (let x = 0; x < 3; x++)
            {
                if (!slicing.fillCenter && x === 1 && y === 1)
                    continue;

                const index = y * 4 + x;
                indices.push(index, index + 1, index + 5, index, index + 5, index + 4);
            }
        }
    }
    else
    {
        uvs.push(uv.x, 1 - top, right, 1 - top, right, 1 - uv.y, uv.x, 1 - uv.y);
        indices.push(0, 1, 2, 0, 2, 3);
    }

    const geometry = new Geometry()
        .addAttribute("aVertexPosition", Array<number>(slicing ? 32 : 8).fill(0), 2)
        .addAttribute("aTextureCoord", uvs, 2)
        .addIndex(indices);

    const buffer = geometry.getBuffer("aVertexPosition");
    buffer.static = false;

    const uvBuffer = geometry.getBuffer("aTextureCoord");
    if (!slicing)
        uvBuffer.static = false;

    function resize(size: Vec2, pivot: Vec2, uv = component.uvRect) {
        const vertices = buffer.data;

        if (!slicing)
        {
            validateUv(uv);

            const rightUv = uv.x + uv.width;
            const topUv = 1 - (uv.y + uv.height);
            const bottomUv = 1 - uv.y;
            const coordinates = uvBuffer.data;

            coordinates[0] = uv.x;
            coordinates[1] = topUv;
            coordinates[2] = rightUv;
            coordinates[3] = topUv;
            coordinates[4] = rightUv;
            coordinates[5] = bottomUv;
            coordinates[6] = uv.x;
            coordinates[7] = bottomUv;

            uvBuffer.update();

            const left = -pivot.x * size.x;
            const right = (1 - pivot.x) * size.x;
            const top = -(1 - pivot.y) * size.y;
            const bottom = pivot.y * size.y;

            vertices[0] = left;
            vertices[1] = top;
            vertices[2] = right;
            vertices[3] = top;
            vertices[4] = right;
            vertices[5] = bottom;
            vertices[6] = left;
            vertices[7] = bottom;
        }
        else
        {
            const width = Math.max(0, size.x);
            const height = Math.max(0, size.y);
            const units = referencePixelsPerUnit / slicing.pixelsPerUnit;
            const border = slicing.border;
            const horizontal = (border.left + border.right) * units;
            const vertical = (border.bottom + border.top) * units;
            const scaleX = horizontal > 0 ? Math.min(1, width / horizontal) : 1;
            const scaleY = vertical > 0 ? Math.min(1, height / vertical) : 1;
            const left = -pivot.x * width;
            const top = -(1 - pivot.y) * height;
            const xs = [left, left + border.left * units * scaleX, left + width - border.right * units * scaleX, left + width];
            const ys = [top, top + border.top * units * scaleY, top + height - border.bottom * units * scaleY, top + height];

            for (let y = 0; y < 4; y++)
            {
                for (let x = 0; x < 4; x++)
                {
                    const index = (y * 4 + x) * 2;
                    vertices[index] = xs[x];
                    vertices[index + 1] = ys[y];
                }
            }
        }

        buffer.update();
    }

    return { geometry, resize };
}
