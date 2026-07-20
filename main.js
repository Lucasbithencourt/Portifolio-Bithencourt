/* =========================================================================
   PORTFÓLIO — Dark Sci-Fi (acento VERMELHO #e60000)
   Script ÚNICO e compartilhado entre páginas (index.html, case.html).
   Cada módulo é blindado: só inicializa se os elementos da página existirem.
   GSAP (ScrollTrigger) + Lenis + Canvas 2D · Vanilla
   ========================================================================= */

gsap.registerPlugin(ScrollTrigger);

/* -------------------------------------------------------------------------
   CONFIG GLOBAL
   ------------------------------------------------------------------------- */
const SEQUENCE = {
  path: "frames/", // rosto -> esqueleto vermelho
  ext: "webp",
  count: 221,
  pad: 4,
  buildSrc(i) {
    return `${this.path}${String(i).padStart(this.pad, "0")}.${this.ext}`;
  },
};

const INITIAL_BATCH = 20;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (prefersReducedMotion) {
  // Classe global: o CSS revela conteúdos estaticamente em qualquer página.
  document.documentElement.classList.add("reduced-motion");
}

/* -------------------------------------------------------------------------
   SMOOTH SCROLL (Lenis) — global, sincronizado com o ticker do GSAP.
   Roda em TODAS as páginas (case.html incluída).
   ------------------------------------------------------------------------- */
const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* =========================================================================
   MÓDULO: HERO CANVAS (scrubbing)
   Só roda na página que tiver #hero-canvas. Todo o estado vive aqui dentro —
   nada vaza para páginas sem a animação.
   ========================================================================= */
