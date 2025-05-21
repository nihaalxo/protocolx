// characterControls.ts

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// Add WebXR type declarations
declare global {
    interface Navigator {
        xr?: XRSystem;
    }
}

export class CharacterControls {
    private camera: THREE.PerspectiveCamera;
    private controls: PointerLockControls;
    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private canJump: boolean = false;
    private velocity: THREE.Vector3;
    private direction: THREE.Vector3;
    private prevTime: number;
    private vrControls: any;
    private vrEnabled: boolean = false;
    private vrManager: any;

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, vrManager?: any) {
        this.camera = camera;
        this.controls = new PointerLockControls(camera, domElement);
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.prevTime = performance.now();
        this.vrManager = vrManager;

        // VR setup
        this.setupVR();
    }

    private setupVR() {
        // Check if WebXR is available with proper type checking
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr')
                .then((supported) => {
                    if (supported) {
                        this.vrEnabled = true;
                        this.setupVRControls();
                    }
                })
                .catch((error) => {
                    console.warn('WebXR not supported:', error);
                });
        }
    }

    private setupVRControls() {
        // VR controller setup is handled by VRManager
    }

    public update(delta: number, onGround: boolean): THREE.Vector3 {
        if (this.vrEnabled && this.vrManager) {
            return this.updateVRMovement(delta, onGround);
        } else {
            return this.updateKeyboardMovement(delta, onGround);
        }
    }

    private updateVRMovement(delta: number, onGround: boolean): THREE.Vector3 {
        // Get movement direction from VR controller
        const moveDirection = this.vrManager.getMoveDirection();
        
        // Apply movement based on controller input
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 100.0 * delta;

        // Convert controller input to movement direction
        this.direction.z = moveDirection.y;
        this.direction.x = moveDirection.x;
        this.direction.normalize();

        // Apply movement
        if (this.direction.z !== 0) {
            this.velocity.z -= this.direction.z * 400.0 * delta;
        }
        if (this.direction.x !== 0) {
            this.velocity.x -= this.direction.x * 400.0 * delta;
        }

        // Handle jumping
        if (this.vrManager.isJumping() && onGround) {
            this.velocity.y = 400.0 * delta;
        }

        if (onGround) {
            this.velocity.y = Math.max(0, this.velocity.y);
        }

        return this.velocity;
    }

    private updateKeyboardMovement(delta: number, onGround: boolean): THREE.Vector3 {
        // Existing keyboard movement logic
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 100.0 * delta;

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * 400.0 * delta;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * 400.0 * delta;
        }

        if (onGround) {
            this.velocity.y = Math.max(0, this.velocity.y);
            this.canJump = true;
        }

        return this.velocity;
    }

    public getControls(): PointerLockControls {
        return this.controls;
    }

    public isVREnabled(): boolean {
        return this.vrEnabled;
    }

    // VR-specific methods
    public setVRControls(vrControls: any) {
        this.vrControls = vrControls;
    }

    public getVRPosition(): THREE.Vector3 {
        if (this.vrControls) {
            return this.vrControls.getPosition();
        }
        return this.camera.position;
    }

    public getVRRotation(): THREE.Euler {
        if (this.vrControls) {
            return this.vrControls.getRotation();
        }
        return this.camera.rotation;
    }
}
