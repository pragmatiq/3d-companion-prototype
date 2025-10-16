import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class EnvironmentManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.currentEnvMap = null;
        this.envMapIntensity = 1.0;
        this.dirLight = null;
        this.ambientLight = null;

        // Callback za render
        this.onRenderNeeded = null;
        
        // HDR mape
        this.hdrMaps = {
            sunny: 'hdr/german_town_street_1k.hdr',
            rainy: 'hdr/rogland_overcast_1k.hdr'
        };
        
        // Spremi originalne vrijednosti
        this.originalState = {
            envMap: null,
            envMapIntensity: 1.0,
            dirLightIntensity: 1.0,
            ambientLightIntensity: 0.4,
            background: null,
            fog: null
        };
        
        this.isRainyMode = false;
        this.isAnimating = false;
        this.animationStartTime = 0;
        this.animationDuration = 1000;
        this.animationValues = {
            start: {},
            target: {}
        };
    }

    setRenderCallback(callback) {
        this.onRenderNeeded = callback;
    }

    async loadHDREnvironment(hdrPath) {
        return new Promise((resolve, reject) => {
            const hdrLoader = new HDRLoader();
            hdrLoader.load(hdrPath, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
                
                this.scene.environment = envMap;
                this.currentEnvMap = envMap;
                this.envMapIntensity = 1.0;
                
                // Spremi originalno stanje kada se učitava sunny HDR
                if (hdrPath === this.hdrMaps.sunny) {
                    this.originalState.envMap = envMap;
                    this.originalState.envMapIntensity = 1.0;
                    this.originalState.background = this.scene.background ? this.scene.background.clone() : new THREE.Color(0xf0f0f0);
                    this.originalState.fog = this.scene.fog;
                    console.log('Original state saved');
                }
                
                // Apliciraj envMap na sve objekte
                this.applyEnvMapToAllObjects(envMap);
                this.applyEnvMapIntensityToAllMaterials(this.envMapIntensity);
                
                texture.dispose();
                console.log(`HDR environment loaded: ${this.isRainyMode ? 'RAINY' : 'SUNNY'}`);
                resolve(envMap);
            }, undefined, reject);
        });
    }

    // Smooth animacija za promjenu vrijednosti
    startLightAnimation(targetValues, customDuration = null) {
        this.isAnimating = true;
        this.animationStartTime = Date.now();
        
        if (customDuration !== null) {
            this.animationDuration = customDuration;
        }
        
        // Spremi početne vrijednosti
        this.animationValues.start = {
            dirLightIntensity: this.dirLight ? this.dirLight.intensity : 1.0,
            ambientLightIntensity: this.ambientLight ? this.ambientLight.intensity : 0.4,
            envMapIntensity: this.envMapIntensity,
            background: this.scene.background ? this.scene.background.clone() : new THREE.Color(0xf0f0f0),
            floorColor: this.getCurrentFloorColor()
        };
        
        this.animationValues.target = targetValues;
          // DODAJ OVO: Spremi shadow intensity ako postoji
    if (this.dirLight && this.dirLight.shadow.intensity !== undefined) {
        this.animationValues.start.shadowIntensity = this.dirLight.shadow.intensity;
    }
    }

    
    // Update animacije (poziva se svaki frame)
   updateLightAnimation() {
    if (!this.isAnimating) return false;
    
    const elapsed = Date.now() - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1);
    const easeProgress = this.easeInOutCubic(progress);
    
    // Lerp svjetla
    if (this.dirLight) {
        this.dirLight.intensity = THREE.MathUtils.lerp(
            this.animationValues.start.dirLightIntensity,
            this.animationValues.target.dirLightIntensity,
            easeProgress
        );
    }
    
    if (this.ambientLight) {
        this.ambientLight.intensity = THREE.MathUtils.lerp(
            this.animationValues.start.ambientLightIntensity,
            this.animationValues.target.ambientLightIntensity,
            easeProgress
        );
    }
        // Lerp envMap intensity
        const newEnvIntensity = THREE.MathUtils.lerp(
            this.animationValues.start.envMapIntensity,
            this.animationValues.target.envMapIntensity,
            easeProgress
        );
        this.applyEnvMapIntensityToAllMaterials(newEnvIntensity);
        
        // Lerp pozadinu
        if (this.scene.background && this.scene.background.isColor) {
            this.scene.background.lerp(
                this.animationValues.target.background,
                easeProgress
            );
        }
        
        // Lerp boju poda
        if (this.animationValues.target.floorColor) {
            const currentFloorColor = new THREE.Color().lerpColors(
                this.animationValues.start.floorColor,
                this.animationValues.target.floorColor,
                easeProgress
            );
            this.setFloorColor(currentFloorColor);
        }
        
        // Force render
        if (typeof this.onRenderNeeded === 'function') {
            this.onRenderNeeded();
        }
        
        // Provjeri je li animacija gotova
        if (progress >= 1) {
            this.isAnimating = false;
            // Postavi konačne vrijednosti
            if (this.dirLight) {
                this.dirLight.intensity = this.animationValues.target.dirLightIntensity;
            }
            if (this.ambientLight) {
                this.ambientLight.intensity = this.animationValues.target.ambientLightIntensity;
            }
            this.applyEnvMapIntensityToAllMaterials(this.animationValues.target.envMapIntensity);
            if (this.scene.background && this.scene.background.isColor) {
                this.scene.background.copy(this.animationValues.target.background);
            }
            if (this.animationValues.target.floorColor) {
                this.setFloorColor(this.animationValues.target.floorColor);
            }
        }

       
        
        return true;

    }

    // Dodaj u EnvironmentManager
