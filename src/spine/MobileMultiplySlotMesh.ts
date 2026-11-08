import type { Renderer } from "pixi.js";

import { Program } from "pixi.js";
import { BlendMode, DarkTintMaterial, SpineTexture } from "@esotericsoftware/spine-pixi";
import { SceneSlotMesh } from "./SceneSlotMesh";

const vertex = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy;
}
`;

const fragment = `
precision highp float;

varying vec2 vTextureCoord;

uniform vec4 uColor;
uniform sampler2D uSampler;

void main(void) {
    vec4 sampled = texture2D(uSampler, vTextureCoord);
    vec4 vertexColor = clamp(uColor, 0.0, 1.0);

    float alpha = sampled.a * vertexColor.a;
    gl_FragColor = vec4(1.0) + alpha * (sampled * vertexColor - vec4(1.0));
}
`;

export class MobileMultiplySlotMesh extends SceneSlotMesh {
    private readonly standardMaterial = this.shader;
    private readonly mobileMaterial = new DarkTintMaterial();
    private mobileMultiply = false;

    constructor(multiplyTextures?: ReadonlyMap<SpineTexture, SpineTexture>) {
        super(multiplyTextures);

        this.mobileMaterial.program = Program.from(vertex, fragment);
        this.mobileMaterial.batchable = false;
    }

    override updateFromSpineData(...args: Parameters<SceneSlotMesh["updateFromSpineData"]>): void {
        this.mobileMultiply = args[1] === BlendMode.Multiply;
        this.shader = this.mobileMultiply ? this.mobileMaterial : this.standardMaterial;

        super.updateFromSpineData(...args);
    }

    override _renderDefault(renderer: Renderer): void {
        if (!this.mobileMultiply)
        {
            super._renderDefault(renderer);
            return;
        }

        const shader = this.shader;
        shader.alpha = this.worldAlpha;
        shader.update();

        renderer.batch.flush();
        shader.uniforms.translationMatrix = this.transform.worldTransform.toArray(true);
        renderer.shader.bind(shader);
        renderer.state.set(this.state);
        renderer.geometry.bind(this.geometry, shader);

        const gl = renderer.gl;

        try
        {
            gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
            renderer.geometry.draw(this.drawMode, this.size, this.start, this.geometry.instanceCount);
        }
        finally
        {
            renderer.state.reset();
        }
    }
}
