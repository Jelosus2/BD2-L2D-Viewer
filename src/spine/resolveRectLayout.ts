import type { NodeLayout, Vec2 } from "@/types/scene";

export interface ResolvedRectLayout {
    position: Vec2;
    size: Vec2;
}

export function resolveRectLayout(layout: Extract<NodeLayout, { kind: "rect" }>, parentSize: Vec2, parentPivot: Vec2 = { x: 0.5, y: 0.5 }): ResolvedRectLayout {
    const { anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta } = layout;
    const spanX = anchorMax.x - anchorMin.x;
    const spanY = anchorMax.y - anchorMin.y;

    return {
        size: {
            x: parentSize.x * spanX + sizeDelta.x,
            y: parentSize.y * spanY + sizeDelta.y,
        },
        position: {
            x: parentSize.x * (anchorMin.x + spanX * pivot.x - parentPivot.x) + anchoredPosition.x,
            y: parentSize.y * (anchorMin.y + spanY * pivot.y - parentPivot.y) + anchoredPosition.y,
        },
    };
}
