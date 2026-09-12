// Loads a real rigged 3D avatar (Avaturn export, ARKit blendshapes) for
// whoever's turn it is today: the full standing figure pops up out of the
// center of the plate only once the plate has fully finished its own
// rotation (dial-animation.js fires a "plate-tilted" event when it does),
// never before. The avatar itself never spins/tilts — only the plate does —
// but it does loop its own baked idle animation (subtle breathing/weight
// shift, not a rotation) plus a one-sided "smirk" via the mouthSmileRight/
// mouthDimpleRight morph targets. Falls back silently to the initial-letter
// placeholder (already in the DOM) if no model exists yet for that person,
// or if the CDN/model fails to load.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.getElementById("avatar-canvas");
const initialLabel = document.getElementById("avatar-initial");
const mount = document.querySelector(".avatar-mount");

if (!canvas) {
  // Markup not present (shouldn't happen) — nothing to drive.
} else {
  const loader = new GLTFLoader();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(0.6, 1.2, 1.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe4c0, 0.5);
  fill.position.set(-1, 0.4, 1);
  scene.add(fill);

  let currentModel = null;
  let currentMixer = null;
  let smirkTween = null;
  let riseTween = null;
  let currentName = null;
  const clock = new THREE.Clock();

  // The plate (dial-animation.js) rotates on its own; the avatar only pops
  // up once that's fully done, never before.
  let plateTilted = false;
  window.addEventListener("plate-tilted", () => {
    plateTilted = true;
  });

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(canvas.parentElement);
  }
  resize();

  // Finds the first mesh in the hierarchy that has ARKit morph targets.
  function findMorphMesh(root) {
    let found = null;
    root.traverse((node) => {
      if (!found && node.isMesh && node.morphTargetDictionary) found = node;
    });
    return found;
  }

  // T-Pose exports hold the arms straight out to the sides (the rigging
  // bind pose) — rotate the upper arms down into a relaxed standing pose.
  // Mixamo-style rigs (which this bone naming matches) bind the arms along
  // the local X axis, so ~80deg of local Z rotation brings them to the side.
  // Rotates a T-pose upper-arm bone so it points straight down, computed
  // from its actual current world-space direction rather than a guessed
  // Euler angle — works regardless of how the specific rig's bind pose
  // axes are authored.
  function relaxArmDown(root, boneName, childName) {
    const bone = root.getObjectByName(boneName);
    const child = root.getObjectByName(childName);
    if (!bone || !child) return;
    root.updateMatrixWorld(true);

    const bonePos = new THREE.Vector3();
    const childPos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    child.getWorldPosition(childPos);
    const currentDir = childPos.clone().sub(bonePos).normalize();
    const targetDir = new THREE.Vector3(0, -1, 0);
    const deltaWorld = new THREE.Quaternion().setFromUnitVectors(currentDir, targetDir);

    const currentWorldQuat = new THREE.Quaternion();
    bone.getWorldQuaternion(currentWorldQuat);
    const newWorldQuat = deltaWorld.multiply(currentWorldQuat);

    const parentWorldQuat = new THREE.Quaternion();
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQuat);
    const newLocalQuat = parentWorldQuat.invert().multiply(newWorldQuat);

    bone.quaternion.copy(newLocalQuat);
    root.updateMatrixWorld(true);
  }

  function relaxTPose(root) {
    relaxArmDown(root, "LeftArm", "LeftForeArm");
    relaxArmDown(root, "RightArm", "RightForeArm");
  }

  // Frames the whole standing figure (feet to head), backing off enough to
  // fit whichever of height/width is more constraining for the camera's FOV.
  function frameFullBody(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const margin = 1.15;
    const distForHeight = (size.y * margin) / 2 / Math.tan(vFov / 2);
    const distForWidth = (size.x * margin) / 2 / Math.tan(hFov / 2);
    const distance = Math.max(distForHeight, distForWidth);
    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center.x, center.y, center.z);
    return size.y;
  }

  function applySmirk(mesh, v) {
    const d = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;
    const weights = { mouthSmileRight: 0.85, mouthSmileLeft: 0.2, mouthDimpleRight: 0.45, cheekSquintRight: 0.3 };
    for (const key in weights) {
      if (key in d) inf[d[key]] = v * weights[key];
    }
  }

  function startAnimations(morphMesh) {
    if (smirkTween) smirkTween.pause();

    if (morphMesh) {
      const morph = { v: 0 };
      smirkTween = anime({
        targets: morph,
        v: [
          { value: 0, duration: 1600 },
          { value: 1, duration: 350, easing: "easeOutQuad" },
          { value: 1, duration: 900 },
          { value: 0, duration: 350, easing: "easeInQuad" },
        ],
        loop: true,
        update: () => applySmirk(morphMesh, morph.v),
      });
    }
  }

  function renderLoop() {
    const delta = clock.getDelta();
    if (currentMixer) currentMixer.update(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }
  renderLoop();

  window.setTodayAvatar = function setTodayAvatar(name) {
    const key = name.toLowerCase();
    if (key === currentName) return;
    currentName = key;

    loader.load(
      `avatars/${key}.glb`,
      (gltf) => {
        if (riseTween) riseTween.pause();
        if (currentModel) scene.remove(currentModel);
        currentModel = gltf.scene;
        scene.add(currentModel);

        // Prefer the export's own baked idle animation (subtle breathing/
        // weight-shift, not a rotation) looping continuously for a natural
        // standing figure. Only fall back to the manual T-pose fix if no
        // animation exists at all.
        currentMixer = null;
        if (gltf.animations && gltf.animations.length > 0) {
          currentMixer = new THREE.AnimationMixer(currentModel);
          const action = currentMixer.clipAction(gltf.animations[0]);
          action.play();
          currentMixer.setTime(1.0); // a good reference frame for the initial camera framing below
        } else {
          relaxTPose(currentModel);
        }

        // Resize to the full-body container's shape first — frameFullBody
        // needs the correct (now taller) camera.aspect to fit the figure.
        mount.classList.add("has-model");
        resize();
        const bodyHeight = frameFullBody(currentModel);
        const morphMesh = findMorphMesh(currentModel);
        startAnimations(morphMesh);

        // WebGL compiles a model's shaders lazily, on the first frame that
        // actually rasterizes a visible pixel of it. Since the figure starts
        // sunk fully out of the camera frustum, that "first pixel" moment
        // would otherwise land mid-rise, causing a visible compile-stall
        // stutter right when it matters most. Force a render here, at the
        // full resting pose (fully in view) while the canvas is still
        // hidden from the user, to eat that compile cost silently.
        renderer.render(scene, camera);

        // Sink the figure below the plate now, but don't pop it up until the
        // plate has fully finished its own rotation — never before.
        const restY = currentModel.position.y;
        currentModel.position.y = restY - bodyHeight * 1.6;

        // Render again so the canvas's pixel buffer reflects the sunk
        // (out-of-frame) pose *before* we reveal it — otherwise the first
        // thing shown would briefly be the warm-up render's resting pose.
        renderer.render(scene, camera);

        canvas.hidden = false;
        initialLabel.hidden = true;

        const pop = () => {
          // The avatar itself never rotates/tilts — only the plate does.
          riseTween = anime({
            targets: currentModel.position,
            y: restY,
            duration: 1100,
            easing: "easeOutBack",
          });
        };

        if (plateTilted) pop();
        else window.addEventListener("plate-tilted", pop, { once: true });
      },
      undefined,
      () => {
        // No model for this person yet — keep the initial-letter fallback.
        mount.classList.remove("has-model");
        canvas.hidden = true;
        initialLabel.hidden = false;
      }
    );
  };

  // app.js may have already run (and stashed a name) before this module
  // finished fetching three.js from the CDN — pick that up now.
  if (window.__todayAvatarName) window.setTodayAvatar(window.__todayAvatarName);
}
