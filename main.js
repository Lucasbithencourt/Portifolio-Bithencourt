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

  const trafegoItems = gsap.utils.toArray("#trafego [data-reveal]");
  if (trafegoItems.length) {
    gsap.set(trafegoItems, { autoAlpha: 0, y: 50 });
    gsap.to(trafegoItems, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 0.9,
      stagger: 0.08,
      scrollTrigger: {
        trigger: "#trafego",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
  }

  const aboutItems = gsap.utils.toArray("#about [data-reveal]");
  if (aboutItems.length) {
    gsap.set(aboutItems, { autoAlpha: 0, y: 50 });
    gsap.to(aboutItems, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 1.1,
      stagger: 0.14,
      scrollTrigger: {
        trigger: "#about",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
  }

  const contactItems = gsap.utils.toArray("#contact [data-reveal]");
  if (contactItems.length) {
    gsap.set(contactItems, { autoAlpha: 0, y: 50 });
    gsap.to(contactItems, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 1.1,
      stagger: 0.14,
      scrollTrigger: {
        trigger: "#contact",
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
  }
}

/* =========================================================================
   MÓDULO: PREVIEW FLUTUANTE DA LISTA (segue o cursor)
   Blindado: só roda se #works-list e #work-preview existirem. Desativa em
   touch/movimento reduzido (onde não há cursor pra seguir).
   ========================================================================= */
function initWorkPreview() {
  const list = document.getElementById("works-list");
  const preview = document.getElementById("work-preview");
  const previewImg = document.getElementById("work-preview-img");
  if (!list || !preview || !previewImg) return;

  // Wrapper do conteúdo (recebe o crossfade) + campos do estado de texto.
  const content = document.getElementById("work-preview-content");
  const previewCat = document.getElementById("work-preview-cat");
  const previewName = document.getElementById("work-preview-name");
  const previewYear = document.getElementById("work-preview-year");

  // Sem cursor: nada de preview flutuante.
  if (prefersReducedMotion || window.matchMedia("(hover: none)").matches) return;

  const rows = gsap.utils.toArray("#works-list [data-work]");
  if (!rows.length) return;

  // Card centrado no cursor (o translate do quickTo parte daqui).
  gsap.set(preview, { xPercent: -50, yPercent: -50 });

  // quickTo: setter otimizado, com leve inércia (o lerp vem do duration/ease).
  const xTo = gsap.quickTo(preview, "x", { duration: 0.45, ease: "power3" });
  const yTo = gsap.quickTo(preview, "y", { duration: 0.45, ease: "power3" });

  // O mousemove só é escutado enquanto o cursor está sobre a lista.
  const onMove = (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
  };

  list.addEventListener("mouseenter", (e) => {
    // Fixa a posição no 1º contato pra o card não "voar" do canto (0,0).
    gsap.set(preview, { x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
  });

  // Linha atualmente projetada; reseta ao sair da lista.
  let currentRow = null;

  // Projeta o conteúdo da linha no card: imagem (se houver data-preview real)
  // OU texto lido da própria linha (.work__cat / .work__name / .work__year).
  // A lógica de imagem continua intacta — é só deixar de ser o único estado.
  function renderPreview(row) {
    const src = row.getAttribute("data-preview");
    if (src) {
      previewImg.src = src;
      preview.classList.add("is-image");
      preview.classList.remove("is-text");
    } else {
      const txt = (sel) => {
        const el = row.querySelector(sel);
        return el ? el.textContent.trim() : "";
      };
      previewCat.textContent = txt(".work__cat");
      previewName.textContent = txt(".work__name");
      previewYear.textContent = txt(".work__year");
      preview.classList.add("is-text");
      preview.classList.remove("is-image");
    }
  }

  list.addEventListener("mouseleave", () => {
    window.removeEventListener("mousemove", onMove);
    gsap.to(preview, { autoAlpha: 0, duration: 0.3, ease: "power2.out" });
    currentRow = null; // próxima entrada renderiza limpo (sem crossfade oculto)
  });

  // Cada linha revela o card e troca o conteúdo (imagem OU texto) com crossfade.
  rows.forEach((row) => {
    row.addEventListener("mouseenter", () => {
      if (row !== currentRow) {
        if (currentRow === null) {
          renderPreview(row); // 1º conteúdo da leva entra sem crossfade
        } else {
          gsap.killTweensOf(content);
          gsap.to(content, {
            opacity: 0,
            duration: 0.12,
            onComplete: () => {
              renderPreview(row);
              gsap.to(content, { opacity: 1, duration: 0.2 });
            },
          });
        }
        currentRow = row;
      }
      gsap.to(preview, { autoAlpha: 1, duration: 0.3, ease: "power2.out" });
    });
  });
}

/* =========================================================================
   MÓDULO: HERO DE ÍCONES FLUTUANTES
   Blindado: só roda se .hero__icon existir. Entrada em fade+scale (stagger)
   e repulsão suave dos ícones ao cursor (gsap.quickTo). Sob reduced-motion,
   fica tudo parado na posição final (sem repulsão).
   ========================================================================= */
function initHeroIcons() {
  const hero = document.getElementById("hero");
  if (!hero) return;
  const icons = gsap.utils.toArray(".hero__icon");
  if (!icons.length) return;
  const content = gsap.utils.toArray(".hero__content > *");

  // "Ver Cases" — scroll suave até a seção via Lenis (evita salto nativo).
  const seeCases = hero.querySelector(".hero__cta-secondary");
  if (seeCases) {
    seeCases.addEventListener("click", (e) => {
      const target = document.querySelector(seeCases.getAttribute("href"));
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.2 });
      }
    });
  }

  // Acessibilidade: sem movimento — tudo visível na posição final.
  if (prefersReducedMotion) {
    gsap.set([...content, ...icons], { autoAlpha: 1, scale: 1, x: 0, y: 0 });
    return;
  }

  // Entrada: fade + scale-in escalonado (é a primeira coisa vista).
  gsap.set([...content, ...icons], { autoAlpha: 0, scale: 0.9 });
  gsap.to(content, {
    autoAlpha: 1,
    scale: 1,
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.1,
  });
  gsap.to(icons, {
    autoAlpha: 1,
    scale: 1,
    duration: 0.9,
    ease: "power3.out",
    stagger: 0.06,
    delay: 0.15,
  });

  // Repulsão do cursor: quickTo por ícone (x/y), com leve inércia.
  const RADIUS = 120; // raio de influência do cursor (px)
  const MAX_PUSH = 45; // deslocamento máximo (px)
  const setters = icons.map((el) => ({
    el,
    xTo: gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" }),
    yTo: gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" }),
  }));

  window.addEventListener(
    "mousemove",
    (e) => {
      setters.forEach(({ el, xTo, yTo }) => {
        // Centro BASE do ícone = centro atual menos o offset já aplicado.
        const tx = gsap.getProperty(el, "x");
        const ty = gsap.getProperty(el, "y");
        const r = el.getBoundingClientRect();
        const baseCx = r.left + r.width / 2 - tx;
        const baseCy = r.top + r.height / 2 - ty;
        const dx = baseCx - e.clientX;
        const dy = baseCy - e.clientY;
        const dist = Math.hypot(dx, dy);
        if (dist < RADIUS && dist > 0.001) {
          const force = 1 - dist / RADIUS; // mais perto = mais forte
          const push = force * MAX_PUSH;
          xTo((dx / dist) * push);
          yTo((dy / dist) * push);
        } else {
          xTo(0);
          yTo(0);
        }
      });
    },
    { passive: true }
  );
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
initWorkPreview();
initHeroIcons();
