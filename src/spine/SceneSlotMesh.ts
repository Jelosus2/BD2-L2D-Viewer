import { DarkSlotMesh } from "@esotericsoftware/spine-pixi";

export class SceneSlotMesh extends DarkSlotMesh {
    override updateFromSpineData(...args: Parameters<DarkSlotMesh["updateFromSpineData"]>): void {
        super.updateFromSpineData(...args);
        this.alpha = args[3][5];
    }
}
