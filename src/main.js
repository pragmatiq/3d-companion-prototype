import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { EnvironmentManager } from './utils/environmentManager.js';
import { RainEffect } from './utils/rainEffect.js';
import { CarManager } from './utils/carManager.js';
import { LabelSystem } from './utils/labelSystem.js';

// ---- GLOBAL VARIABLES ----
let frameId = null;
let needsRender = true;
let isUserInteracting = false;
let userInteractionTimeout;
let isCameraMoving = false;
let camTargetPos = new THREE.Vector3();
let camTargetLookAt = new THREE.Vector3();
let rainEffect = null;
let environmentManager, carManager, labelSystem, scene, camera, renderer, controls, stats;
let lastTime = 0;
let currentView = 'front';
let isSwitchingCar = false;
let currentCar = 'macan2017';

// ---- MOBILE OPTIMIZATIONS ----
function setupMobileOptimizations() {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Smanji shadow map rezoluciju
    const lights = environmentManager.getLights();
    if (lights.dirLight) {
      lights.dirLight.shadow.mapSize.width = 512;
      lights.dirLight.shadow.mapSize.height = 512;
    }
  }
}

// ---- CAMERA PRESETS ----
const cameraPositions = {
  front: { pos: new THREE.Vector3(4, 1, 7), lookAt: new THREE.Vector3(-.3, 1, 0) },
  top: { pos: new THREE.Vector3(+0, 10, 0), lookAt: new THREE.Vector3(-.5, 0, 0) },
  rear: { pos: new THREE.Vector3(5, 1, -6), lookAt: new THREE.Vector3(-.45,1, 0) }
};

function moveCamera(preset) {
  const cp = cameraPositions[preset];
  camTargetPos.copy(cp.pos);
  camTargetLookAt.copy(cp.lookAt);
  isCameraMoving = true;
  needsRender = true;
}

function getCurrentCameraState() {
  return {
    position: camera.position.clone(),
    target: controls.target.clone()
  };
}


function setCarButtonsEnabled(enabled) {
    const btn911 = document.getElementById('btn_911Targa');
    const btnMacan = document.getElementById('btn_Macan');
    
    if (btn911) btn911.disabled = !enabled;
    if (btnMacan) btnMacan.disabled = !enabled;
    
    // Opcionalno: dodaj CSS klasu za vizualni feedback
    if (enabled) {
        btn911?.classList.remove('disabled');
        btnMacan?.classList.remove('disabled');
    } else {
        btn911?.classList.add('disabled');
        btnMacan?.classList.add('disabled');
    }
}
// ---- INITIALIZE UI ----
function initializeUI() {
  try {
    // Get button elements
    const btn911 = document.getElementById('btn_911Targa');
    const btnMacan = document.getElementById('btn_Macan');

    if (btn911) btn911.style.display = 'block';
    if (btnMacan) btnMacan.style.display = 'none';


if (btn911) {
    btn911.addEventListener('click', async () => {
        if (isSwitchingCar || currentCar === '911') return;
        isSwitchingCar = true;
        
        const previousState = getCurrentCameraState();
        const newCar = await carManager.switchToCar('911', camera, previousState);
        if (newCar) {
            console.log('Prebačeno na model: 911');
            currentCar = '911'; // AŽURIRAJ GLOBALNO STANJE
            btn911.style.display = 'none';
            if (btnMacan) btnMacan.style.display = 'block';
            
            if (labelSystem) {
                labelSystem.setLabel('911', currentView, true);
            }
        }
        
        isSwitchingCar = false;
    });
}

// Macan Button - switch to Macan
if (btnMacan) {
    btnMacan.addEventListener('click', async () => {
        if (isSwitchingCar || currentCar === 'macan2017') return;
        isSwitchingCar = true;
        
        const previousState = getCurrentCameraState();
        const newCar = await carManager.switchToCar('macan2017', camera, previousState);
        if (newCar) {
            console.log('Prebačeno na model: Macan');
            currentCar = 'macan2017'; // AŽURIRAJ GLOBALNO STANJE
            if (btn911) btn911.style.display = 'block';
            btnMacan.style.display = 'none';
            
            if (labelSystem) {
                labelSystem.setLabel('macan', currentView, true);
            }
        }
        
        isSwitchingCar = false;
    });
}

// Rain button - ISPRAVLJENO
const btnRain = document.getElementById('btn-rain');
if (btnRain) {
  btnRain.addEventListener('click', () => {
    if (rainEffect && environmentManager) {
      const isRaining = rainEffect.toggleRain();
      
      // KORISTI environmentManager za promjenu environmenta
      environmentManager.setRainMode(isRaining);
      
      btnRain.textContent = isRaining ? 'Stop Rain' : 'Rain';
      btnRain.classList.toggle('active', isRaining);

      // Ažuriraj temu UI-a
      updateUITheme(isRaining);

      // Promijeni boju labela ovisno o kiši
      if (labelSystem) {
        labelSystem.setRain(isRaining);
      }
    }
  });
}

    // Color buttons
    const carColorBtn = document.getElementById('carColorBtn');
    if (carColorBtn) {
      carColorBtn.addEventListener('click', () => {
        const activeCar = carManager.getActiveCar();
        if (!activeCar) return;
        const newColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
        activeCar.traverse((child) => {
          if (child.isMesh && child.material.name === 'carpaint') {
            child.material.color.set(newColor);
            child.material.needsUpdate = true;
          }
        });
        needsRender = true;
      });
    }

    // Camera preset buttons
const btnFront = document.getElementById('btn-front');
if (btnFront) btnFront.addEventListener('click', () => {
    moveCamera('front');
    currentView = 'front'; // AŽURIRAJ TRENUTNI PREGLED
    if (labelSystem) labelSystem.setView('front', true);
});

const btnTop = document.getElementById('btn-side');
if (btnTop) btnTop.addEventListener('click', () => {
    moveCamera('top');
    currentView = 'top'; // AŽURIRAJ TRENUTNI PREGLED
    if (labelSystem) labelSystem.setView('top', true);
});

const btnRear = document.getElementById('btn-rear');
if (btnRear) btnRear.addEventListener('click', () => {
    moveCamera('rear');
    currentView = 'rear'; // AŽURIRAJ TRENUTNI PREGLED
    if (labelSystem) labelSystem.setView('rear', true);
});

    console.log('UI initialized successfully');
  } catch (error) {
    console.error('UI initialization error:', error);
  }
}

