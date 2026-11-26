import { ALPHA_MODES, MIPMAP_MODES, MeshMaterial, Program, Texture } from "pixi.js";

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
uniform vec2 uTextureSize;

vec4 texel(vec2 position) {
    vec2 uv = (mod(position, uTextureSize) + 0.5) / uTextureSize;
    return texture2D(uSampler, uv);
}

void main(void) {
    vec2 position = fract(vTextureCoord) * uTextureSize - 0.5;
    vec2 pixel = floor(position);
    vec2 weight = fract(position);

    vec4 top = mix(texel(pixel), texel(pixel + vec2(1.0, 0.0)), weight.x);
    vec4 bottom = mix(texel(pixel + vec2(0.0, 1.0)), texel(pixel + vec2(1.0, 1.0)), weight.x);

    gl_FragColor = mix(top, bottom, weight.y) * uColor;
}
`;

export class RepeatingImageMaterial extends MeshMaterial {
    constructor(texture: Texture) {
        const base = texture.baseTexture;

        if (base.alphaMode === ALPHA_MODES.NPM || base.mipmap !== MIPMAP_MODES.OFF)
            throw new Error("Repeat sampling requires premultiplied pixels and no mipmaps.");

        super(texture, {
            program: Program.from(vertex, fragment),
            uniforms: {
                uTextureSize: new Float32Array([base.width, base.height])
            }
        });
    }
}
