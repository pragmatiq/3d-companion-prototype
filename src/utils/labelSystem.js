import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class LabelSystem {
    constructor(scene, carManager) {
        this.scene = scene;
        this.carManager = carManager;
        this.loader = new GLTFLoader();

        this.labels = {};
        this.currentLabel = null;
        this.isRaining = false;
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationDuration = 260;
        this.currentView = 'front';

        this.labelPositions = {
            front: {
                pos: new THREE.Vector3(-4, 2, -6.1),
                rotY: Math.PI - 1.0527,
                scale: new THREE.Vector3(3, 3, 3)
            },
            top: {
                pos: new THREE.Vector3(-2, 0, 0),
                rotation: new THREE.Euler(0, 3.14, -1.57),
                scale: new THREE.Vector3(2.2, 2.2, 2.2)
            },
            rear: {
                pos: new THREE.Vector3(-5, 2, 5.25),
                rotY: Math.PI + 0.695,
                scale: new THREE.Vector3(3, 3, 3)
            }
        };

        this.hidePositions = {
            front: new THREE.Vector3(-4, -1, -6.1),
            top: new THREE.Vector3(0, -2, 0),
            rear: new THREE.Vector3(-5, -1, 5.25)
        };

        this.loadLabels();
    }

    async loadLabels() {
        try {
            const glb911 = await this.loader.loadAsync('/SM_911Sign.glb');
            this.labels['911'] = glb911.scene;

            const glbMacan = await this.loader.loadAsync('/SM_MacanSign.glb');
            this.labels['macan'] = glbMacan.scene;

            this.setLabel('macan', 'front');
        } catch (error) {
            console.error('LabelSystem: GLB load failed', error);
        }
    }

    setLabel(name, preset = 'front') {
        if (!this.labels[name]) return;

        if (this.currentLabel) {
            this.scene.remove(this.currentLabel);
        }

        this.currentLabel = this.labels[name].clone();
        this.currentView = preset;

        const lp = this.labelPositions[preset];
        
        this.currentLabel.position.copy(lp.pos);
        this.currentLabel.scale.copy(lp.scale);

        if (preset === 'top') {
            this.currentLabel.rotation.copy(lp.rotation);
        } else {
            this.currentLabel.rotation.set(0, lp.rotY, 0);
        }

        const color = this.isRaining ? 0xffffff : 0x000000;
        this.currentLabel.traverse(child => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color.set(color);
                child.material.transparent = true;
                child.material.opacity = 1;
                child.material.needsUpdate = true;
            }
        });

        this.scene.add(this.currentLabel);
    }

    startHideAnimation() {
        if (!this.currentLabel || this.isAnimating) return;
        this.isAnimating = true;
        this.animationProgress = 0;
        
        this.startPos = this.currentLabel.position.clone();
        this.targetPos = this.hidePositions[this.currentView];
        this.startAlpha = 1;
        this.targetAlpha = 0;
    }

    startShowAnimation() {
        if (!this.currentLabel || this.isAnimating) return;
        this.isAnimating = true;
        this.animationProgress = 0;
        
        const target = this.labelPositions[this.currentView];
        this.startPos = this.currentLabel.position.clone();
        this.targetPos = target.pos;
        this.startAlpha = 0;
        this.targetAlpha = 1;
    }

    update(time) {
        if (!this.isAnimating || !this.currentLabel) return;
        
        this.animationProgress += 16;
        const progress = Math.min(1, this.animationProgress / this.animationDuration);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Position animation
        this.currentLabel.position.lerpVectors(this.startPos, this.targetPos, easeProgress);
        
        // Alpha animation
        const currentAlpha = THREE.MathUtils.lerp(this.startAlpha, this.targetAlpha, easeProgress);
        this.currentLabel.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.opacity = currentAlpha;
            }
        });
        
        if (progress >= 1) {
            this.isAnimating = false;
        }
    }

    onCameraStartMove() {
        this.startHideAnimation();
    }

    onCameraStopMove() {
        this.startShowAnimation();
    }

    onViewChanged(newView) {
        this.currentView = newView;
        this.isAnimating = false;
        if (this.currentLabel) {
            const target = this.labelPositions[newView];
            this.currentLabel.position.copy(target.pos);
            this.currentLabel.scale.copy(target.scale);
            if (newView === 'top') {
                this.currentLabel.rotation.copy(target.rotation);
            } else {
                this.currentLabel.rotation.set(0, target.rotY, 0);
            }
            
            this.currentLabel.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.opacity = 1;
                }
            });
        }
    }

    setView(preset) {
        if (!this.currentLabel) return;
        this.onViewChanged(preset);
    }

    setRain(isRaining) {
        this.isRaining = isRaining;
        if (!this.currentLabel) return;

        const color = this.isRaining ? 0xffffff : 0x000000;
        this.currentLabel.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.color.set(color);
                child.material.needsUpdate = true;
            }
        });
    }
}