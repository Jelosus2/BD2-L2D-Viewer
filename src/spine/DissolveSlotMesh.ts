import type { CharacterDissolve } from "@/types/scene";
import type { SpineTexture } from "@esotericsoftware/spine-pixi-v7";

import { Program, Renderer, Texture } from "pixi.js";
import { SceneSlotMesh } from "./SceneSlotMesh";

const vertex = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform mat3 uTextureMatrix;

varying vec2 vTextureCoord;

void main(void) {
    gl_Position = vec4(
        (projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy,
        0.0,
        1.0
    );
    vTextureCoord = (uTextureMatrix * vec3(aTextureCoord, 1.0)).xy;
}
`;

const fragment = `
precision highp float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D uNoise;
uniform vec4 uVertexColor;
uniform vec4 uEdgeColor;
uniform vec4 uDissolveColor;
uniform float uAmount;
uniform float uFrequency;
uniform float uNoiseScale;
uniform float uNoiseStrength;
uniform float uExternalNoise;
uniform float uWidth;
uniform float uAngle;

float directionalHash(vec2 p) {
    p = fract(p * vec2(123.339996, 456.209991));
    p += dot(p, p + vec2(45.32));

    return fract(p.x * p.y);
}

float graphHash(vec2 p) {
    return fract(sin(dot(p, vec2(12.989800, 78.233002))) * 43758.546875);
}

float noise(vec2 p, bool graph) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);

    float a = graph ? graphHash(cell) : directionalHash(cell);
    float b = graph
        ? graphHash(cell + vec2(1.0, 0.0))
        : directionalHash(cell + vec2(1.0, 0.0));
    float c = graph
        ? graphHash(cell + vec2(0.0, 1.0))
        : directionalHash(cell + vec2(0.0, 1.0));
    float d = graph
        ? graphHash(cell + vec2(1.0, 1.0))
        : directionalHash(cell + vec2(1.0, 1.0));

    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

void main(void) {
    vec2 uv = vec2(vTextureCoord.x, 1.0 - vTextureCoord.y);
    vec4 sampled = texture2D(uSampler, vTextureCoord);
    vec4 result;

    if (uFrequency > 0.0) {
        float n = 0.125 * noise(uv * uFrequency, true)
            + 0.25 * noise(uv * (uFrequency * 0.5), true)
            + 0.5 * noise(uv * (uFrequency * 0.25), true);

        float kept = step(n, uAmount);
        float edge = step(n, uAmount + 0.01) - kept;

        result = (
            vec4(sampled.rgb, sampled.a * kept)
            + sampled.a * edge * uDissolveColor
        ) * uVertexColor;

        if (result.a == 0.0)
            discard;

        result = max(result, vec4(0.0));
    } else {
        vec2 p = uv * uNoiseScale;

        float n = 0.5 * noise(p, false)
            + 0.25 * noise(p * 2.1, false)
            + 0.125 * noise(p * 4.409999, false)
            + 0.0625 * noise(p * 9.260999, false);

        n = mix(
            n,
            texture2D(uNoise, vec2(p.x, 1.0 - p.y)).r,
            clamp(uExternalNoise, 0.0, 1.0)
        );

        float angle = uAngle * 0.017453292519943295;
        float value = clamp(
            dot(uv, vec2(cos(angle), sin(angle))),
            0.0,
            1.0
        ) + (n - 0.5) * uNoiseStrength;

        float kept = step(uAmount, value);
        float edge = (1.0 - kept)
            * smoothstep(uAmount - uWidth, uAmount, value);

        vec4 base = sampled * uVertexColor;

        result = vec4(
            mix(base.rgb, uEdgeColor.rgb, edge),
            base.a * (kept + edge * uEdgeColor.a)
        );
    }

    gl_FragColor = result;
}
`;

export class DissolveSlotMesh extends SceneSlotMesh {
    private readonly vertexColor = new Float32Array([1, 1, 1, 1]);

    constructor(private readonly dissolve: CharacterDissolve, private readonly rawTextures: ReadonlyMap<SpineTexture, SpineTexture> | undefined, noise?: Texture) {
        super();

        if (!rawTextures || dissolve.mode === "directional" && !noise)
            throw new Error("Missing raw character dissolve textures.");

        this.shader.program = Program.from(vertex, fragment);
        this.shader.batchable = false;

        Object.assign(this.shader.uniforms, {
            uNoise: noise ?? Texture.WHITE,
            uVertexColor: new Float32Array(4),
            uEdgeColor: new Float32Array(4),
            uDissolveColor: new Float32Array(4),
            uAmount: 0,
            uFrequency: 0,
            uNoiseScale: 1,
            uNoiseStrength: 0,
            uExternalNoise: 0,
            uWidth: 1,
            uAngle: 0
        });
    }

    override updateFromSpineData(...args: Parameters<SceneSlotMesh["updateFromSpineData"]>): void {
        const raw = this.rawTextures?.get(args[0]);
        if (!raw)
            throw new Error("Unresolved raw dissolve atlas page.");

        args[0] = raw;
        super.updateFromSpineData(...args);

        for (let i = 0; i < 4; i++)
            this.vertexColor[i] = Math.floor(Math.min(1, Math.max(0, args[3][i + 2])) * 255) / 255;
    }

    override _renderDefault(renderer: Renderer): void {
        const shader = this.shader;
        shader.update();

        const u = shader.uniforms;
        const d = this.dissolve;

        const writeColor = (name: string, color: { r: number; g: number; b: number; a: number }) => {
            u[name].set([color.r, color.g, color.b, color.a]);
        };

        u.uVertexColor.set(this.vertexColor);
        u.uVertexColor[3] *= this.parent?.worldAlpha ?? 1;
        u.uAmount = d.amount;
        u.uFrequency = d.mode === "noise-30" ? 30 : d.mode === "noise-50" ? 50 : 0;

        writeColor("uDissolveColor", d.dissolveColor);

        if (d.mode === "directional")
        {
            writeColor("uEdgeColor", d.edgeColor);

            u.uNoiseScale = d.noiseScale;
            u.uNoiseStrength = d.noiseStrength;
            u.uAngle = d.angle;
            u.uExternalNoise = d.externalNoise;
            u.uWidth = d.width;
        }

        renderer.batch.flush();

        u.translationMatrix = this.transform.worldTransform.toArray(true);

        renderer.shader.bind(shader);
        renderer.state.set(this.state);
        renderer.geometry.bind(this.geometry, shader);

        const gl = renderer.gl;

        try
        {
            gl.blendFuncSeparate(
                gl.SRC_ALPHA,
                gl.ONE_MINUS_SRC_ALPHA,
                d.mode === "directional" ? gl.SRC_ALPHA : gl.ONE,
                gl.ONE_MINUS_SRC_ALPHA
            );

            renderer.geometry.draw(this.drawMode, this.size, this.start, this.geometry.instanceCount);
        }
        finally
        {
            renderer.state.reset();
        }
    }
}
