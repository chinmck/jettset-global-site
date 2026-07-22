import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const ROUTES = [
  {
    id: 'london-monaco', a: { name: 'London', lat: 51.5074, lon: -0.1278 },
    b: { name: 'Monaco', lat: 43.7384, lon: 7.4246, tz: 2 },
    label: 'London &rarr; Monaco', sub: 'Riviera Escape',
    flightTime: '1h 40m', aircraft: 'Light / Midsize Jet',
    concierge: 'Ground transfer from Nice Côte d’Azur and villa coordination arranged as part of the same journey.',
    cultural: 'Monaco Grand Prix — May',
  },
  {
    id: 'london-dubai', a: { name: 'London', lat: 51.5074, lon: -0.1278 },
    b: { name: 'Dubai', lat: 25.2048, lon: 55.2708, tz: 4 },
    label: 'London &rarr; Dubai', sub: 'Gulf Crossing',
    flightTime: '6h 45m', aircraft: 'Heavy Jet',
    concierge: 'Cabin and departure time selected around the arrival experience, with ground handling pre-arranged.',
    cultural: '',
  },
  {
    id: 'ny-london', a: { name: 'New York', lat: 40.7128, lon: -74.006 },
    b: { name: 'London', lat: 51.5074, lon: -0.1278, tz: 1 },
    label: 'New York &rarr; London', sub: 'Atlantic Crossing',
    flightTime: '7h 15m', aircraft: 'Heavy / Ultra Long Range',
    concierge: 'Arranged for work, rest and a considered arrival into the next time zone.',
    cultural: '',
  },
  {
    id: 'miami-newyork', a: { name: 'Miami', lat: 25.7617, lon: -80.1918, tz: -4 },
    b: { name: 'New York', lat: 40.7128, lon: -74.006, tz: -4 },
    label: 'Miami &rarr; New York', sub: 'Fair Week Route',
    flightTime: '2h 20m', aircraft: 'Light / Midsize Jet',
    concierge: 'Gallery and preview-day access coordinated through Concierge ahead of arrival.',
    cultural: 'Miami Art Basel — December',
  },
  {
    id: 'lagos-london', a: { name: 'Lagos', lat: 6.5244, lon: 3.3792, tz: 1 },
    b: { name: 'London', lat: 51.5074, lon: -0.1278, tz: 1 },
    label: 'Lagos &rarr; London', sub: '',
    flightTime: '6h 30m', aircraft: 'Heavy Jet',
    concierge: 'Ground transfer and onward arrangements held ready on both ends of the journey.',
    cultural: 'Lagos Seasonal Travel — December',
  },
  {
    id: 'london-paris', a: { name: 'London', lat: 51.5074, lon: -0.1278 },
    b: { name: 'Paris', lat: 48.8566, lon: 2.3522, tz: 2 },
    label: 'London &rarr; Paris', sub: '',
    flightTime: '55m', aircraft: 'Light Jet',
    concierge: 'Show-seating and venue transfers arranged alongside the journey.',
    cultural: 'Paris Fashion Week — September',
  },
  {
    id: 'london-accra', a: { name: 'London', lat: 51.5074, lon: -0.1278 },
    b: { name: 'Accra', lat: 5.6037, lon: -0.187, tz: 0 },
    label: 'London &rarr; Accra', sub: 'West Africa Connection',
    flightTime: '6h 25m', aircraft: 'Heavy Jet',
    concierge: 'Arrival handling and onward ground movement coordinated around the purpose of the journey.',
    cultural: 'Accra in December',
  },
];

const canvas = document.getElementById('globeCanvas');
const chipWrap = document.getElementById('routeChips');
const staticFallback = document.getElementById('staticFallback');
const panel = document.getElementById('journeyPanel');
const hint = document.getElementById('globeHint');
let fallbackReady = false;
let activeRouteId = ROUTES[0].id;
let globeRouteController = null;

