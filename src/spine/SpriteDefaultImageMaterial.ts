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
varying vec2 vTextureCoord;

uniform vec4 uColor;
uniform sampler2D uSampler;

void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord) * uColor;

    color.rgb *= color.a;
    gl_FragColor = color;
}
`;

export class SpriteDefaultImageMaterial extends MeshMaterial {
    constructor(texture: Texture) {
        if (texture.baseTexture.alphaMode !== ALPHA_MODES.NPM)
            throw new Error("Sprite image material requires a straight-alpha texture.");

        super(texture, { program: Program.from(vertex, fragment) });
    }
}
