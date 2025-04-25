// characterControls.ts

import * as THREE from 'three';
import { A, D, DIRECTIONS, S, W } from './utils';

export class CharacterControls {

    model: THREE.Group;
    mixer: THREE.AnimationMixer;
    animationsMap: Map<string, THREE.AnimationAction> = new Map(); // Idle, Move, Zap
    camera: THREE.Camera;

    // state
    currentAction: string;

    // temporary data
    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuaternion: THREE.Quaternion = new THREE.Quaternion();

    // constants and settings
    fadeDuration: number = 0.2;
    walkVelocity = 4;
    headHeight = 2.85;         // Vertical offset (head height)
    forwardOffset = -0.25;      // Forward offset: move the camera a bit ahead of the player

    // Head bobbing settings
    headBobTimer = 0;                   // Timer for head bobbing
    headBobAmplitudeVertical = 0.05;      // Amplitude for vertical bobbing
    headBobAmplitudeHorizontal = 0.05;     // Amplitude for horizontal bobbing (side-to-side)
    headBobFrequency = 6;                 // Frequency for the bobbing cycle

    constructor(
        model: THREE.Group,
        mixer: THREE.AnimationMixer,
        animationsMap: Map<string, THREE.AnimationAction>,
        camera: THREE.Camera,
        currentAction: string
    ) {
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;

        // Play the initial action.
        this.animationsMap.forEach((value, key) => {
            if (key === currentAction) {
                value.play();
            }
        });

        this.camera = camera;
        // Set the initial camera position based on the model's position and head height.
        this.updateCameraPosition();
    }

    /**
     * Updates the character control.
     * @param delta - Time delta from the animation loop.
     * @param keysPressed - Object containing keys currently pressed.
     * @param shooting - Boolean flag for the zap action.
     */
    public update(delta: number, keysPressed: any, shooting: boolean) {
        // Determine if any movement key is pressed.
        const directionPressed = DIRECTIONS.some((key: string) => keysPressed[key] === true);

        let play = '';
        if (shooting) {
            play = 'zap';
        } else if (directionPressed) {
            play = 'move';
        } else {
            play = 'idle';
        }

        if (this.currentAction !== play) {
            const toPlay = this.animationsMap.get(play);
            const current = this.animationsMap.get(this.currentAction);
            if (current && toPlay) {
                current.fadeOut(this.fadeDuration);
                toPlay.reset().fadeIn(this.fadeDuration).play();
                // Adjust timeScale for different actions.
                if (play === 'move') {
                    toPlay.timeScale = 1;
                } else if (play === 'idle') {
                    toPlay.timeScale = 1;
                } else if (play === 'zap') {
                    toPlay.setLoop(THREE.LoopOnce, 0);
                    toPlay.clampWhenFinished = true;
                    toPlay.timeScale = 5;
                }
                this.currentAction = play;
            }
        }

        // Update the animations mixer.
        this.mixer.update(delta);

        // Always update player's rotation (yaw) based on the camera's horizontal direction.
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // ignore pitch
        cameraDirection.normalize();
        const desiredAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
        this.rotateQuaternion.setFromAxisAngle(this.rotateAngle, desiredAngle);
        // Apply a dampened rotation to smoothly follow the camera's yaw.
        this.model.quaternion.rotateTowards(this.rotateQuaternion, 0.2);

        // Update head bob timer if moving, else reset.
        if (!shooting && directionPressed) {
            this.headBobTimer += delta;
        } else {
            this.headBobTimer = 0;
        }

        // Update movement only if not shooting and movement keys are pressed.
        if (!shooting && directionPressed) {
            this.camera.getWorldDirection(this.walkDirection);
            this.walkDirection.y = 0;
            this.walkDirection.normalize();
            const directionOffset = this.directionOffset(keysPressed);
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

            const velocity = this.walkVelocity;
            const moveX = this.walkDirection.x * velocity * delta;
            const moveZ = this.walkDirection.z * velocity * delta;
            this.model.position.x += moveX;
            this.model.position.z += moveZ;
        }

        // Always update the camera position (including head bobbing and forward offset).
        this.updateCameraPosition();
    }

    /**
     * Sets the camera position to the player's position plus a head-height vertical offset,
     * a forward offset, and adds head bobbing effects.
     */
    private updateCameraPosition() {
        // Base position: player's position + vertical head height.
        const basePos = new THREE.Vector3(
            this.model.position.x,
            this.model.position.y + this.headHeight,
            this.model.position.z
        );

        // Calculate the forward offset.
        const forward = new THREE.Vector3(0, 0, -1); // local negative Z is forward.
        forward.applyQuaternion(this.model.quaternion); // align with player's facing direction.
        forward.multiplyScalar(this.forwardOffset);

        // Calculate head bobbing offsets.
        // Vertical bobbing: using a sine wave.
        const bobOffsetY = Math.sin(this.headBobTimer * this.headBobFrequency) * this.headBobAmplitudeVertical;
        // Horizontal bobbing: side-to-side, using the player's right vector.
        const right = new THREE.Vector3(1, 0, 0); // local right direction.
        right.applyQuaternion(this.model.quaternion);
        const bobOffsetX = Math.sin(this.headBobTimer * this.headBobFrequency * 0.5) * this.headBobAmplitudeHorizontal;
        right.multiplyScalar(bobOffsetX);

        // Combine all offsets.
        const finalPos = new THREE.Vector3().copy(basePos)
            .add(forward)
            .add(new THREE.Vector3(right.x, bobOffsetY, right.z));

        this.camera.position.copy(finalPos);
    }

    private directionOffset(keysPressed: any) {
        let directionOffset = 0; // Default: forward (W)
        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4; // W + A
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4; // W + D
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 + Math.PI / 2; // S + A
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2; // S + D
            } else {
                directionOffset = Math.PI; // S
            }
        } else if (keysPressed[A]) {
            directionOffset = Math.PI / 2; // A
        } else if (keysPressed[D]) {
            directionOffset = -Math.PI / 2; // D
        }
        return directionOffset;
    }
}