resetToSunnyDefaults() {
    console.log('🔄 Resetting to sunny defaults');
    
    // Eksplicitno postavi sve sunny vrijednosti
    this.scene.background = new THREE.Color(0xf0f0f0);
    this.scene.fog = null;
    
    if (this.dirLight) {
        this.dirLight.intensity = 1.0;
    }
    if (this.ambientLight) {
        this.ambientLight.intensity = 0.4;
    }
    
    this.applyEnvMapIntensityToAllMaterials(1.0);
    this.setSunnyFloorMaterial();
    
    // Spremi ove vrijednosti kao original
    this.originalState.background = new THREE.Color(0xf0f0f0);
    this.originalState.dirLightIntensity = 1.0;
    this.originalState.ambientLightIntensity = 0.4;
    this.originalState.envMapIntensity = 1.0;
    
    console.log('✅ Reset completed');
}
    
    // Easing funkcija
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Učitaj rainy HDR
    async loadRainyEnvironment() {
        this.isRainyMode = true;
        return this.loadHDREnvironment(this.hdrMaps.rainy);
    }

    // Vrati sunny HDR
    async restoreSunnyEnvironment() {
        this.isRainyMode = false;
        
        if (this.originalState.envMap) {
            this.scene.environment = this.originalState.envMap;
            this.currentEnvMap = this.originalState.envMap;
            this.applyEnvMapToAllObjects(this.originalState.envMap);
            console.log('Original sunny environment restored');
            return this.originalState.envMap;
        } else {
            const envMap = await this.loadHDREnvironment(this.hdrMaps.sunny);
            return envMap;
        }
    }
