import { Container, Geometry, Mesh, MeshMaterial } from "pixi.js";

export class WorldSpriteMesh extends Mesh<MeshMaterial> {
    constructor(geometry: Geometry, material: MeshMaterial, private readonly source: Container) {
        super(geometry, material);
    }

    override updateTransform(): void {
        super.updateTransform();
        this.transform.worldTransform.copyFrom(this.source.worldTransform);

        this.transform._worldID++;
        this.worldAlpha = this.alpha;
    }
}
