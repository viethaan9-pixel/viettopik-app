// 3D 마스코트 (Robot Expressive by Tomás Laulhé · CC0 1.0 · three.js)
// home: 로그인하면 걸어 나와서 인사 · study: 걸어 들어와 책상 의자에 앉아서 "Cố lên!" 응원
import * as THREE from "three";
import { GLTFLoader } from "../vendor/jsm/loaders/GLTFLoader.js";

const S = window.MSC;
const box = document.createElement("div");
box.className = "msc"; box.hidden = true;
box.innerHTML = `<div class="mbub" hidden></div><canvas aria-hidden="true"></canvas>`;
document.body.appendChild(box);
const bub = box.querySelector(".mbub"), cv = box.querySelector("canvas");

const W = 132, H = 156;
const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8fa8, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 5); scene.add(sun);

// 책상 + 의자 (study 모드에서만 보여요)
const room = new THREE.Group(); room.visible = false; scene.add(room);
const wood = new THREE.MeshStandardMaterial({ color: 0xc8935f, roughness: .7 });
const dark = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: .8 });
const add = (g, m, x, y, z, p = room) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); p.add(o); return o; };
const chair = new THREE.Group(); room.add(chair);
add(new THREE.BoxGeometry(1.5, .16, 1.4), wood, 0, 1.3, 0, chair);                 // seat
add(new THREE.BoxGeometry(1.5, 1.7, .16), wood, 0, 2.15, -.7, chair);              // back
[[-.65, -.6], [.65, -.6], [-.65, .6], [.65, .6]].forEach(([x, z]) => add(new THREE.BoxGeometry(.14, 1.3, .14), dark, x, .65, z, chair));
const desk = new THREE.Group(); room.add(desk); desk.position.set(0, 0, 1.75);
add(new THREE.BoxGeometry(2.6, .16, 1.3), wood, 0, 2.3, 0, desk);
[[-1.15, -.5], [1.15, -.5], [-1.15, .5], [1.15, .5]].forEach(([x, z]) => add(new THREE.BoxGeometry(.14, 2.3, .14), dark, x, 1.15, z, desk));
const book = add(new THREE.BoxGeometry(1.0, .07, .7), new THREE.MeshStandardMaterial({ color: 0xffffff }), -.1, 2.42, -.15, desk);
book.rotation.y = .15;
add(new THREE.BoxGeometry(1.02, .05, .72), new THREE.MeshStandardMaterial({ color: 0x2b4fa8 }), -.1, 2.37, -.15, desk).rotation.y = .15;
const pencil = add(new THREE.CylinderGeometry(.035, .035, .8, 8), new THREE.MeshStandardMaterial({ color: 0xf3c64e }), .55, 2.43, -.05, desk);
pencil.rotation.z = Math.PI / 2; pencil.rotation.y = -.6;

let robot = null, mixer = null, acts = {}, cur = null, mode = "off", raf = 0, last = 0, walk = null, cheerT = 0, bubT = 0;
const CHEERS = ["Cố lên! Cố lên! 💪", "화이팅! Cố lên nào!", "Cố lên cố lên! 📖", "Tập trung nào! 힘내요!", "Làm tốt lắm! Cố lên!"];
const HELLO = ["Xin chào!! 👋 안녕하세요!", "Cùng nhau chăm chỉ nhé! 💪"];

function say(t, ms = 2600) { bub.textContent = t; bub.hidden = false; bub.classList.remove("pop"); void bub.offsetWidth; bub.classList.add("pop");
  clearTimeout(bubT); bubT = setTimeout(() => { bub.hidden = true; }, ms); }
function play(name, { once = false, fade = .25 } = {}) {
  const a = acts[name]; if (!a) return;
  a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.enabled = true;
  if (cur && cur !== a) { a.crossFadeFrom(cur, fade, false); } a.play(); cur = a;
}
function emote(name, back) { play(name, { once: true, fade: .2 });
  const done = e => { if (e.action !== acts[name]) return; mixer.removeEventListener("finished", done); if (mode !== "off") play(back, { fade: .3 }); };
  mixer.addEventListener("finished", done); }

function frame(t) {
  raf = requestAnimationFrame(frame);
  if (t - last < 30) return;                       // ~30 fps is enough and saves battery
  const dt = Math.min(.08, (t - last) / 1000 || 0); last = t;
  if (walk && robot) { walk.t += dt; const k = Math.min(1, walk.t / walk.d);
    robot.position.x = walk.x0 + (walk.x1 - walk.x0) * k; robot.position.z = walk.z0 + (walk.z1 - walk.z0) * k;
    if (k >= 1) { const f = walk.end; walk = null; f && f(); } }
  if (mode === "study" && t > cheerT) { cheerT = t + 7000; say(CHEERS[Math.random() * CHEERS.length | 0], 2800); }
  mixer && mixer.update(dt);
  renderer.render(scene, cam);
}
const loop = on => { cancelAnimationFrame(raf); if (on) { last = performance.now(); raf = requestAnimationFrame(frame); } };

function setMode(m, hello) {
  if (!robot) return;
  if (S.off()) m = "off";
  if (m === mode && !hello) return;
  mode = m; document.documentElement.dataset.msc = m === "off" ? "" : m;
  box.classList.toggle("study", m === "study");
  if (m === "off") { box.hidden = true; bub.hidden = true; walk = null; loop(false); return; }
  box.hidden = false; loop(true);
  if (m === "home") {
    room.visible = false; cam.position.set(0, 3.4, 12); cam.lookAt(0, 2.2, 0);
    robot.rotation.y = 0; robot.position.set(0, 0, 0);
    if (hello) {      // 오른쪽에서 걸어 나와서 인사
      robot.position.x = 5; robot.rotation.y = -Math.PI / 2; play("Walking");
      walk = { t: 0, d: 1.6, x0: 5, x1: 0, z0: 0, z1: 0, end: () => { robot.rotation.y = 0; emote("Wave", "Idle"); say(HELLO[0], 2600);
        setTimeout(() => { if (mode === "home") { emote("ThumbsUp", "Idle"); say(HELLO[1], 3200); } }, 2700); } };
    } else play("Idle");
  } else {            // study: 걸어 들어와서 의자에 앉기
    room.visible = true; cam.position.set(9.5, 6.4, 11.5); cam.lookAt(-.1, 2.0, .9);
    robot.position.set(4, 0, 0); robot.rotation.y = -Math.PI / 2; play("Walking");
    walk = { t: 0, d: 1.1, x0: 4, x1: 0, z0: 0, z1: 0, end: () => {
      robot.rotation.y = 0; robot.position.set(0, .55, -.15); play("Sitting", { once: true, fade: .2 });
      cheerT = performance.now() + 900; } };
  }
}

new GLTFLoader().load(new URL("robot.glb", import.meta.url).href, g => {
  robot = g.scene; robot.scale.setScalar(.82); scene.add(robot);
  mixer = new THREE.AnimationMixer(robot);
  g.animations.forEach(c => { acts[c.name] = mixer.clipAction(c); });
  cv.addEventListener("click", () => { if (mode === "home") { emote(["Wave", "Yes", "ThumbsUp", "Dance"][Math.random() * 4 | 0], "Idle"); say([...HELLO, "Hôm nay học gì nhỉ? 오늘도 화이팅!"][Math.random() * 3 | 0]); } });
  S.cb = () => setMode(S.want, S.hello && !(S.hello = false));
  S.cb();
}, undefined, e => console.warn("mascot", e));
document.addEventListener("visibilitychange", () => loop(document.visibilityState === "visible" && mode !== "off"));
