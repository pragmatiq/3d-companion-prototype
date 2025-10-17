import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class CarManager {
    constructor(scene, environmentManager) {
        this.scene = scene;
        this.environmentManager = environmentManager;
        this.models = {};
        this.activeModel = null;
        this.currentCarName = 'macan2017'; // KORISTI IME, NE INDEX
        this.isTransitioning = false;
    }

    improveCarPaintMaterials(carModel) {
    carModel.traverse((child) => {
        if (child.isMesh && child.material && child.material.name === 'carpaint') {
            
            //Car paint material improvements
            child.material.metalness = .8;        // POVEĆAJ metalness
            child.material.roughness = 0.5;         // SMANJI roughness (više sjaja)
            child.material.clearcoat = 1.0;         // DODAJ clearcoat
            child.material.clearcoatRoughness = 0.015; // Vrlo glatak clearcoat
            child.material.envMapIntensity = 1;   // POVEĆAJ refleksije
            
            // Ako je MeshPhysicalMaterial, dodaj dodatne efekte
            if (child.material.isMeshPhysicalMaterial) {
                child.material.sheen = 1;           // Svilenkasti sjaj
                child.material.sheenRoughness = 0.3;
                child.material.specularIntensity = 0.8;
            }
            
            console.log('Improved car paint material on:', child.name);
            child.material.needsUpdate = true;
        }
    });
}


    setCallbacks(onRenderNeeded) {
        this.onRenderNeeded = onRenderNeeded;
    }

    async loadInitialCar() {
        console.log('Učitavam početni auto...');
        await this.loadCar('macan2017', 'macan2017.glb');
        this.switchCar('macan2017');
        
        this.loadCar('911', 'modularCar/SM_911_Targa_A.glb').then(() => {
            console.log('Drugi auto učitan');
        });
    }

    loadCar(name, path) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            console.log(`Učitavam: ${name} s putanje: ${path}`);
            
            loader.load(path, (gltf) => {
                const car = gltf.scene;
                
                car.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        if (child.geometry) {
                            child.geometry.computeBoundingSphere();
                        }
                    }
                });

                this.improveCarPaintMaterials(car);

                // DODAJ OVO: Apliciraj environment na auto
                if (this.environmentManager) {
                    this.environmentManager.applyEnvMapToObject(car);
                }

                this.models[name] = car;
                console.log('Model uspješno učitan:', name);
                resolve(car);
            }, 
            (progress) => {
                console.log(`Učitavanje ${name}: ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error('Greška pri učitavanju modela:', error);
                reject(error);
            });
        });
    }

    switchCar(name) {
        console.log(`Mijenjam auto na: ${name}`);
        
        if (this.activeModel) {
            this.scene.remove(this.activeModel);
        }
        
        this.activeModel = this.models[name];
        if (this.activeModel) {

             // DODAJ OVO: Resetiraj poziciju auta na iste koordinate
        this.activeModel.position.set(0, 0, 0);
        this.activeModel.rotation.set(0, 0, 0);
        this.activeModel.scale.set(1, 1, 1);

            this.scene.add(this.activeModel);

            
            // DODAJ OVO: Osiguraj da environment bude apliciran
            if (this.environmentManager) {
                this.environmentManager.applyEnvMapToObject(this.activeModel);
            }
            
            if (this.onRenderNeeded) this.onRenderNeeded();
        }
    }

    async switchToCar(carName, camera, previousCameraState) {
        return new Promise(async (resolve) => {
            if (this.isTransitioning || this.currentCarName === carName) {
                resolve(null);
                return;
            }
            
            this.isTransitioning = true;
            console.log(`Mijenjam auto sa ${this.currentCarName} na: ${carName}`);
            
            await this.bounceCameraUp(camera);
            
            if (this.models[carName]) {
                this.switchCar(carName);
                this.currentCarName = carName; // AŽURIRAJ TRENUTNI AUTO
                
               
            
            }
            
            await this.bounceCameraDown(camera, previousCameraState);
            
            this.isTransitioning = false;
            resolve(carName);
        });
    }

    getCurrentCarName() {
        return this.currentCarName; // VRATI IME, NE INDEX
    }


    bounceCameraUp(camera) {
        return new Promise((resolve) => {
            const startPos = camera.position.clone();
            const targetPos = new THREE.Vector3(startPos.x, startPos.y + 2, startPos.z);
            const startTime = Date.now();
            const duration = 300;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                
                camera.position.lerpVectors(startPos, targetPos, easeProgress);
                if (this.onRenderNeeded) this.onRenderNeeded();
                
                progress < 1 ? requestAnimationFrame(animate) : resolve();
            };
            
            animate();
        });
    }

    bounceCameraDown(camera, previousCameraState) {
        return new Promise((resolve) => {
            const startPos = camera.position.clone();
            const targetPos = previousCameraState.position.clone();
            const startTime = Date.now();
            const duration = 400;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                
                camera.position.lerpVectors(startPos, targetPos, easeProgress);
                if (this.onRenderNeeded) this.onRenderNeeded();
                
                progress < 1 ? requestAnimationFrame(animate) : resolve();
            };
            
            animate();
        });
    }

    getActiveCar() {
        return this.activeModel;
    }
}