// U EnvironmentManager klasi, popravi setRainMode metodu:
setRainMode(enable) {
    console.log(`=== ENVIRONMENT MANAGER: setRainMode(${enable}) ===`);
    
    this.isRainyMode = enable;
    
    if (enable) {
        console.log('Starting RAINY mode...');
        
        const targetValues = {
            dirLightIntensity: 0.8,        // SMANJI directional light
            ambientLightIntensity: 0.2,    // SMANJI ambient light  
            envMapIntensity: 0.8,
            background: new THREE.Color(0x333344),
            floorColor: new THREE.Color(0x333344)
        };
        
        this.scene.fog = new THREE.FogExp2(0x333344, 0.015);
        this.startLightAnimation(targetValues, 1000);
        this.loadRainyEnvironment();
        this.setRainFloorMaterial();
        
    } else {
        console.log('Starting SUNNY mode...');
        
        const targetValues = {
            dirLightIntensity: 1.0,        // VRATI na original
            ambientLightIntensity: 0.4,    // VRATI na original
            envMapIntensity: 1.0,
            background: new THREE.Color(0xf0f0f0),
            floorColor: new THREE.Color(0xf0f0f0)
        };
        
        this.scene.fog = null;
        this.startLightAnimation(targetValues, 1500);
        this.restoreSunnyEnvironment();
        this.setSunnyFloorMaterial();
    }
    
    return true;
}
    // FLOOR MANAGEMENT
    async loadFloor(floorPath) {
        return new Promise((resolve, reject) => {
            const floorLoader = new GLTFLoader();
            floorLoader.load(floorPath, (gltf) => {
                const floor = gltf.scene;
                floor.position.set(0, 0, 0);
                floor.scale.set(1, 1, 1);
                this.scene.add(floor);
                
                // Apliciraj envMap na pod
                if (this.currentEnvMap) {
                    this.applyEnvMapToObject(floor);
                }
                
                floor.traverse((child) => {
                    if (child.isMesh) {
                        child.receiveShadow = true;
                        
                        if (child.material) {
                            // Refleksija i spekular
                            child.material.envMapIntensity = .8;
                            
                            if (child.material.isMeshStandardMaterial) {
                                child.material.roughness = 0.8;
                                child.material.metalness = 0.0;
                            }
                            
                            child.material.needsUpdate = true;
                        }
                    }
                });
                
                console.log('Floor loaded with reflection settings');
                resolve(floor);
            }, undefined, reject);
        });
    }

    // Metoda za podešavanje floor materijala za kišni mod
setRainFloorMaterial() {
    this.scene.traverse((child) => {
        if (child.isMesh && child.material && child.material.name === 'M_Floor') {
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                // KIŠNI MOD - mokri asfalt izgled
                child.material.roughness = 0.15;      // Manje roughness = glatkije (mokro)
                child.material.metalness = 1;      // Više metalness = više refleksije
                
                // Ako je PhysicalMaterial, možeš kontrolirati i specular
                if (child.material.isMeshPhysicalMaterial) {
                    child.material.specularIntensity = 0.8;    // Jači specular highlights
                    child.material.clearcoat = 0.5;           // Lakirani izgled
                    child.material.clearcoatRoughness = 0.1;
                }
                
                child.material.needsUpdate = true;
            }
        }
    });
    console.log('Floor material set for RAIN mode');
}

// Metoda za resetiranje floor materijala na sunny mod
setSunnyFloorMaterial() {
    this.scene.traverse((child) => {
        if (child.isMesh && child.material && child.material.name === 'M_Floor') {
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                // SUNNY MOD - suhi asfalt izgled
                child.material.roughness = 0.8;      // Više roughness = hrapavije (suho)
                child.material.metalness = 0.1;      // Manje metalness = manje refleksije
                
                if (child.material.isMeshPhysicalMaterial) {
                    child.material.specularIntensity = 0.3;    // Slabiji specular
                    child.material.clearcoat = 0.0;           // Bez lakiranog izgleda
                }
                
                child.material.needsUpdate = true;
            }
        }
    });
    console.log('Floor material set for SUNNY mode');
}

    // Metoda za mijenjanje boje poda
    setFloorColor(color) {
        this.scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.name === 'M_Floor') {
                if (typeof color === 'string' || typeof color === 'number') {
                    child.material.color.set(color);
                } else if (color.isColor) {
                    child.material.color.copy(color);
                }
                child.material.needsUpdate = true;
            }
        });
    }

    // Pomoćna metoda za dobivanje trenutne boje poda
    getCurrentFloorColor() {
        let currentColor = new THREE.Color(0xf0f0f0);
        this.scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.name === 'M_Floor') {
                currentColor = child.material.color.clone();
            }
        });
        return currentColor;
    }

    // MATERIAL & ENVIRONMENT METHODS
    applyEnvMapToAllObjects(envMap) {
        this.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!Array.isArray(child.material)) {
                    child.material.envMap = envMap;
                    child.material.needsUpdate = true;
                } else {
                    child.material.forEach(mat => {
                        mat.envMap = envMap;
                        mat.needsUpdate = true;
                    });
                }
            }
        });
    }

    applyEnvMapToObject(object) {
        object.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!Array.isArray(child.material)) {
                    child.material.envMap = this.currentEnvMap;
                    child.material.envMapIntensity = this.envMapIntensity;
                    child.material.needsUpdate = true;
                } else {
                    child.material.forEach(mat => {
                        mat.envMap = this.currentEnvMap;
                        mat.envMapIntensity = this.envMapIntensity;
                        mat.needsUpdate = true;
                    });
                }
            }
        });
    }

    applyEnvMapIntensityToAllMaterials(intensity) {
        this.envMapIntensity = intensity;
        
        this.scene.traverse((child) => {
            if (child.isMesh && child.material) {
                if (!Array.isArray(child.material)) {
                    this.setMaterialEnvMapIntensity(child.material, intensity);
                } else {
                    child.material.forEach(mat => {
                        this.setMaterialEnvMapIntensity(mat, intensity);
                    });
                }
            }
        });
    }

    setMaterialEnvMapIntensity(material, intensity) {
        if (material && material.envMap) {
            material.envMapIntensity = intensity;
            material.needsUpdate = true;
        }
    }

