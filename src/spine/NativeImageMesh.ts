import { ALPHA_MODES, Container, Geometry, Mesh, MeshMaterial, Program, Renderer, Texture } from "pixi.js";

export class NativeAlphaContainer extends Container {
    override render(renderer: Renderer): void {
        if (!this.visible || !this.renderable)
            return;

        if (this.mask || this.filters?.length)
            throw new Error("Native image masks and filters require separate support.");

        this._render(renderer);

        for (const child of this.children)
            child.render(renderer);
    }
}

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

const fragments = {
    "mobile-multiply": `
precision highp float;

varying vec2 vTextureCoord;

uniform vec4 uColor;
uniform sampler2D uSampler;

void main(void) {
    vec4 sampled = texture2D(uSampler, vTextureCoord);
    vec4 color = clamp(uColor, 0.0, 1.0);

    float alpha = sampled.a * color.a;
    gl_FragColor = vec4(1.0) + alpha * (sampled * color - vec4(1.0));
}
`,
    "graph-additive": `
precision highp float;

varying vec2 vTextureCoord;

uniform vec4 uColor;
uniform sampler2D uSampler;

void main(void) {
    vec4 sampled = texture2D(uSampler, vTextureCoord);
    vec4 color = clamp(uColor, 0.0, 1.0);
    vec4 combined = sampled * color;

    gl_FragColor = vec4(color.rgb * combined.rgb * combined.a, 2.0 * sampled.a);
}
`
};

export class NativeImageMesh extends Mesh<MeshMaterial> {
    vertexAlpha = 1;

    constructor(geometry: Geometry, texture: Texture, private readonly mode: keyof typeof fragments) {
        if (texture.baseTexture.alphaMode !== ALPHA_MODES.NPM)
            throw new Error("Native image material requires a straight-alpha texture.");

        super(geometry, new MeshMaterial(texture, { program: Program.from(vertex, fragments[mode]) }));
        this.shader.batchable = false;
    }

    override render(renderer: Renderer): void {
        if (this.mode !== "graph-additive")
            return super.render(renderer);

        if (this.visible && this.renderable)
            this._render(renderer);
    }

    override _renderDefault(renderer: Renderer): void {
        const shader = this.shader;
        shader.alpha = this.worldAlpha * this.vertexAlpha;
        shader.update();

        renderer.batch.flush();

        shader.uniforms.translationMatrix = this.transform.worldTransform.toArray(true);

        renderer.shader.bind(shader);
        renderer.state.set(this.state);
        renderer.geometry.bind(this.geometry, shader);

        const gl = renderer.gl;

        try
        {
            if (this.mode === "mobile-multiply")
                gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
            else
                gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            renderer.geometry.draw(this.drawMode, this.size, this.start, this.geometry.instanceCount);
        }
        finally
        {
            renderer.state.reset();
        }
    }
}