function initHero(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const images = [];          // HTMLImageElement[] (flag .__ready)
  const state = { frame: 0 }; // GSAP anima; onUpdate redesenha

  // Loader (pode não existir em outras páginas — todos os usos são guardados).
  const loaderEl = document.getElementById("loader");
  const loaderFill = document.getElementById("loader-fill");
  const loaderPercent = document.getElementById("loader-percent");

  /* ---- dimensionamento (devicePixelRatio p/ nitidez) ---- */
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- frame pronto mais próximo (sem tela vazia no preload) ---- */
  function nearestReadyIndex(index) {
    const t = images[index];
    if (t && t.__ready) return index;
    for (let d = 1; d < SEQUENCE.count; d++) {
      const lo = index - d;
      const hi = index + d;
      if (lo >= 0 && images[lo] && images[lo].__ready) return lo;
      if (hi < SEQUENCE.count && images[hi] && images[hi].__ready) return hi;
    }
    return -1;
  }

  /* ---- desenho com "object-fit: cover" matemático ---- */
  function drawFrame(index) {
    const idx = nearestReadyIndex(index);
    if (idx < 0) return;
    const img = images[idx];

    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const imgRatio = img.width / img.height;
    const canvasRatio = cw / ch;

    let renderW, renderH;
    if (canvasRatio > imgRatio) {
      renderW = cw;
      renderH = cw / imgRatio;
    } else {
      renderH = ch;
      renderW = ch * imgRatio;
    }
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    // Preto = neutro sob mix-blend-mode:screen (funde com o #000 do site).
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  }

  const redraw = () => drawFrame(Math.round(state.frame));

  /* ---- preload progressivo ---- */
  function loadOne(i, onDone) {
    return new Promise((resolve) => {
      const done = (img) => {
        img.__ready = true;
        if (onDone) onDone();
        resolve();
      };
      let img = images[i - 1];
      if (img && img.__ready) {
        if (onDone) onDone();
        resolve();
        return;
      }
      if (!img) {
        img = new Image();
        images[i - 1] = img;
      }
      if (img.complete && img.naturalWidth > 0) {
        done(img);
        return;
      }
      img.onload = () => {
        // onload garante desenhável; decode() é best-effort (nunca bloqueia).
        if (typeof img.decode === "function") img.decode().catch(() => {});
        done(img);
      };
      img.onerror = () => {
        console.warn("[preload] falhou:", img.src);
        if (onDone) onDone();
        resolve();
      };
      img.src = SEQUENCE.buildSrc(i);
    });
  }

  function preloadBatch(start, end, onProgress) {
    const first = Math.max(1, start);
    const last = Math.min(SEQUENCE.count, end);
    const total = Math.max(0, last - first + 1);
    if (total === 0) return Promise.resolve();
    let loaded = 0;
    const tasks = [];
    for (let i = first; i <= last; i++) {
      tasks.push(
        loadOne(i, () => {
          loaded++;
          if (onProgress) onProgress(loaded, total);
        })
      );
    }
    return Promise.all(tasks);
  }

  /* ---- loader UI (guardado) ---- */
  function updateLoader(loaded, total) {
    if (!loaderFill || !loaderPercent) return;
    const pct = Math.round((loaded / total) * 100);
    loaderFill.style.width = pct + "%";
    loaderPercent.textContent = pct + "%";
  }
  function hideLoader() {
    if (loaderEl) loaderEl.classList.add("is-hidden");
  }

  /* ---- scrub: scroll -> índice do frame ----
     O trigger é a .hero-track (500vh). "end: bottom bottom" faz o scrub
     completar EXATAMENTE quando o sticky do canvas destrava — daí em diante
     o canvas rola fisicamente para cima, empurrado pelo Manifesto.
     Nenhum fade artificial: a transição é o próprio scroll. */
  function initScrollAnimation() {
    gsap.to(state, {
      frame: SEQUENCE.count - 1,
      snap: "frame",
      ease: "none",
      scrollTrigger: {
        trigger: "#hero-track",
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
      onUpdate: redraw,
    });
  }

  /* ---- resize otimizado (ResizeObserver + rAF) ---- */
  function initResize() {
    let rafId = null;
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    let refreshTimer = null;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
    };
    const handle = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        sizeCanvas();
        redraw();
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w !== lastW || Math.abs(h - lastH) > 150) {
          scheduleRefresh(); // ignora o vai-e-vem da barra de URL no mobile
          lastW = w;
          lastH = h;
        }
        rafId = null;
      });
    };
    const ro = new ResizeObserver(handle);
    ro.observe(document.documentElement);
    window.addEventListener("resize", handle);
  }

  /* ---- bootstrap do hero ---- */
  (async () => {
    lenis.stop(); // trava o scroll até o lote inicial chegar
    sizeCanvas();
    initResize();

    // Acessibilidade: sem viagem — último frame estático, UI direto.
    if (prefersReducedMotion) {
      await preloadBatch(SEQUENCE.count, SEQUENCE.count, updateLoader);
      state.frame = SEQUENCE.count - 1;
      redraw();
      hideLoader();
      lenis.start();
      ScrollTrigger.refresh();
      return;
    }

    await preloadBatch(1, Math.min(INITIAL_BATCH, SEQUENCE.count), updateLoader);
    drawFrame(0);
    hideLoader();
    lenis.start();

    initScrollAnimation();
    ScrollTrigger.refresh();

    // Restante em background.
    preloadBatch(INITIAL_BATCH + 1, SEQUENCE.count).then(redraw);
  })();
}

/* =========================================================================
   MÓDULO: REVELAÇÃO DO PORTFÓLIO (Manifesto + A Máquina)
   Blindado: só cria triggers para as seções que existirem na página.
   ========================================================================= */
function initPortfolioReveal() {
  if (prefersReducedMotion) return; // CSS mostra tudo estático

  const manifestoItems = gsap.utils.toArray("#manifesto [data-reveal]");
  if (manifestoItems.length) {
    gsap.set(manifestoItems, { autoAlpha: 0, y: 50 });
    gsap.to(manifestoItems, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 1.1,
      stagger: 0.14,
      scrollTrigger: {
        trigger: "#manifesto",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
  }

  const rows = gsap.utils.toArray("#works-list [data-work]");
  if (rows.length) {
    gsap.set(rows, { autoAlpha: 0, y: 50 });
    gsap.to(rows, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 0.9,
      stagger: 0.08,
      scrollTrigger: {
        trigger: "#works",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
  }
}

/* =========================================================================
   BOOTSTRAP — blindado por página (cursor 100% nativo do sistema)
   ========================================================================= */
const heroCanvas = document.getElementById("hero-canvas");
if (heroCanvas) {
  initHero(heroCanvas);
} else {
  // Páginas sem a animação 3D (ex.: case.html): scroll liberado desde já.
  lenis.start();
}

initPortfolioReveal();
