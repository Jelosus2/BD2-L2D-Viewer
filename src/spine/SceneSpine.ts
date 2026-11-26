import { Physics, Spine } from "@esotericsoftware/spine-pixi-v7";

export class SceneSpine extends Spine {
    constructor(...args: ConstructorParameters<typeof Spine>) {
        super(...args);
        super.internalUpdate(0, 0);
    }

    override update(deltaSeconds: number): void {
        this.state.update(deltaSeconds);
        this.skeleton.update(deltaSeconds * this.state.timeScale);
    }

    applyPose(): void {
        this.state.apply(this.skeleton);
        this.skeleton.updateWorldTransform(Physics.update);
    }

    initializePose(animation: string | null, loop: boolean, mixSeconds?: number): void {
        if (animation !== null)
            this.state.setAnimation(0, animation, loop);

        this.update(0);
        this.applyPose();

        if (animation !== null && mixSeconds !== undefined)
        {
            const entry = this.state.setAnimation(0, animation, loop);
            entry.mixDuration = mixSeconds;
            entry.eventThreshold = entry.mixAttachmentThreshold = entry.mixDrawOrderThreshold = 0.5;

            this.update(0);
            this.applyPose();
        }
    }
}
