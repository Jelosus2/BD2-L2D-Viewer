import { BlendMode, DarkSlotMesh, SpineTexture } from "@esotericsoftware/spine-pixi";

export class SceneSlotMesh extends DarkSlotMesh {
    constructor(
        private readonly multiplyTextures?: ReadonlyMap<SpineTexture, SpineTexture>,
        private readonly normalMultiply = false,
        private readonly pmaVertexColors = false
    ) {
        super();
    }

    override updateFromSpineData(...args: Parameters<DarkSlotMesh["updateFromSpineData"]>): void {
        if (this.normalMultiply && args[1] === BlendMode.Multiply)
            args[1] = BlendMode.Normal;

        if (this.multiplyTextures && args[1] === BlendMode.Multiply)
        {
            const texture = this.multiplyTextures.get(args[0]);
            if (!texture)
                throw new Error("Missing native Spine multiply texture.");

            args[0] = texture;
        }

        super.updateFromSpineData(...args);
        const vertices = args[3];

        if (this.pmaVertexColors)
        {
            const alpha = Math.floor(vertices[5] * 255);

            this.tint = [
                Math.floor(vertices[2] * alpha) / 255,
                Math.floor(vertices[3] * alpha) / 255,
                Math.floor(vertices[4] * alpha) / 255
            ];
            this.darkTint = 0x000000;
            this.alpha = alpha / 255;
        }
        else
        {
            this.alpha = vertices[5];
        }
    }
}
