/* cameraManager.js
export class CameraManager {
    constructor(camera, controls, carManager) {
        this.camera = camera;
        this.controls = controls;
        this.carManager = carManager;
        this.isCameraMoving = false;
        this.camTargetPos = new THREE.Vector3();
        this.camTargetLookAt = new THREE.Vector3();
        this.currentPreset = 'front';
    }

    // Jednostavno - centriraj na auto
    updatePresets() {
        const activeCar = this.carManager.getActiveCar();
        if (!activeCar) return;

        const bbox = new THREE.Box3().setFromObject(activeCar);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Fiksni offseti od centra auta
        this.presets = {
            front: {
                pos: new THREE.Vector3(center.x + 2, center.y, center.z + 8),
                lookAt: center.clone()
            },
            top: {
                pos: new THREE.Vector3(center.x, center.y + 10, center.z),
                lookAt: center.clone()
            },
            rear: {
                pos: new THREE.Vector3(center.x - 2, center.y , center.z - 8),
                lookAt: center.clone()
            }
        };
    }

    moveToPreset(preset) {
        this.updatePresets();
        const cp = this.presets[preset];
        if (cp) {
            this.camTargetPos.copy(cp.pos);
            this.camTargetLookAt.copy(cp.lookAt);
            this.isCameraMoving = true;
            this.currentPreset = preset;
        }
    }

    update() {
        if (this.isCameraMoving) {
            this.controls.target.lerp(this.camTargetLookAt, 0.05);
            this.camera.position.lerp(this.camTargetPos, 0.05);
            
            if (this.camera.position.distanceTo(this.camTargetPos) < 0.01) {
                this.isCameraMoving = false;
            }
            return true;
        }
        return false;
    }
} */

// cameraManager.js
export class CameraManager {
    constructor(camera, controls, carManager) {
        this.camera = camera;
        this.controls = controls;
        this.carManager = carManager;
        this.isCameraMoving = false;
        this.camTargetPos = new THREE.Vector3();
        this.camTargetLookAt = new THREE.Vector3();
        this.currentPreset = 'front';
        
        // DODAJ OVO: Ručno podesive visine za svaki preset
        this.presetHeights = {
            front: 1.5,   // visina za front view
            top: 10,      // visina za top view  
            rear: 1.5     // visina za rear view
        };
    }
    

    // Jednostavno - centriraj na auto
    updatePresets() {
        const activeCar = this.carManager.getActiveCar();
        if (!activeCar) return;

        const bbox = new THREE.Box3().setFromObject(activeCar);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = bbox.getSize(new THREE.Vector3());

        // Fiksni offseti od centra auta S VISINOM
        this.presets = {
            front: {
                pos: new THREE.Vector3(
                    center.x + 2, 
                    center.y + this.presetHeights.front, // DODAJ VISINU
                    center.z + 8
                ),
                lookAt: new THREE.Vector3(
                    center.x,
                    center.y + this.presetHeights.front * 0.5, // lookAt malo niže
                    center.z
                )
            },
            top: {
                pos: new THREE.Vector3(
                    center.x, 
                    center.y + this.presetHeights.top, // VISINA za top
                    center.z
                ),
                lookAt: center.clone()
            },
            rear: {
                pos: new THREE.Vector3(
                    center.x - 2, 
                    center.y + this.presetHeights.rear, // DODAJ VISINU
                    center.z - 8
                ),
                lookAt: new THREE.Vector3(
                    center.x,
                    center.y + this.presetHeights.rear * 0.5, // lookAt malo niže
                    center.z
                )
            }
        };
        
        console.log('Camera presets updated with heights:', this.presetHeights);
    }

    // DODAJ OVO: Metoda za mijenjanje visine presetova
    setPresetHeight(preset, height) {
        if (this.presetHeights[preset] !== undefined) {
            this.presetHeights[preset] = height;
            console.log(`Preset ${preset} height set to: ${height}`);
        }
    }

    // DODAJ OVO: Metoda za podešavanje svih visina
    setAllHeights(frontHeight, topHeight, rearHeight) {
        this.presetHeights.front = frontHeight;
        this.presetHeights.top = topHeight;
        this.presetHeights.rear = rearHeight;
        console.log('All preset heights updated:', this.presetHeights);
    }

    moveToPreset(preset) {
        this.updatePresets();
        const cp = this.presets[preset];
        if (cp) {
            this.camTargetPos.copy(cp.pos);
            this.camTargetLookAt.copy(cp.lookAt);
            this.isCameraMoving = true;
            this.currentPreset = preset;
            console.log(`Moving to ${preset} - Position:`, cp.pos, 'LookAt:', cp.lookAt);
        }
    }

    update() {
        if (this.isCameraMoving) {
            this.controls.target.lerp(this.camTargetLookAt, 0.05);
            this.camera.position.lerp(this.camTargetPos, 0.05);
            
            if (this.camera.position.distanceTo(this.camTargetPos) < 0.01) {
                this.isCameraMoving = false;
            }
            return true;
        }
        return false;
    }
}