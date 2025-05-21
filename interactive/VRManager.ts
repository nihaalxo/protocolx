import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

export class VRManager {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controller1!: THREE.XRTargetRaySpace;
    private controller2!: THREE.XRTargetRaySpace;
    private controllerModelFactory: XRControllerModelFactory;
    private raycaster: THREE.Raycaster;
    private tempMatrix: THREE.Matrix4;
    private vrEnabled: boolean = false;

    // Movement state
    private moveDirection: THREE.Vector2 = new THREE.Vector2();
    private jumpState: boolean = false;
    private shootState: boolean = false;
    private interactState: boolean = false;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();

        // Enable XR
        this.renderer.xr.enabled = true;
        document.body.appendChild(VRButton.createButton(this.renderer));

        // Setup controllers
        this.controllerModelFactory = new XRControllerModelFactory();
        this.setupControllers();
    }

    private setupControllers() {
        // Controller 1 (Left)
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.controller1.addEventListener('squeezestart', this.onSqueezeStart.bind(this));
        this.controller1.addEventListener('squeezeend', this.onSqueezeEnd.bind(this));
        this.scene.add(this.controller1);

        // Controller 2 (Right)
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.controller2.addEventListener('squeezestart', this.onSqueezeStart.bind(this));
        this.controller2.addEventListener('squeezeend', this.onSqueezeEnd.bind(this));
        this.scene.add(this.controller2);

        // Add controller models
        this.scene.add(this.controllerModelFactory.createControllerModel(this.controller1));
        this.scene.add(this.controllerModelFactory.createControllerModel(this.controller2));

        // Set up gamepad polling
        this.setupGamepadPolling();
    }

    private setupGamepadPolling() {
        // Poll for gamepad state in the animation loop
        const pollGamepads = () => {
            const session = this.renderer.xr.getSession();
            if (session) {
                session.inputSources.forEach((inputSource) => {
                    // Use type assertion to handle gamepad property
                    const gamepad = (inputSource as any).gamepad;
                    if (gamepad) {
                        this.handleGamepadInput(gamepad, inputSource.handedness);
                    }
                });
            }
            requestAnimationFrame(pollGamepads);
        };
        pollGamepads();
    }

    private handleGamepadInput(gamepad: Gamepad, handedness: string) {
        // Left controller (movement)
        if (handedness === 'left') {
            // Thumbstick for movement
            const [x, y] = gamepad.axes;
            this.moveDirection.set(x, y);

            // A button for interaction
            if (gamepad.buttons[0].pressed) {
                this.interactState = true;
            } else {
                this.interactState = false;
            }
        }

        // Right controller (actions)
        if (handedness === 'right') {
            // X button for jumping
            if (gamepad.buttons[3].pressed) {
                this.jumpState = true;
            } else {
                this.jumpState = false;
            }

            // Trigger for shooting
            if (gamepad.buttons[0].pressed) {
                this.shootState = true;
            } else {
                this.shootState = false;
            }
        }
    }

    private onSelectStart(event: any) {
        const controller = event.target;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);

        this.raycaster.setFromXRController(controller);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            this.handleObjectInteraction(object);
        }
    }

    private onSelectEnd(event: any) {
        // Handle end of selection
    }

    private onSqueezeStart(event: any) {
        // Handle squeeze start (grip button)
    }

    private onSqueezeEnd(event: any) {
        // Handle squeeze end (grip button)
    }

    private handleObjectInteraction(object: THREE.Object3D) {
        if (object.userData.interactive) {
            if (object.userData.type === 'button') {
                this.handleButtonPress(object);
            } else if (object.userData.type === 'portal') {
                this.handlePortalTransition(object);
            }
        }
    }

    private handleButtonPress(button: THREE.Object3D) {
        if (button.userData.action) {
            button.userData.action();
        }
    }

    private handlePortalTransition(portal: THREE.Object3D) {
        if (portal.userData.target) {
            window.location.href = portal.userData.target;
        }
    }

    public update() {
        if (this.renderer.xr.isPresenting) {
            this.updateControllers();
        }
    }

    private updateControllers() {
        // Update controller positions and handle continuous interactions
        // This can include things like continuous movement, teleportation, etc.
    }

    public isVREnabled(): boolean {
        return this.vrEnabled;
    }

    public getMoveDirection(): THREE.Vector2 {
        return this.moveDirection;
    }

    public isJumping(): boolean {
        return this.jumpState;
    }

    public isShooting(): boolean {
        return this.shootState;
    }

    public isInteracting(): boolean {
        return this.interactState;
    }

    public getControllerPosition(controllerIndex: number): THREE.Vector3 {
        const controller = controllerIndex === 0 ? this.controller1 : this.controller2;
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(controller.matrixWorld);
        return position;
    }

    public getControllerRotation(controllerIndex: number): THREE.Euler {
        const controller = controllerIndex === 0 ? this.controller1 : this.controller2;
        const rotation = new THREE.Euler();
        rotation.setFromRotationMatrix(controller.matrixWorld);
        return rotation;
    }
} 