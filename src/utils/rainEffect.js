// rainEffect.js - ISPRAVLJENA VERZIJA
import * as THREE from 'three';

export class RainEffect {
    constructor(scene, environmentManager) {
        this.scene = scene;
        this.environmentManager = environmentManager;
        this.rain = null;
        this.rainGeo = null;
        this.isRaining = false;
        this.rainCount = 3000;
        
        this.init();
    }

    init() {
    // Rain geometry kao linije
    this.rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 6);

    const volume = { w: 40, h: 50, d: 40 };
    const rainLength = 2;

    for (let i = 0; i < this.rainCount * 6; i += 6) {
        const x = Math.random() * volume.w - volume.w/2;
        const y = Math.random() * volume.h + 0;  // ORIGINAL: + 0 (ne + volume.h/2)
        const z = Math.random() * volume.d - volume.d/2;

        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;

        positions[i + 3] = x;
        positions[i + 4] = y - rainLength;
        positions[i + 5] = z;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
        color: 0x8888ff,
        transparent: true,
        opacity: 0.15,  // ORIGINAL: 0.15 (ne 0.7)
        linewidth: 1
    });

    this.rain = new THREE.LineSegments(this.rainGeo, material);
    this.rain.visible = false;
    this.scene.add(this.rain);
}
    
    startRain() {
        console.log('=== START RAIN CALLED ===');
        if (this.rain) {
            this.rain.visible = true;
            this.isRaining = true;
            
            // SAMO KONTROLIRAJ VIZUALNI EFFECT KIŠE
            // Environment će se promijeniti preko environmentManager.setRainMode()
            console.log('=== START RAIN COMPLETED ===');
        } else {
            console.log('Rain object is NULL');
        }
    }

    stopRain() {
        console.log('=== STOP RAIN CALLED ===');
        if (this.rain) {
            this.rain.visible = false;
            this.isRaining = false;
            
            // SAMO SAKRIJ KIŠU
            // Environment će se vratiti preko environmentManager.setRainMode(false)
            console.log('=== STOP RAIN COMPLETED ===');
        }
    }

    toggleRain() {
        if (this.isRaining) {
            this.stopRain();
            return false;
        } else {
            this.startRain();
            return true;
        }
    }

    update() {
        if (this.isRaining && this.rainGeo) {
            const positions = this.rainGeo.attributes.position.array;
            
            const volumeWidth = 40;
            const volumeHeight = 50;
            const volumeDepth = 40;
            const rainLength = 2;
            const bottomLimit = -volumeHeight/2;
            
            for (let i = 0; i < positions.length; i += 6) {
                positions[i + 1] -= 1.0 + Math.random() * 0.5;
                positions[i + 4] -= 1.0 + Math.random() * 0.5;
                
                if (positions[i + 1] < bottomLimit) {
                    const newY = Math.random() * volumeHeight + volumeHeight/2;
                    positions[i + 1] = newY;
                    positions[i + 4] = newY - rainLength;
                    
                    const x = Math.random() * volumeWidth - volumeWidth/2;
                    const z = Math.random() * volumeDepth - volumeDepth/2;
                    positions[i] = x;
                    positions[i + 3] = x;
                    positions[i + 2] = z;
                    positions[i + 5] = z;
                }
            }
            
            this.rainGeo.attributes.position.needsUpdate = true;
        }
    }
}