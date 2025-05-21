// characterControls.ts

import * as THREE from 'three';
import { A, D, DIRECTIONS, S, W } from './utils';

export class CharacterControls {
    model: THREE.Group;
    mixer: THREE.AnimationMixer;
    animationsMap: Map<string, THREE.AnimationAction> = new Map();
    camera: THREE.Camera;

    // state
    currentAction: string;

    // temporary data
    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuaternion: THREE.Quaternion = new THREE.Quaternion();
    isShooting: boolean = false;

    // controller input
    leftStickX: number = 0;
    leftStickY: number = 0;
    rightStickX: number = 0;
    rightStickY: number = 0;

    // constants and settings
    fadeDuration: number = 0.2;
    walkVelocity = 4;
    headHeight = 2.85;
    forwardOffset = -0.25;
    lookSensitivity = 0.1; // Adjust this to control look speed

    // Head bobbing settings
    headBobTimer = 0;
    headBobAmplitudeVertical = 0.05;
    headBobAmplitudeHorizontal = 0.05;
    headBobFrequency = 6;

    // Gamepad state
    private gamepadLoop: number | null = null;
    private leftController: Gamepad | null = null;
    private rightController: Gamepad | null = null;

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
        this.camera = camera;

        // Play the initial action
        this.animationsMap.forEach((value, key) => {
            if (key === currentAction) {
                value.play();
            }
        });

