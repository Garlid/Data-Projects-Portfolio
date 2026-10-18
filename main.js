(() => {
  const root = document.documentElement;
  const glow = document.getElementById('glow');
  const dot = document.getElementById('dot');
  const toggle = document.getElementById('motion-toggle');
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');

  let reduce = false;
  const isReduced = () => reduce || prefersReduced.matches;

  // Pointer position (raw) and glow position (lerped)
  let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
  // Smooth scroll: target and current positions
  let target = scrollY, cur = scrollY;

  const maxScroll = () => root.scrollHeight - innerHeight;

  // ---- Reduce motion toggle ----
  toggle.addEventListener('click', () => {
    reduce = !reduce;
    toggle.setAttribute('aria-pressed', String(reduce));
    toggle.textContent = reduce ? 'Motion: off' : 'Reduce motion';
    if (reduce) document.querySelectorAll('[data-tilt]').forEach(resetTilt);
  });

  // ---- Pointer ----
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });

  // ---- Smooth (lerped) scrolling ----
  addEventListener('wheel', (e) => {
    if (isReduced() || e.ctrlKey) return;
    e.preventDefault();
    target = Math.max(0, Math.min(maxScroll(), target + e.deltaY));
  }, { passive: false });

  // Keyboard, scrollbar and touch scrolling stay native; resync when they move the page
  addEventListener('scroll', () => {
    if (Math.abs(scrollY - cur) > 4) cur = target = scrollY;
  }, { passive: true });

  // ---- Nav: hide on scroll down, show on scroll up ----
  const nav = document.querySelector('.nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY, d = y - lastY;
    if (y < 120 || d < -6) nav.classList.remove('nav-hidden');
    else if (d > 6) nav.classList.add('nav-hidden');
    if (Math.abs(d) > 6) lastY = y;
  }, { passive: true });

  // ---- Anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const el = document.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), el.getBoundingClientRect().top + scrollY - (el.id === 'top' ? 0 : 20)));
      if (isReduced()) scrollTo(0, target);
    });
  });

  // ---- Scroll reveals ----
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    en.target.classList.add('is-visible');
  }), { threshold: .15 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  // ---- Card tilt + specular highlight ----
  function resetTilt(el) {
    el.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1),border-color .5s';
    el.style.transform = '';
    el.style.borderColor = 'rgba(255,255,255,.08)';
    el.querySelector('[data-spec]').style.opacity = 0;
  }
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const spec = el.querySelector('[data-spec]');
    el.addEventListener('mousemove', (e) => {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.transition = 'transform .12s ease-out';
      el.style.transform = `rotateX(${((.5 - y) * 14).toFixed(2)}deg) rotateY(${((x - .5) * 14).toFixed(2)}deg) translateZ(8px)`;
      spec.style.opacity = 1;
      spec.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%,rgba(220,245,238,.16),rgba(127,205,187,.05) 35%,transparent 60%)`;
      el.style.borderColor = 'rgba(127,205,187,.3)';
    });
    el.addEventListener('mouseleave', () => resetTilt(el));
  });

  // ---- Three.js particle universe ----
  let renderStars = null;
  function initStars() {
    if (!window.THREE) return;
    const canvas = document.getElementById('stars');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (err) {
      return; // No WebGL: the photo background still carries the page
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, 1, 2000);
    cam.position.z = 600;

    const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - .5) * 2400;
      pos[i * 3 + 1] = (Math.random() - .5) * 1600;
      pos[i * 3 + 2] = (Math.random() - .5) * 1600;
      const c = new THREE.Color().setHSL(.46 + Math.random() * .12, .35, .55 + Math.random() * .25);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));

    // Soft round sprite
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);

    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 5, map: new THREE.CanvasTexture(cv), vertexColors: true,
      transparent: true, opacity: .55, depthWrite: false, sizeAttenuation: true
    }));
    scene.add(pts);

    const resize = () => {
      renderer.setSize(innerWidth, innerHeight, false);
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
    };
    resize();
    addEventListener('resize', resize);

    let rx = 0, ry = 0;
    renderStars = () => {
      if (document.hidden) return;
      if (!isReduced()) {
        pts.rotation.y += .00006; pts.rotation.x += .00002;
        const tx = (my / innerHeight - .5) * .06, ty = (mx / innerWidth - .5) * .06;
        rx += (tx - rx) * .03; ry += (ty - ry) * .03;
        cam.rotation.x = -rx; cam.rotation.y = -ry;
        cam.position.y = -scrollY * .03;
      }
      renderer.render(scene, cam);
    };
  }
  initStars();

  // ---- Frame loop ----
  const loop = () => {
    requestAnimationFrame(loop);
    gx += (mx - gx) * .08; gy += (my - gy) * .08;
    glow.style.transform = `translate(${gx}px,${gy}px)`;
    dot.style.transform = `translate(${mx}px,${my}px)`;
    if (!isReduced()) {
      cur += (target - cur) * .08;
      if (Math.abs(target - cur) > .3) scrollTo(0, cur); else cur = target;
    } else {
      target = cur = scrollY;
    }
    if (renderStars) renderStars();
  };
  loop();
})();