// ---- INITIALIZATION ----
async function initialize() {
    console.log('Inicijaliziram aplikaciju...');

    // EKSPLICITNO POSTAVI POZADINU PRIJE BILO ČEGA
    scene.background = new THREE.Color(0xf0f0f0);
    console.log('Initial background set to:', scene.background);

    environmentManager.setupLights();
    await environmentManager.loadHDREnvironment('hdr/blocky_photo_studio_1k.hdr');
    await environmentManager.loadFloor('SM_Floor.glb');

    carManager = new CarManager(scene, environmentManager);
    await carManager.loadInitialCar();

    rainEffect = new RainEffect(scene, environmentManager);
    labelSystem = new LabelSystem(scene, carManager);
    
    if (labelSystem && labelSystem.setControls) {
        labelSystem.setControls(controls);
    }

    moveCamera('front');
    initializeUI();

    environmentManager.resetToSunnyDefaults();

    console.log('Aplikacija inicijalizirana');
}

function updateUITheme(isRainyMode) {
    const uiWrapperTop = document.getElementById('uiWrapperTop');
    const h1 = uiWrapperTop.querySelector('h1');

    if (isRainyMode) {
        // Rainy mode - tamna pozadina
        uiWrapperTop.classList.add('dark-theme');
        if (h1) h1.style.color = 'white';
    } else {
        // Sunny mode - svijetla pozadina
        uiWrapperTop.classList.remove('dark-theme');
        if (h1) h1.style.color = 'black';
    }
}

// ---- ANIMATION LOOP ----
function animate(time) {
  stats.begin();
  frameId = requestAnimationFrame(animate);

  // Inicijaliziraj lastTime ako je prvi frame
  if (lastTime === 0) {
    lastTime = time;
  }

  // Kamera lerp
  if (!isUserInteracting && isCameraMoving) {
    controls.target.lerp(camTargetLookAt, 0.05);
    camera.position.lerp(camTargetPos, 0.05);

    const distance = camera.position.distanceTo(camTargetPos);
    if (distance < 0.01) {
      camera.position.copy(camTargetPos);
      controls.target.copy(camTargetLookAt);
      isCameraMoving = false;
    }
  }

  // Update rain animation
  if (rainEffect) {
    rainEffect.update();
  }

  // Dok pada kiša, scena se mora stalno renderirati
  if (rainEffect && rainEffect.isRaining) {
    needsRender = true;
  }

  // Update light animation
  if (environmentManager) {
    const needsUpdate = environmentManager.updateLightAnimation();
    if (needsUpdate) {
      needsRender = true;
    }
  }

  // Update label system
  if (labelSystem) {
    labelSystem.update(time);
  }
  controls.update();

  if (needsRender) {
    renderer.render(scene, camera);
    needsRender = false;
  }

  lastTime = time;
  stats.end();
}

// ---- WINDOW EVENTS ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  needsRender = true;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameId);
  } else {
    needsRender = true;
    animate();
  }
});

window.addEventListener('load', () => {
  document.body.classList.add('loaded');
});

// ---- START APLIKACIJE ----
window.addEventListener('load', () => {
  // Inicijaliziraj Three.js komponente
  stats = Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  // Scene + Renderer
  const canvas = document.getElementById('canvas');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 2000);
  camera.position.set(4, 0, 7);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.autoUpdate = true;

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 1.0;
  controls.maxDistance = 20.0;
  controls.enableDamping = true;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.4835;

  controls.addEventListener('start', () => {
    isUserInteracting = true;

      if (labelSystem) labelSystem.onCameraStartMove();
    if (userInteractionTimeout) clearTimeout(userInteractionTimeout);
  });

  controls.addEventListener('end', () => {
    userInteractionTimeout = setTimeout(() => {
      isUserInteracting = false;
      isCameraMoving = true;
       if (labelSystem) labelSystem.onCameraStopMove();
    }, 1000);
  });

  controls.addEventListener('change', () => {
    needsRender = true;
  });

  // Inicijaliziraj managere
  environmentManager = new EnvironmentManager(scene, renderer);
  carManager = new CarManager(scene, environmentManager);

  // Postavi render callback
  environmentManager.setRenderCallback(() => {
    needsRender = true;
  });

  // Mobile optimizations
  setupMobileOptimizations();

  // Pokreni aplikaciju
  initialize();
  animate(0); // Počni s time = 0
});