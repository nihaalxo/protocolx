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
        // Controller 1
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller1.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller1);

        // Controller 2
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('selectstart', this.onSelectStart.bind(this));
        this.controller2.addEventListener('selectend', this.onSelectEnd.bind(this));
        this.scene.add(this.controller2);

        // Add controller models
        this.scene.add(this.controllerModelFactory.createControllerModel(this.controller1));
        this.scene.add(this.controllerModelFactory.createControllerModel(this.controller2));
    }

    private onSelectStart(event: any) {
        const controller = event.target;
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);

        this.raycaster.setFromXRController(controller);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const object = intersects[0].object;
            // Handle interaction with the object
            this.handleObjectInteraction(object);
        }
    }

    private onSelectEnd(event: any) {
        // Handle end of selection
    }

    private handleObjectInteraction(object: THREE.Object3D) {
        // Handle different types of interactions based on object properties
        if (object.userData.interactive) {
            // Handle interactive objects
            if (object.userData.type === 'button') {
                this.handleButtonPress(object);
            } else if (object.userData.type === 'portal') {
                this.handlePortalTransition(object);
            }
        }
    }

    private handleButtonPress(button: THREE.Object3D) {
        // Handle button press interactions
        if (button.userData.action) {
            button.userData.action();
        }
    }

    private handlePortalTransition(portal: THREE.Object3D) {
        // Handle portal/transition interactions
        if (portal.userData.target) {
            window.location.href = portal.userData.target;
        }
    }

    public update() {
        // Update VR-specific logic
        if (this.renderer.xr.isPresenting) {
            // Update controller positions and handle continuous interactions
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