import { Spine } from "@esotericsoftware/spine-pixi";

export class SceneSpine extends Spine {
    applyPose(): void {
        super.updateSpineTransform();
    }

    protected override updateSpineTransform(): void {
        // The scene timeline evaluates poses; Pixi only updates display transforms here.
    }
}