        // Set up gamepad input
        this.setupGamepadInput();
    }

    private setupGamepadInput() {
        // Check for gamepad support
        if (!navigator.getGamepads) {
            console.warn('Gamepad API not supported');
            return;
        }

        // Listen for gamepad connections
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad);
            this.identifyControllers();
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('Gamepad disconnected:', e.gamepad);
            if (this.gamepadLoop) {
                cancelAnimationFrame(this.gamepadLoop);
                this.gamepadLoop = null;
            }
            this.leftController = null;
            this.rightController = null;
        });

        // Initial controller identification
        this.identifyControllers();
    }

    private identifyControllers() {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;

        // Find Oculus Touch controllers
        const controllers = Array.from(gamepads).filter(g => g && (
            g.id.includes('Oculus Touch') || 
            g.id.includes('oculus-touch-v3')
        ));

        if (controllers.length >= 2) {
            // Log controller details for debugging
            controllers.forEach((controller, index) => {
                console.log(`Controller ${index}:`, {
                    id: controller.id,
                    axes: controller.axes,
                    buttons: controller.buttons.map(b => b.pressed)
                });
            });

            // Assign controllers based on index (usually 0 is left, 1 is right)
            this.leftController = controllers[0];
            this.rightController = controllers[1];

            // Start polling if not already running
            if (!this.gamepadLoop) {
                this.startGamepadPolling();
            }
        }
    }

    private startGamepadPolling() {
        const pollGamepads = () => {
            if (!this.leftController || !this.rightController) {
                this.gamepadLoop = null;
                return;
            }

            // Update controller references
            const gamepads = navigator.getGamepads();
            if (gamepads) {
                this.leftController = gamepads[this.leftController.index];
                this.rightController = gamepads[this.rightController.index];
            }

            if (this.leftController) {
                // Left stick for mouse movement (axes 0,1)
                this.leftStickX = this.leftController.axes[0];
                this.leftStickY = this.leftController.axes[1];

                // Map A button to F key (button 4 on Oculus Touch)
                if (this.leftController.buttons[4].pressed) {
                    const event = new KeyboardEvent('keydown', { key: 'f' });
                    document.dispatchEvent(event);
                } else {
                    const event = new KeyboardEvent('keyup', { key: 'f' });
                    document.dispatchEvent(event);
                }

                // Map X button to space bar (button 6 on Oculus Touch)
                if (this.leftController.buttons[6].pressed) {
                    const event = new KeyboardEvent('keydown', { key: ' ' });
                    document.dispatchEvent(event);
                } else {
                    const event = new KeyboardEvent('keyup', { key: ' ' });
                    document.dispatchEvent(event);
                }
            }

            if (this.rightController) {
                // Right stick for WASD movement (axes 2,3)
                this.rightStickX = this.rightController.axes[2];
                this.rightStickY = this.rightController.axes[3];

                // Right trigger for shooting (button 5 on Oculus Touch)
                this.isShooting = this.rightController.buttons[5].pressed;
            }

            this.gamepadLoop = requestAnimationFrame(pollGamepads);
        };

        this.gamepadLoop = requestAnimationFrame(pollGamepads);
    }

    public update(delta: number, keysPressed: any, shooting: boolean) {
        // Update head bob timer
        this.headBobTimer += delta;

        // Map controller inputs to keyboard/mouse inputs
        if (Math.abs(this.leftStickX) > 0.1 || Math.abs(this.leftStickY) > 0.1) {
            // Simulate mouse movement on the renderer's canvas
            const event = new MouseEvent('mousemove', {
                clientX: window.innerWidth / 2 + this.leftStickX * 100,
                clientY: window.innerHeight / 2 + this.leftStickY * 100
            });
            document.querySelector('canvas')?.dispatchEvent(event);
        }

        // Map right stick to WASD keys
        if (Math.abs(this.rightStickY) > 0.1) {
            if (this.rightStickY < 0) {
                keysPressed.set(W, true);
            } else {
                keysPressed.set(S, true);
            }
        } else {
            keysPressed.set(W, false);
            keysPressed.set(S, false);
        }

        if (Math.abs(this.rightStickX) > 0.1) {
            if (this.rightStickX < 0) {
                keysPressed.set(A, true);
            } else {
                keysPressed.set(D, true);
            }
        } else {
            keysPressed.set(A, false);
            keysPressed.set(D, false);
        }

        // Update shooting state
        if (this.isShooting) {
            shooting = true;
        }

        // Determine movement direction
        const directionPressed = Array.from(keysPressed.values()).some((pressed) => pressed);

        let play = '';
        if (shooting) {
            play = 'zap';
        } else if (directionPressed) {
            play = 'move';
        } else {
            play = 'idle';
        }

        // Update animation
        if (this.currentAction !== play) {
            const toPlay = this.animationsMap.get(play);
            const current = this.animationsMap.get(this.currentAction);
            if (current && toPlay) {
                current.fadeOut(this.fadeDuration);
                toPlay.reset().fadeIn(this.fadeDuration).play();
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

        this.mixer.update(delta);

        // Update movement
        if (!shooting && directionPressed) {
            this.walkDirection.set(0, 0, 0);
            if (keysPressed.get(W)) this.walkDirection.z = 1;
            if (keysPressed.get(S)) this.walkDirection.z = -1;
            if (keysPressed.get(A)) this.walkDirection.x = 1;
            if (keysPressed.get(D)) this.walkDirection.x = -1;
            this.walkDirection.normalize();

            const velocity = this.walkVelocity;
            const moveX = this.walkDirection.x * velocity * delta;
            const moveZ = this.walkDirection.z * velocity * delta;
            this.model.position.x += moveX;
            this.model.position.z += moveZ;
        }

        // Update camera position
        this.updateCameraPosition();
    }

    private updateCameraPosition() {
        // Base position: player's position + vertical head height
        const basePos = new THREE.Vector3(
            this.model.position.x,
            this.model.position.y + this.headHeight,
            this.model.position.z
        );

        // Calculate the forward offset
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.model.quaternion);
        forward.multiplyScalar(this.forwardOffset);

        // Calculate head bobbing offsets
        const bobOffsetY = Math.sin(this.headBobTimer * this.headBobFrequency) * this.headBobAmplitudeVertical;
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.model.quaternion);
        const bobOffsetX = Math.sin(this.headBobTimer * this.headBobFrequency * 0.5) * this.headBobAmplitudeHorizontal;
        right.multiplyScalar(bobOffsetX);

        // Combine all offsets
        const finalPos = new THREE.Vector3().copy(basePos)
            .add(forward)
            .add(new THREE.Vector3(right.x, bobOffsetY, right.z));

        this.camera.position.copy(finalPos);
    }
}
