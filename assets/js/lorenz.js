import * as THREE from 'three';

import { AsciiEffect } from 'three/addons/effects/AsciiEffect.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

export function mountLorenz(rootEl) {
    let camera, controls, scene, renderer, effect;
    let sphere, plane;
    
    const start = Date.now();

    // size helpers (use the element, not window)
    const getSize = () => ({
        w: Math.max(1, rootEl.clientWidth),
        h: Math.max(1, rootEl.clientHeight),
    });
    
      // init
  {
    const { w, h } = getSize();

    // get colours from site
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const bg_col = styles.getPropertyValue('--bg').trim();
    const txt_col = styles.getPropertyValue('--hdr').trim();
    const getVar = name => styles.getPropertyValue(name).trim();

    camera = new THREE.PerspectiveCamera(70, w / h, 1, 1000);
    camera.position.set(0, 150, 500);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);

    const p1 = new THREE.PointLight(0xffffff, 3, 0, 0); p1.position.set(500, 500, 500); scene.add(p1);
    const p2 = new THREE.PointLight(0xffffff, 1, 0, 0); p2.position.set(-500, -500, -500); scene.add(p2);

    sphere = new THREE.Mesh(
      new THREE.SphereGeometry(200, 20, 10),
      new THREE.MeshPhongMaterial({ flatShading: true })
    );
    scene.add(sphere);

    plane = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ color: 0xe0e0e0 })
    );
    plane.position.y = -200;
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(w, h);

    effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
    effect.setSize(w, h);
    effect.domElement.style.color = txt_col; //'white';
    effect.domElement.style.backgroundColor = bg_col; //'black';
    function applyTheme() {
      // scene.background.set(getVar('--bg'));
      // sphere.material.color.set(getVar('--txt'));
      effect.domElement.style.color = txt_col; //'white';
      effect.domElement.style.backgroundColor = bg_col; //'black';
    }
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    // mount to the provided element, not document.body
    rootEl.appendChild(effect.domElement);

    controls = new TrackballControls(camera, effect.domElement);

    // animate
    const animate = () => {
      const t = Date.now() - start;
      sphere.position.y = Math.abs(Math.sin(t * 0.002)) * 150;
      sphere.rotation.x = t * 0.0003;
      sphere.rotation.z = t * 0.0002;

      controls.update();
      effect.render(scene, camera);

      reqId = requestAnimationFrame(animate);
    };
    let reqId = requestAnimationFrame(animate);

    // responsive sizing scoped to the element
    const ro = new ResizeObserver(() => {
      const { w, h } = getSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      effect.setSize(w, h);
    });
    ro.observe(rootEl);

    // optional cleanup api if you want to unmount later
    return {
      dispose() {
        cancelAnimationFrame(reqId);
        ro.disconnect();
        controls.dispose();
        effect.domElement.remove();
        renderer.dispose();
      }
    };
  }
}