function createFallbackRows() {
  if (fallbackReady) return;
  fallbackReady = true;
  ROUTES.forEach((route) => {
    const row = document.createElement('div');
    row.className = 'static-route-row';
    row.innerHTML = `<span>${route.label}</span><span>${route.flightTime}</span>`;
    row.addEventListener('click', () => selectRoute(route.id));
    staticFallback.appendChild(row);
  });
}

function showFallback() {
  createFallbackRows();
  canvas.hidden = true;
  hint.hidden = true;
  staticFallback.classList.add('is-shown');
}

function initGlobe() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    console.error('Jettset World WebGL initialisation failed.', error);
    showFallback();
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const studioEnvironment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = studioEnvironment;
  environmentGenerator.dispose();
  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
  camera.position.set(0, 0.02, 7.4);

  const globe = new THREE.Group();
  globe.rotation.set(-0.12, 4.15, -0.055);
  scene.add(globe);

  const routeLayer = new THREE.Group();
  globe.add(routeLayer);

  scene.add(new THREE.AmbientLight(0x3d434a, 0.62));

  const keyLight = new THREE.DirectionalLight(0xffe3bf, 2.75);
  keyLight.position.set(5.2, 4.8, 6.2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8599a6, 0.82);
  fillLight.position.set(-4.8, -0.2, 3.4);
  scene.add(fillLight);

  const lowerFill = new THREE.DirectionalLight(0x666b6f, 0.58);
  lowerFill.position.set(0.2, -4.6, 2.8);
  scene.add(lowerFill);

  const rimLight = new THREE.DirectionalLight(0xffcb83, 0.82);
  rimLight.position.set(4.4, 3.2, -2.8);
  scene.add(rimLight);

  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (path) => new Promise((resolve, reject) => textureLoader.load(path, resolve, undefined, reject));

  Promise.all([
    loadTexture('./jettset-world/assets/earth-material-2048.png'),
    loadTexture('./jettset-world/assets/earth-relief-2048.png'),
    loadTexture('./jettset-world/assets/earth-roughness-2048.png'),
  ]).then(([materialTexture, reliefTexture, roughnessTexture]) => {
      materialTexture.colorSpace = THREE.SRGBColorSpace;
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      materialTexture.anisotropy = anisotropy;
      reliefTexture.anisotropy = anisotropy;
      roughnessTexture.anisotropy = anisotropy;

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1.62, 128, 96),
        new THREE.MeshPhysicalMaterial({
          map: materialTexture,
          bumpMap: reliefTexture,
          bumpScale: 0.074,
          displacementMap: reliefTexture,
          displacementScale: 0.018,
          displacementBias: -0.006,
          roughnessMap: roughnessTexture,
          color: 0xa3a39f,
          roughness: 0.88,
          metalness: 0.34,
          clearcoat: 0.09,
          clearcoatRoughness: 0.84,
          envMapIntensity: 0.18,
          specularIntensity: 0.44,
          specularColor: new THREE.Color(0xd9c7aa),
          transparent: false,
        }),
      );
      globe.add(earth);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.665, 96, 64),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          uniforms: {
            rimColor: { value: new THREE.Color(0xe0b16c) },
            rimStrength: { value: 0.19 },
          },
          vertexShader: `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vNormal = normalize(mat3(modelMatrix) * normal);
              vView = normalize(cameraPosition - worldPosition.xyz);
              gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
          `,
          fragmentShader: `
            uniform vec3 rimColor;
            uniform float rimStrength;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.7);
              float lightSide = smoothstep(-0.35, 0.72, dot(normalize(vNormal), normalize(vec3(1.0, 0.28, 0.42))));
              gl_FragColor = vec4(rimColor, fresnel * rimStrength * (0.16 + lightSide * 0.84));
            }
          `,
        }),
      );
      globe.add(atmosphere);
      globeRouteController = createRouteController();
      globeRouteController.select(activeRouteId, true);
      resize();
      start();
    }).catch((error) => {
      console.error('Jettset World globe assets or scene failed to initialise.', error);
      renderer.dispose();
      showFallback();
    });

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let frame = null;
  let previous = performance.now();
  let needsRender = true;
  let dragging = false;
  let pointerX = 0;
  let pointerY = 0;
  let targetQuaternion = null;
  let aircraftProgress = 0;

  function latLonVector(point, radius = 1.64) {
    const latitude = THREE.MathUtils.degToRad(point.lat);
    const longitude = THREE.MathUtils.degToRad(point.lon);
    const cosLatitude = Math.cos(latitude);
    return new THREE.Vector3(
      cosLatitude * Math.cos(longitude) * radius,
      Math.sin(latitude) * radius,
      -cosLatitude * Math.sin(longitude) * radius,
    );
  }

  function makeLabel(text, side) {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext('2d');
    context.font = '600 25px Arial, sans-serif';
    context.fillStyle = '#f3eadb';
    context.shadowColor = 'rgba(0,0,0,.95)';
    context.shadowBlur = 10;
    const characters = [...text.toUpperCase()];
    let cursor = 22;
    characters.forEach((character) => {
      context.fillText(character, cursor, 58);
      cursor += context.measureText(character).width + 4;
    });
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.68, 0.128, 1);
    sprite.center.set(side < 0 ? 1 : 0, 0.5);
    sprite.userData.dispose = () => texture.dispose();
    return sprite;
  }

  function makeMarker(point, side) {
    const group = new THREE.Group();
    const position = latLonVector(point, 1.665);
    group.position.copy(position);

    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 20, 14),
      new THREE.MeshPhysicalMaterial({
        color: 0xffdf9e,
        emissive: 0xb77924,
        emissiveIntensity: 0.72,
        roughness: 0.34,
        metalness: 0.58,
      }),
    ));

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.034, 0.046, 32),
      new THREE.MeshBasicMaterial({
        color: 0xd9ac5d,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    halo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
    group.add(halo);

    const label = makeLabel(point.name, side);
    label.position.copy(position.clone().normalize().multiplyScalar(0.15));
    label.position.y += 0.075;
    group.add(label);
    return group;
  }

  function makeAircraft() {
    const shape = new THREE.Shape();
    shape.moveTo(0.11, 0);
    shape.lineTo(0.018, 0.016);
    shape.lineTo(-0.025, 0.078);
    shape.lineTo(-0.044, 0.073);
    shape.lineTo(-0.022, 0.012);
    shape.lineTo(-0.095, 0.026);
    shape.lineTo(-0.112, 0.012);
    shape.lineTo(-0.055, 0);
    shape.lineTo(-0.112, -0.012);
    shape.lineTo(-0.095, -0.026);
    shape.lineTo(-0.022, -0.012);
    shape.lineTo(-0.044, -0.073);
    shape.lineTo(-0.025, -0.078);
    shape.lineTo(0.018, -0.016);
    shape.closePath();
    const aircraft = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: 0xf1c56f, side: THREE.DoubleSide, toneMapped: false }),
    );
    aircraft.scale.setScalar(0.58);
    aircraft.renderOrder = 4;
    return aircraft;
  }

  function disposeRouteLayer() {
    routeLayer.traverse((object) => {
      object.userData.dispose?.();
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    routeLayer.clear();
  }

  function routeFacingQuaternion(route) {
    const midpoint = latLonVector(route.a, 1).add(latLonVector(route.b, 1)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(midpoint, new THREE.Vector3(0.12, 0.04, 1).normalize());
  }

  function createRouteController() {
    return {
      curve: null,
      aircraft: null,
      phase: 'idle',
      elapsed: 0,
      pendingRoute: null,
      onComplete: null,
      select(id, immediate = false, onComplete = null) {
        const route = ROUTES.find((item) => item.id === id);
        if (!route) return;
        this.pendingRoute = route;
        this.onComplete = onComplete;

        if (immediate || reducedMotion) {
          disposeRouteLayer();
          this.build(route, true);
          globe.quaternion.copy(routeFacingQuaternion(route));
          targetQuaternion = null;
          this.phase = 'idle';
          this.onComplete?.();
          this.onComplete = null;
          needsRender = true;
          start();
          return;
        }

        routeLayer.traverse((object) => {
          if (object.material) object.material.userData.transitionOpacity = object.material.opacity;
        });
        this.phase = routeLayer.children.length ? 'fade-out' : 'build';
        this.elapsed = 0;
        targetQuaternion = null;
        start();
      },
      build(route, visible = false) {
        disposeRouteLayer();

        const startPoint = latLonVector(route.a, 1).normalize();
        const endPoint = latLonVector(route.b, 1).normalize();
        const angle = startPoint.angleTo(endPoint);
        const samples = Math.max(40, Math.ceil(angle * 72));
        const sinAngle = Math.sin(angle);
        const points = [];
        for (let index = 0; index <= samples; index += 1) {
          const progress = index / samples;
          const direction = sinAngle > 0.0001
            ? startPoint.clone().multiplyScalar(Math.sin((1 - progress) * angle) / sinAngle)
              .add(endPoint.clone().multiplyScalar(Math.sin(progress * angle) / sinAngle))
              .normalize()
            : startPoint.clone();
          const altitude = 1.69 + Math.sin(Math.PI * progress) * Math.min(0.25, 0.10 + angle * 0.105);
          points.push(direction.multiplyScalar(altitude));
        }

        this.curve = new THREE.CatmullRomCurve3(points);
        const arc = new THREE.Mesh(
          new THREE.TubeGeometry(this.curve, samples * 2, 0.0045, 8, false),
          new THREE.MeshBasicMaterial({
            color: 0xd8ad5c,
            transparent: true,
            opacity: visible ? 0.82 : 0,
            toneMapped: false,
          }),
        );
        arc.material.userData.routeOpacity = 0.82;
        const arcIndexCount = arc.geometry.index?.count || 0;
        arc.geometry.setDrawRange(0, visible ? arcIndexCount : 0);
        arc.renderOrder = 3;
        const originMarker = makeMarker(route.a, -1);
        const destinationMarker = makeMarker(route.b, 1);
        [originMarker, destinationMarker].forEach((marker) => {
          marker.traverse((object) => {
            if (!object.material) return;
            object.material.transparent = true;
            object.material.userData.routeOpacity = object.material.opacity;
            object.material.opacity = visible ? object.material.userData.routeOpacity : 0;
          });
        });
        routeLayer.add(arc, originMarker, destinationMarker);

        this.aircraft = makeAircraft();
        this.aircraft.material.transparent = true;
        this.aircraft.material.userData.routeOpacity = 1;
        this.aircraft.material.opacity = visible ? 1 : 0;
        routeLayer.add(this.aircraft);
        this.arc = arc;
        this.arcIndexCount = arcIndexCount;
        this.originMarker = originMarker;
        this.destinationMarker = destinationMarker;
        aircraftProgress = 0.12;
        this.updateAircraft(aircraftProgress);
      },
      updateAircraft(progress) {
        if (!this.curve || !this.aircraft) return;
        const point = this.curve.getPointAt(progress);
        const tangent = this.curve.getTangentAt(progress).normalize();
        const normal = point.clone().normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        this.aircraft.position.copy(point);
        this.aircraft.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, binormal, normal));
      },
      setOpacity(root, multiplier, source = 'routeOpacity') {
        root?.traverse((object) => {
          if (object.material?.userData[source] !== undefined) {
            object.material.opacity = object.material.userData[source] * multiplier;
          }
        });
      },
      update(delta) {
        if (this.phase === 'idle') return false;
        this.elapsed += delta;

        if (this.phase === 'fade-out') {
          const progress = Math.min(1, this.elapsed / 0.22);
          this.setOpacity(routeLayer, 1 - THREE.MathUtils.smoothstep(progress, 0, 1), 'transitionOpacity');
          if (progress >= 1) {
            disposeRouteLayer();
            this.phase = 'build';
            this.elapsed = 0;
          }
          return true;
        }

        if (this.phase === 'build') {
          this.build(this.pendingRoute, false);
          targetQuaternion = routeFacingQuaternion(this.pendingRoute);
          this.phase = 'settle';
          this.elapsed = 0;
          return true;
        }

        if (this.phase === 'settle') {
          if (!dragging && targetQuaternion === null) {
            this.phase = 'origin';
            this.elapsed = 0;
          }
          return true;
        }

        if (this.phase === 'origin') {
          const progress = Math.min(1, this.elapsed / 0.28);
          this.setOpacity(this.originMarker, THREE.MathUtils.smoothstep(progress, 0, 1));
          if (progress >= 1) {
            this.phase = 'arc';
            this.elapsed = 0;
          }
          return true;
        }

        if (this.phase === 'arc') {
          const progress = Math.min(1, this.elapsed / 0.68);
          const eased = 1 - ((1 - progress) ** 3);
          const count = Math.floor((this.arcIndexCount * eased) / 6) * 6;
          this.arc.geometry.setDrawRange(0, Math.max(6, count));
          this.arc.material.opacity = 0.82;
          if (progress >= 1) {
            this.phase = 'aircraft';
            this.elapsed = 0;
          }
          return true;
        }

        if (this.phase === 'aircraft') {
          const progress = Math.min(1, this.elapsed / 0.20);
          this.aircraft.material.opacity = THREE.MathUtils.smoothstep(progress, 0, 1);
          if (progress >= 1) {
            this.phase = 'destination';
            this.elapsed = 0;
          }
          return true;
        }

        if (this.phase === 'destination') {
          const progress = Math.min(1, this.elapsed / 0.30);
          this.setOpacity(this.destinationMarker, THREE.MathUtils.smoothstep(progress, 0, 1));
          if (progress >= 1) {
            this.phase = 'idle';
            this.elapsed = 0;
            this.onComplete?.();
            this.onComplete = null;
          }
          return true;
        }

        return false;
      },
    };
  }

  function tick(now) {
    frame = null;
    if (document.hidden) return;
    const delta = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    let animating = false;

    if (!reducedMotion && !dragging && targetQuaternion) {
      const angle = globe.quaternion.angleTo(targetQuaternion);
      if (angle > 0.006) {
        globe.quaternion.slerp(targetQuaternion, Math.min(1, delta * 2.0));
        animating = true;
      } else {
        globe.quaternion.copy(targetQuaternion);
        targetQuaternion = null;
      }
    }

    if (!reducedMotion && !dragging && !targetQuaternion && globeRouteController?.phase === 'idle') {
      globe.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), delta * 0.0025);
      animating = true;
    }

    if (!reducedMotion && globeRouteController?.update(delta)) animating = true;

    if (!reducedMotion && globeRouteController?.aircraft) {
      aircraftProgress = (aircraftProgress + delta * 0.055) % 1;
      globeRouteController.updateAircraft(aircraftProgress);
      animating = true;
    }

    if (needsRender || animating || dragging) renderer.render(scene, camera);
    needsRender = false;
    if (!reducedMotion || dragging || animating) frame = requestAnimationFrame(tick);
  }

  function start() {
    resize();
    if (!document.hidden && frame === null) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    targetQuaternion = null;
    canvas.setPointerCapture(event.pointerId);
    start();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const deltaX = THREE.MathUtils.clamp(event.clientX - pointerX, -24, 24);
    const deltaY = THREE.MathUtils.clamp(event.clientY - pointerY, -24, 24);
    pointerX = event.clientX;
    pointerY = event.clientY;
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.0052);
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.0042);
    globe.quaternion.premultiply(yaw).premultiply(pitch).normalize();
    needsRender = true;
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    needsRender = true;
    start();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
    observer.disconnect();
    renderer.dispose();
    showFallback();
  }, { once: true });
}