/*/ LIGHT SETUP - zamijeni setupLights metodu s ovom:
setupLights() {
    // Directional Light
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.dirLight.position.set(15, 10, 5);
    this.dirLight.target.position.set(0, 0, 0);
    this.dirLight.castShadow = true;
    
    // Shadow map kvaliteta
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    
    // Shadow camera
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -25;
    this.dirLight.shadow.camera.right = 25;
    this.dirLight.shadow.camera.top = 25;
    this.dirLight.shadow.camera.bottom = -25;
    
    // KLJUČNE POSTAVKE ZA TAMNIJE SJENE:
    this.dirLight.shadow.bias = -0.001;
    this.dirLight.shadow.normalBias = 0.02;
    
    // OVO JE NOVI NAČIN ZA KONTROLU INTENZITETA SJENE:
    if (this.dirLight.shadow.intensity !== undefined) {
        this.dirLight.shadow.intensity = 5; // POVEĆAJ za tamnije sjene (default je 1.0)
        console.log('Using shadow.intensity property');
    } else {
        console.warn('shadow.intensity not available in this Three.js version');
        // Fallback na staru metodu
        this.dirLight.intensity = 2.0; // Povećaj intenzitet svjetla
    }
    
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Ambient Light - SMANJI za kontrastnije sjene
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.1);
    this.scene.add(this.ambientLight);

    // Spremi originalne intenzitete
    this.originalState.dirLightIntensity = 1.0;
    this.originalState.ambientLightIntensity = 0.1;
    
    // Spremi i shadow intensity ako je dostupan
    if (this.dirLight.shadow.intensity !== undefined) {
        this.originalState.shadowIntensity = 2.0;
    }

    return { dirLight: this.dirLight, ambientLight: this.ambientLight };
}*/

setupLights() {
    // Directional Light - POVEĆAJ INTENZITET ZA JAČE SJENE
    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // 2.0 umjesto 1.0
    this.dirLight.position.set(15, 10, 5);
    this.dirLight.target.position.set(0, 0, 0);
    this.dirLight.castShadow = true;
    
    // Shadow map kvaliteta - POBOLJŠAJ ZA OŠTRIJE SJENE
    this.dirLight.shadow.mapSize.width = 4096; // 4096 umjesto 2048
    this.dirLight.shadow.mapSize.height = 4096;
    
    // Shadow camera
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -25;
    this.dirLight.shadow.camera.right = 25;
    this.dirLight.shadow.camera.top = 25;
    this.dirLight.shadow.camera.bottom = -25;
    
    // KLJUČNE POSTAVKE ZA TAMNIJE SJENE:
    this.dirLight.shadow.bias = -0.0001; // SMANJI BIAS
    this.dirLight.shadow.normalBias = 0.01; // SMANJI NORMAL BIAS
    
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Ambient Light - SMANJI ZA KONTRASNIJE SJENE
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.3); // 0.3 umjesto 0.4
    this.scene.add(this.ambientLight);

    // Spremi originalne intenzitete
    this.originalState.dirLightIntensity = 2.0; // AŽURIRAJ
    this.originalState.ambientLightIntensity = 0.3; // AŽURIRAJ

    return { dirLight: this.dirLight, ambientLight: this.ambientLight };
}

    // Javna metoda za provjeru je li animacija aktivna
    isAnimationRunning() {
        return this.isAnimating;
    }

    // Javna metoda za dohvat svjetala
    getLights() {
        return { dirLight: this.dirLight, ambientLight: this.ambientLight };
    }
}
    