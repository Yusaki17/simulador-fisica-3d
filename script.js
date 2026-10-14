// script.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

let scene, camera, renderer, orbitControls, dragControls;
let moduloActivo = 0;

// Variables Módulo 1
const cargas = [];
const meshesArrastrables = [];
const flechasCampo = [];
let campoActivo = false;

// Variables Módulo 2
let placaSup, placaInf, dielectrico, grupoCargasVisuales;
const epsilon0 = 8.854e-12;

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: null
    };

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);
}

window.cargarModulo = function(num) {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('modulo1').classList.add('hidden');
    document.getElementById('modulo2').classList.add('hidden');
    document.getElementById(`modulo${num}`).classList.remove('hidden');
    moduloActivo = num;

    while(scene.children.length > 0) scene.remove(scene.children[0]);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    if (num === 1) {
        camera.position.set(0, 5, 10);
        scene.add(new THREE.GridHelper(20, 20, 0x444444, 0x222222));
        iniciarMod1();
    } else if (num === 2) {
        camera.position.set(5, 5, 10);
        iniciarMod2();
    }
    if (!animacionId) animar();
};

window.volverMenu = function() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('modulo1').classList.add('hidden');
    document.getElementById('modulo2').classList.add('hidden');
    moduloActivo = 0;
    if (dragControls) dragControls.deactivate();
    while(scene.children.length > 0) scene.remove(scene.children[0]);
};

// --- LÓGICA MÓDULO 1 ---
function iniciarMod1() {
    meshesArrastrables.length = 0;
    flechasCampo.length = 0;
    campoActivo = false;
    agregarCarga(1);
    agregarCarga(-1);
    
    if (dragControls) dragControls.deactivate();
    dragControls = new DragControls(meshesArrastrables, camera, renderer.domElement);
    dragControls.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: THREE.MOUSE.PAN };

    dragControls.addEventListener('dragstart', (e) => { orbitControls.enabled = false; });
    dragControls.addEventListener('dragend', (e) => { 
        orbitControls.enabled = true; 
        if(campoActivo) actualizarCampo();
    });
}

window.agregarCarga = function(signo) {
    const geo = new THREE.SphereGeometry(0.5, 32, 32);
    const color = signo > 0 ? 0xff3333 : 0x3333ff;
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random()-0.5)*4, 1, (Math.random()-0.5)*4);
    mesh.userData.signo = signo;
    scene.add(mesh);
    cargas.push({ mesh, signo });
    meshesArrastrables.push(mesh);
    document.getElementById('contador').textContent = cargas.length;
    if(campoActivo) actualizarCampo();
};

window.toggleCampo = function() {
    campoActivo = !campoActivo;
    if (campoActivo) actualizarCampo();
    else { flechasCampo.forEach(f => scene.remove(f)); flechasCampo.length = 0; }
};

function actualizarCampo() {
    flechasCampo.forEach(f => scene.remove(f));
    flechasCampo.length = 0;
    const paso = 1.5;
    for (let x = -8; x <= 8; x += paso) {
        for (let y = 0; y <= 4; y += 2) {
            for (let z = -8; z <= 8; z += paso) {
                const punto = new THREE.Vector3(x, y, z);
                const E = calcularCampo(punto);
                if (E.length() < 0.01) continue;
                const flecha = new THREE.ArrowHelper(E.clone().normalize(), punto, Math.min(E.length()*1e-10, 0.8), 0xffff00, 0.2, 0.1);
                scene.add(flecha);
                flechasCampo.push(flecha);
            }
        }
    }
}

function calcularCampo(punto) {
    const E = new THREE.Vector3(0,0,0);
    for (const c of cargas) {
        const r = new THREE.Vector3().subVectors(punto, c.mesh.position);
        if (r.length() < 0.3) continue;
        E.add(r.normalize().multiplyScalar(8.99e9 * c.signo * 1e-9 / (r.length()*r.length())));
    }
    return E;
}

window.limpiarTodo = function() {
    cargas.forEach(c => scene.remove(c.mesh));
    cargas.length = 0; meshesArrastrables.length = 0;
    flechasCampo.forEach(f => scene.remove(f)); flechasCampo.length = 0;
    campoActivo = false;
    document.getElementById('contador').textContent = '0';
};

// --- LÓGICA MÓDULO 2 ---
function iniciarMod2() {
    const matPlaca = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 });
    placaSup = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 2), matPlaca);
    placaInf = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 2), matPlaca);
    scene.add(placaSup); scene.add(placaInf);

    dielectrico = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 1.9), new THREE.MeshStandardMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 }));
    scene.add(dielectrico);

    grupoCargasVisuales = new THREE.Group();
    scene.add(grupoCargasVisuales);

    ['A', 'd', 'K', 'V'].forEach(id => {
        const s = document.getElementById(`slider-${id}`);
        const i = document.getElementById(`input-${id}`);
        s.addEventListener('input', () => { i.value = s.value; actualizarCapacitor(); });
        i.addEventListener('input', () => { 
            let v = parseFloat(i.value); 
            if(!isNaN(v)) { s.value = Math.max(s.min, Math.min(s.max, v)); actualizarCapacitor(); } 
        });
    });
    actualizarCapacitor();
}

function actualizarCapacitor() {
    if (moduloActivo !== 2) return;
    const A = parseFloat(document.getElementById('input-A').value) || 1;
    const d_mm = parseFloat(document.getElementById('input-d').value) || 5;
    const K = parseFloat(document.getElementById('input-K').value) || 1;
    const V = parseFloat(document.getElementById('input-V').value) || 100;

    const esc = Math.min(Math.sqrt(A), 4);
    const sep = Math.min(d_mm * 0.2, 3);
    
    placaSup.scale.set(esc, 1, esc); placaInf.scale.set(esc, 1, esc);
    placaSup.position.y = sep; placaInf.position.y = -sep;
    
    dielectrico.scale.set(esc*0.95, (sep*2*0.95)/1.9, esc*0.95);
    dielectrico.visible = K > 1.05;

    while(grupoCargasVisuales.children.length > 0) grupoCargasVisuales.remove(grupoCargasVisuales.children[0]);
    if (V > 0) {
        const geoP = new THREE.SphereGeometry(0.08, 8, 8);
        for(let i=0; i<30; i++) {
            const x = (Math.random()-0.5)*esc*0.8, z = (Math.random()-0.5)*esc*0.8;
            grupoCargasVisuales.add(new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({color:0xff0000})).translateX(x).translateY(sep+0.15).translateZ(z));
            grupoCargasVisuales.add(new THREE.Mesh(geoP, new THREE.MeshBasicMaterial({color:0x0000ff})).translateX(x).translateY(-sep-0.15).translateZ(z));
        }
    }

    const C = (K * epsilon0 * A) / (d_mm * 1e-3);
    document.getElementById('val-C').textContent = (C*1e12).toFixed(2) + ' pF';
    document.getElementById('val-U').textContent = (0.5*C*V*V*1e9).toFixed(2) + ' nJ';
    document.getElementById('val-Q').textContent = (C*V*1e9).toFixed(2) + ' nC';
}

let animacionId;
function animar() {
    animacionId = requestAnimationFrame(animar);
    orbitControls.update();
    renderer.render(scene, camera);
}

initThree();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});