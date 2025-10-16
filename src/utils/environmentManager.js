import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class EnvironmentManager {
    constructor(scene, renderer, camera) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.currentEnvMap = null;
        this.envMapIntensity = 1.0;
        this.dirLight = null;
        this.ambientLight = null;

        // === CENTRALIZIRANE POSTAVKE ===
        this.CONFIG = {
            // HDR mape
            HDR_PATHS: {
                sunny: 'hdr/german_town_street_1k.hdr',
                rainy: 'hdr/potsdamer_platz_1k.hdr'
            },
            
            // SUNNY MOD POSTAVKE
            SUNNY: {
                lighting: {
                    dirLightIntensity: 1.2,
                    ambientLightIntensity: 0.5,
                    envMapIntensity: .5,
                    shadowIntensity: 3
                },
                colors: {
                    background: new THREE.Color(0xf0f0f0),
                    floor: new THREE.Color(0xf0f0f0),
                    fog: null
                },
                floor: {
                    roughness: 0.95,
                    metalness: 0.1,
                    envMapIntensity: 0.8
                },
                fog: null
            },
            
            // RAINY MOD POSTAVKE  
            RAINY: {
                lighting: {
                    dirLightIntensity: 1,
                    ambientLightIntensity: 0.2,
                    envMapIntensity: 0.1,
                    shadowIntensity: 5.0
                },
                colors: {
                    background: new THREE.Color(0x333344),
                    floor: new THREE.Color(0x333344),
                    fog: new THREE.Color(0x333344)
                },
                floor: {
                    roughness: 0.25,
                    metalness: 0.1,
                    envMapIntensity: 0.8
                },
                fog: {
                    color: 0x333344,
                    density: 0.015
                }
            },
            
            // ANIMACIJE
            ANIMATION: {
                sunnyToRainy: 1500,
                rainyToSunny: 1500,
                reset: 800
            },
            
            // SHADOW POSTAVKE (konzistentne za sve modove)
            SHADOWS: {
                bias: -0.001,// MANJI BIAS ZA SOFT SHADOWS
                normalBias: 0.01, // MANJI NORMAL BIAS ZA SOFT SHADOWS 
                radius: 2, // VEĆI RADIUS ZA SOFT SHADOWS
                mapSize: { width: 1024, height: 1024 },
                camera: {
                    near: 0.1, //
                    far: 100, //
                    left: -25,
                    right: 25,
                    top: 25,
                    bottom: -25
                }
            },
            
            // BLOOM POSTAVKE - RAZLIČITE ZA SUNNY I RAINY
            BLOOM: {
                sunny: {
                    strength: 0.015,
                    radius: 1.2,
                    threshold: 0.95,
                    enabled: false
                },
                rainy: {
                    strength: 0.45,    // VEĆI BLOOM ZA KIŠU
                    radius: 1.5,       // VEĆI RADIUS
                    threshold: 0.75,   // NIŽI THRESHOLD
                    enabled: true
                }
            }
        };

        // Callback za render
        this.onRenderNeeded = null;

        // Spremi originalne vrijednosti
        this.originalState = {
            envMap: null,
            envMapIntensity: this.CONFIG.SUNNY.lighting.envMapIntensity,
            dirLightIntensity: this.CONFIG.SUNNY.lighting.dirLightIntensity,
            ambientLightIntensity: this.CONFIG.SUNNY.lighting.ambientLightIntensity,
            shadowIntensity: this.CONFIG.SUNNY.lighting.shadowIntensity,
            background: this.CONFIG.SUNNY.colors.background.clone(),
            fog: null
        };

        // Postavke za kišu
        this.isRainyMode = false;
        this.isAnimating = false;
        this.animationStartTime = 0;
        this.animationDuration = 1000;
        this.animationValues = {
            start: {},
            target: {}
        };

        // Postavke za post processing
        this.composer = null;
        this.bloomPass = null;
        this.isBloomEnabled = true;
    }

    setRenderCallback(callback) {
        this.onRenderNeeded = callback;
    }

    setupPostProcessing() {
        if (!this.camera) {
            console.warn('Camera not set for post-processing');
            return;
        }

        this.composer = new EffectComposer(this.renderer);
        
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);
        
        // KORISTI SUNNY POSTAVKE KAO POČETNE
        const initialBloomConfig = this.CONFIG.BLOOM.sunny;
        
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            initialBloomConfig.strength,
            initialBloomConfig.radius,
            initialBloomConfig.threshold
        );
        this.composer.addPass(this.bloomPass);
        
        this.setBloomEnabled(initialBloomConfig.enabled);
        
        console.log('✅ Bloom effect initialized with sunny settings');
        this.debugBloomSettings();
    }

    render() {
        if (this.composer && this.isBloomEnabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onResize(width, height) {
        if (this.composer) {
            this.composer.setSize(width, height);
        }
    }

    setBloomEnabled(enabled) {
        this.isBloomEnabled = enabled;
    }

    /**
     * Ažuriraj bloom postavke prema trenutnom modu
     */
    updateBloomSettings() {
        if (!this.bloomPass) {
            console.warn('Bloom pass not initialized');
            return;
        }

        const bloomConfig = this.isRainyMode ? 
            this.CONFIG.BLOOM.rainy : 
            this.CONFIG.BLOOM.sunny;

        this.bloomPass.strength = bloomConfig.strength;
        this.bloomPass.radius = bloomConfig.radius;
        this.bloomPass.threshold = bloomConfig.threshold;
        
        this.setBloomEnabled(bloomConfig.enabled);

        console.log(`🌈 Bloom settings updated for ${this.isRainyMode ? 'RAINY' : 'SUNNY'} mode:`);
        console.log('Strength:', bloomConfig.strength);
        console.log('Radius:', bloomConfig.radius);
        console.log('Threshold:', bloomConfig.threshold);
    }

    /**
     * Glatka animacija bloom postavki
     */
    animateBloomTransition(targetSettings, duration = 1000) {
        if (!this.bloomPass) return;

        const startSettings = {
            strength: this.bloomPass.strength,
            radius: this.bloomPass.radius,
            threshold: this.bloomPass.threshold
        };

        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);

            // Lerp bloom postavke
            this.bloomPass.strength = THREE.MathUtils.lerp(
                startSettings.strength,
                targetSettings.strength,
                easeProgress
            );
            
            this.bloomPass.radius = THREE.MathUtils.lerp(
                startSettings.radius,
                targetSettings.radius,
                easeProgress
            );
            
            this.bloomPass.threshold = THREE.MathUtils.lerp(
                startSettings.threshold,
                targetSettings.threshold,
                easeProgress
            );

            // Force render
            if (typeof this.onRenderNeeded === 'function') {
                this.onRenderNeeded();
            }

            // Nastavi animaciju ako nije gotovo
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('✅ Bloom transition completed');
            }
        };

        animate();
    }

    /**
     * Ručno podešavanje bloom postavki
     */
    setBloomStrength(strength) {
        if (this.bloomPass) {
            this.bloomPass.strength = strength;
            console.log(`Bloom strength set to: ${strength}`);
            
            if (typeof this.onRenderNeeded === 'function') {
                this.onRenderNeeded();
            }
        }
    }

    setBloomRadius(radius) {
        if (this.bloomPass) {
            this.bloomPass.radius = radius;
            console.log(`Bloom radius set to: ${radius}`);
            
            if (typeof this.onRenderNeeded === 'function') {
                this.onRenderNeeded();
            }
        }
    }

    setBloomThreshold(threshold) {
        if (this.bloomPass) {
            this.bloomPass.threshold = threshold;
            console.log(`Bloom threshold set to: ${threshold}`);
            
            if (typeof this.onRenderNeeded === 'function') {
                this.onRenderNeeded();
            }
        }
    }

    /**
     * Debug bloom postavki
     */
    debugBloomSettings() {
        if (this.bloomPass) {
            console.log('🌈 CURRENT BLOOM SETTINGS:');
            console.log('Strength:', this.bloomPass.strength);
            console.log('Radius:', this.bloomPass.radius);
            console.log('Threshold:', this.bloomPass.threshold);
            console.log('Enabled:', this.isBloomEnabled);
        }
    }

    /**
     * Reset bloom na default postavke za trenutni mod
     */
    resetBloomToCurrentMode() {
        this.updateBloomSettings();
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
                if (hdrPath === this.CONFIG.HDR_PATHS.sunny) {
                    this.originalState.envMap = envMap;
                    this.originalState.envMapIntensity = this.CONFIG.SUNNY.lighting.envMapIntensity;
                    this.originalState.background = this.CONFIG.SUNNY.colors.background.clone();
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
            dirLightIntensity: this.dirLight ? this.dirLight.intensity : this.CONFIG.SUNNY.lighting.dirLightIntensity,
            ambientLightIntensity: this.ambientLight ? this.ambientLight.intensity : this.CONFIG.SUNNY.lighting.ambientLightIntensity,
            envMapIntensity: this.envMapIntensity,
            background: this.scene.background ? this.scene.background.clone() : this.CONFIG.SUNNY.colors.background.clone(),
            floorColor: this.getCurrentFloorColor(),
            shadowIntensity: this.dirLight && this.dirLight.shadow.intensity !== undefined ? this.dirLight.shadow.intensity : this.CONFIG.SUNNY.lighting.shadowIntensity
        };

        this.animationValues.target = targetValues;
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

            // Lerp shadow intensity ako postoji
            if (this.dirLight.shadow.intensity !== undefined && this.animationValues.target.shadowIntensity !== undefined) {
                this.dirLight.shadow.intensity = THREE.MathUtils.lerp(
                    this.animationValues.start.shadowIntensity,
                    this.animationValues.target.shadowIntensity,
                    easeProgress
                );
            }
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
                if (this.dirLight.shadow.intensity !== undefined && this.animationValues.target.shadowIntensity !== undefined) {
                    this.dirLight.shadow.intensity = this.animationValues.target.shadowIntensity;
                }
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

    // Easing funkcija
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Učitaj rainy HDR
    async loadRainyEnvironment() {
        this.isRainyMode = true;
        const envMap = await this.loadHDREnvironment(this.CONFIG.HDR_PATHS.rainy);
        return envMap;
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
            const envMap = await this.loadHDREnvironment(this.CONFIG.HDR_PATHS.sunny);
            return envMap;
        }
    }

    // Poboljšana setRainMode metoda s BLOOM ANIMACIJOM
    setRainMode(enable) {
        console.log(`=== ENVIRONMENT MANAGER: setRainMode(${enable}) ===`);

        this.isRainyMode = enable;

        // SYNC SHADOW SETTINGS PRIJE PROMJENE
        this.syncShadowSettings();

        const config = enable ? this.CONFIG.RAINY : this.CONFIG.SUNNY;
        const duration = enable ? this.CONFIG.ANIMATION.sunnyToRainy : this.CONFIG.ANIMATION.rainyToSunny;
        const bloomConfig = enable ? this.CONFIG.BLOOM.rainy : this.CONFIG.BLOOM.sunny;

        if (enable) {
            console.log('Starting RAINY mode...');
            this.scene.fog = new THREE.FogExp2(config.colors.fog, config.fog.density);
        } else {
            console.log('Starting SUNNY mode...');
            this.scene.fog = null;
        }

        const targetValues = {
            dirLightIntensity: config.lighting.dirLightIntensity,
            ambientLightIntensity: config.lighting.ambientLightIntensity,
            envMapIntensity: config.lighting.envMapIntensity,
            background: config.colors.background,
            floorColor: config.colors.floor,
            shadowIntensity: config.lighting.shadowIntensity
        };

        this.startLightAnimation(targetValues, duration);
        
        // ANIMIRAJ BLOOM POSTAVKE
        this.animateBloomTransition(bloomConfig, duration);
        
        if (enable) {
            this.loadRainyEnvironment();
            this.setRainFloorMaterial();
        } else {
            this.restoreSunnyEnvironment();
            this.setSunnyFloorMaterial();
        }

        return true;
    }

    // Sync shadow postavki za konzistentnost
    syncShadowSettings() {
        if (this.dirLight && this.dirLight.shadow) {
            this.dirLight.shadow.bias = this.CONFIG.SHADOWS.bias;
            this.dirLight.shadow.normalBias = this.CONFIG.SHADOWS.normalBias;
            this.dirLight.shadow.radius = this.CONFIG.SHADOWS.radius;
            
            console.log('🔦 Shadow settings synced - bias:', this.dirLight.shadow.bias);
        }
    }

    // Poboljšana resetToSunnyDefaults - koristi CONFIG
    resetToSunnyDefaults() {
        console.log('🔄 Resetting to sunny defaults');

        // KORISTI ANIMACIJU UMJESTO DIREKTNOG POSTAVLJANJA
        const targetValues = {
            dirLightIntensity: this.CONFIG.SUNNY.lighting.dirLightIntensity,
            ambientLightIntensity: this.CONFIG.SUNNY.lighting.ambientLightIntensity,
            envMapIntensity: this.CONFIG.SUNNY.lighting.envMapIntensity,
            background: this.CONFIG.SUNNY.colors.background,
            floorColor: this.CONFIG.SUNNY.colors.floor,
            shadowIntensity: this.CONFIG.SUNNY.lighting.shadowIntensity
        };

        // SYNC SHADOW SETTINGS PRIJE RESETA
        this.syncShadowSettings();

        this.scene.fog = null;
        this.startLightAnimation(targetValues, this.CONFIG.ANIMATION.reset);
        this.setSunnyFloorMaterial();

        // Spremi ove vrijednosti kao original
        this.originalState.background = this.CONFIG.SUNNY.colors.background.clone();
        this.originalState.dirLightIntensity = this.CONFIG.SUNNY.lighting.dirLightIntensity;
        this.originalState.ambientLightIntensity = this.CONFIG.SUNNY.lighting.ambientLightIntensity;
        this.originalState.envMapIntensity = this.CONFIG.SUNNY.lighting.envMapIntensity;
        this.originalState.shadowIntensity = this.CONFIG.SUNNY.lighting.shadowIntensity;

        console.log('✅ Reset completed - using CONFIG values');
    }

    // FLOOR MANAGEMENT - koristi CONFIG
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
                            // Koristi sunny postavke kao default
                            child.material.envMapIntensity = this.CONFIG.SUNNY.floor.envMapIntensity;

                            if (child.material.isMeshStandardMaterial) {
                                child.material.roughness = this.CONFIG.SUNNY.floor.roughness;
                                child.material.metalness = this.CONFIG.SUNNY.floor.metalness;
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

    // Metoda za podešavanje floor materijala za kišni mod - koristi CONFIG
    setRainFloorMaterial() {
        this.scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.name === 'M_Floor') {
                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                    child.material.roughness = this.CONFIG.RAINY.floor.roughness;
                    child.material.metalness = this.CONFIG.RAINY.floor.metalness;
                    child.material.envMapIntensity = this.CONFIG.RAINY.floor.envMapIntensity;
                    child.material.needsUpdate = true;
                }
            }
        });
        console.log('Floor material set for RAIN mode');
    }

    // Metoda za resetiranje floor materijala na sunny mod - koristi CONFIG
    setSunnyFloorMaterial() {
        this.scene.traverse((child) => {
            if (child.isMesh && child.material && child.material.name === 'M_Floor') {
                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                    child.material.roughness = this.CONFIG.SUNNY.floor.roughness;
                    child.material.metalness = this.CONFIG.SUNNY.floor.metalness;
                    child.material.envMapIntensity = this.CONFIG.SUNNY.floor.envMapIntensity;
                    child.material.needsUpdate = true;
                }
            }
        });
        console.log('Floor material set for SUNNY mode');
    }

    // Metoda za mijenjanje boju poda
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
        let currentColor = this.CONFIG.SUNNY.colors.floor.clone();
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

    // Poboljšana setupLights metoda - koristi CONFIG
    setupLights() {
        // Directional Light
        this.dirLight = new THREE.DirectionalLight(0xffffff, this.CONFIG.SUNNY.lighting.dirLightIntensity);
        this.dirLight.position.set(10, 10, 5);
        this.dirLight.target.position.set(0, 0, 0);
        this.dirLight.castShadow = true;

        // Shadow postavke iz CONFIG
        this.dirLight.shadow.mapSize.width = this.CONFIG.SHADOWS.mapSize.width;
        this.dirLight.shadow.mapSize.height = this.CONFIG.SHADOWS.mapSize.height;
        this.dirLight.shadow.camera.near = this.CONFIG.SHADOWS.camera.near;
        this.dirLight.shadow.camera.far = this.CONFIG.SHADOWS.camera.far;
        this.dirLight.shadow.camera.left = this.CONFIG.SHADOWS.camera.left;
        this.dirLight.shadow.camera.right = this.CONFIG.SHADOWS.camera.right;
        this.dirLight.shadow.camera.top = this.CONFIG.SHADOWS.camera.top;
        this.dirLight.shadow.camera.bottom = this.CONFIG.SHADOWS.camera.bottom;

        // Sync shadow settings
        this.syncShadowSettings();

        // POSTAVI SHADOW INTENSITY
        if (this.dirLight.shadow.intensity !== undefined) {
            this.dirLight.shadow.intensity = this.CONFIG.SUNNY.lighting.shadowIntensity;
            console.log('✅ Shadow intensity set to:', this.dirLight.shadow.intensity);
        }

        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        this.ambientLight = new THREE.AmbientLight(0x404040, this.CONFIG.SUNNY.lighting.ambientLightIntensity);
        this.scene.add(this.ambientLight);

        // Spremi originalne intenzitete
        this.originalState.dirLightIntensity = this.CONFIG.SUNNY.lighting.dirLightIntensity;
        this.originalState.ambientLightIntensity = this.CONFIG.SUNNY.lighting.ambientLightIntensity;
        this.originalState.shadowIntensity = this.CONFIG.SUNNY.lighting.shadowIntensity;

        console.log('✅ Lights setup completed with CONFIG values');
        
        // DEBUG shadow settings
        this.debugShadowSettings();

        return { dirLight: this.dirLight, ambientLight: this.ambientLight };
    }

    // DEBUG metoda za shadow postavke
    debugShadowSettings() {
        if (this.dirLight && this.dirLight.shadow) {
            console.log('🔦 CURRENT SHADOW SETTINGS:');
            console.log('Bias:', this.dirLight.shadow.bias);
            console.log('Normal Bias:', this.dirLight.shadow.normalBias);
            console.log('Map Size:', this.dirLight.shadow.mapSize);
            console.log('Shadow Intensity:', this.dirLight.shadow.intensity);
        }
    }

    // Javna metoda za provjeru je li animacija aktivna
    isAnimationRunning() {
        return this.isAnimating;
    }

    // Javna metoda za dohvat svjetala
    getLights() {
        return { dirLight: this.dirLight, ambientLight: this.ambientLight };
    }

    // METODA ZA UPDATE CONFIG-A
    updateConfig(newConfig) {
        this.CONFIG = { ...this.CONFIG, ...newConfig };
        console.log('Config updated');
    }
}