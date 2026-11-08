import { ALPHA_MODES, MeshMaterial, Program, Texture } from "pixi.js";

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
    float scaled = uColor.a * 255.0;
    float base = floor(scaled);
    float fraction = scaled - base;
    float rounded = fraction < 0.5 ? base : fraction > 0.5 ? base + 1.0 : base + mod(base, 2.0);
    float alpha = rounded / 255.0;

    vec4 color = texture2D(uSampler, vTextureCoord);

    if (color.a * alpha < 0.001) discard;
    gl_FragColor = color * uColor * (alpha / uColor.a);
}
`;

export class AlphaClipImageMaterial extends MeshMaterial {
    constructor(texture: Texture) {
        if (texture.baseTexture.alphaMode === ALPHA_MODES.NPM)
            throw new Error("UI mask requires a premultiplied texture.");

        super(texture, { program: Program.from(vertex, fragment) });
    }
}