function timezoneLabel(offset) {
  return `UTC${offset >= 0 ? '+' : ''}${offset}`;
}

function localTimeFor(offsetHours) {
  const now = new Date();
  const utcMilliseconds = now.getTime() + (now.getTimezoneOffset() * 60000);
  const destination = new Date(utcMilliseconds + (offsetHours * 3600000));
  const hour = destination.getHours();
  const minute = destination.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minute < 10 ? '0' : ''}${minute} ${period}`;
}

chipWrap.querySelectorAll('.route-chip').forEach((button) => {
  button.addEventListener('click', () => selectRoute(button.dataset.id));
});

let timeInterval = null;

function updateJourneyPanel(route) {
  document.getElementById('jpRouteName').innerHTML = route.label;
  document.getElementById('jpRouteSub').textContent = route.sub || 'Signature Journey';
  document.getElementById('jpFlightTime').textContent = route.flightTime;
  document.getElementById('jpAircraft').textContent = route.aircraft;
  document.getElementById('jpConcierge').textContent = route.concierge;
  document.getElementById('jvFrom').value = route.a.name;
  document.getElementById('jvTo').value = route.b.name;
  document.getElementById('jvDepartureLabel').textContent = route.a.name;
  document.getElementById('jvDestinationLabel').textContent = route.b.name;

  const cultural = document.getElementById('jpCultural');
  cultural.textContent = route.cultural;
  cultural.classList.toggle('is-empty', !route.cultural);

  const updateTime = () => {
    document.getElementById('jpLocalTime').textContent =
      `${localTimeFor(route.b.tz)} (${timezoneLabel(route.b.tz)})`;
  };
  updateTime();
  if (timeInterval) clearInterval(timeInterval);
  timeInterval = setInterval(updateTime, 60000);

  panel.classList.add('is-visible');
}

function selectRoute(id) {
  const route = ROUTES.find((item) => item.id === id);
  if (!route) return;
  activeRouteId = id;

  chipWrap.querySelectorAll('.route-chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.id === id);
  });

  if (globeRouteController) {
    panel.classList.remove('is-visible');
    globeRouteController.select(id, false, () => updateJourneyPanel(route));
  } else {
    updateJourneyPanel(route);
  }
}

document.getElementById('jpCta').addEventListener('click', () => {
  const from = document.getElementById('jvFrom').value.trim();
  const to = document.getElementById('jvTo').value.trim();
  const date = document.getElementById('jvDate').value;
  const travellers = document.getElementById('jvTravellers').value;
  if (from) sessionStorage.setItem('prefill_qFrom', from);
  if (to) sessionStorage.setItem('prefill_qTo', to);
  if (date) sessionStorage.setItem('prefill_qDepart', date);
  sessionStorage.setItem('prefill_qAdults', travellers === '8' ? '8' : travellers);
  window.location.href = 'quote.html';
});

const matchEnteredRoute = () => {
  const from = document.getElementById('jvFrom').value.trim().toLowerCase();
  const to = document.getElementById('jvTo').value.trim().toLowerCase();
  const route = ROUTES.find((item) => item.a.name.toLowerCase() === from && item.b.name.toLowerCase() === to);
  document.getElementById('jvDepartureLabel').textContent = document.getElementById('jvFrom').value.trim() || 'Departure';
  document.getElementById('jvDestinationLabel').textContent = document.getElementById('jvTo').value.trim() || 'Destination';
  if (route) selectRoute(route.id);
};
document.getElementById('jvFrom').addEventListener('change', matchEnteredRoute);
document.getElementById('jvTo').addEventListener('change', matchEnteredRoute);

selectRoute(ROUTES[0].id);
initGlobe();
