/* =========================================================================
   PORTFÓLIO — Dark Sci-Fi (acento VERDE ESCURO #1f7a4e)
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

  const provasItems = gsap.utils.toArray("#provas [data-reveal]");
  if (provasItems.length) {
    gsap.set(provasItems, { autoAlpha: 0, y: 50 });
    gsap.to(provasItems, {
      autoAlpha: 1,
      y: 0,
      ease: "power3.out",
      duration: 0.9,
      stagger: 0.08,
      scrollTrigger: {
        trigger: "#provas",
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

  // Repulsão do cursor + flutuação idle UNIFICADAS: uma única fonte de
  // verdade por ícone. O ticker aplica, a cada frame, a soma (idle senoidal
  // + push do cursor) NO MESMO .hero__icon — quadrado e ícone se movem como
  // um bloco só, sem drift relativo entre eles.
  const RADIUS = 120; // raio de influência do cursor (px)
  const MAX_PUSH = 45; // deslocamento máximo (px)
  const setters = icons.map((el) => ({
    xTo: gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" }),
    yTo: gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" }),
  }));

  // Parâmetros de flutuação idle, sorteados uma vez por ícone (amplitude,
  // velocidade e fase inicial aleatórias pra não sincronizarem — orgânico).
  const floatState = icons.map(() => ({
    ampX: gsap.utils.random(3, 6),
    ampY: gsap.utils.random(4, 8),
    speedX: gsap.utils.random(0.4, 0.7),
    speedY: gsap.utils.random(0.3, 0.6),
    phaseX: gsap.utils.random(0, Math.PI * 2),
    phaseY: gsap.utils.random(0, Math.PI * 2),
  }));

  // Offset de repulsão por ícone — atualizado SÓ pelo mousemove abaixo.
  const pushX = icons.map(() => 0);
  const pushY = icons.map(() => 0);

  // Ticker: idle (onda senoidal) + push, aplicado no próprio .hero__icon.
  gsap.ticker.add((time) => {
    icons.forEach((el, i) => {
      const f = floatState[i];
      const idleX = Math.sin(time * f.speedX + f.phaseX) * f.ampX;
      const idleY = Math.sin(time * f.speedY + f.phaseY) * f.ampY;
      setters[i].xTo(idleX + pushX[i]);
      setters[i].yTo(idleY + pushY[i]);
    });
  });

  // Repulsão: o mousemove só ATUALIZA pushX/pushY (não chama xTo/yTo direto).
  window.addEventListener(
    "mousemove",
    (e) => {
      icons.forEach((el, i) => {
        // Centro BASE do ícone = centro atual menos o transform já aplicado.
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
          pushX[i] = (dx / dist) * push;
          pushY[i] = (dy / dist) * push;
        } else {
          pushX[i] = 0;
          pushY[i] = 0;
        }
      });
    },
    { passive: true }
  );
}

/* =========================================================================
   NAVBAR FIXA — revela ao rolar (blindado: só roda se #site-nav existir).
   Com #hero: aparece quando o hero sai da viewport (bottom top).
   Sem #hero (cases): aparece quase de imediato (bem no começo do scroll).
   ========================================================================= */
function initSiteNav() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const hero = document.getElementById("hero");

  if (hero) {
    // Home: escondida sobre o hero, revela quando o hero termina.
    ScrollTrigger.create({
      trigger: "#hero",
      start: "bottom top",
      onEnter: () => nav.classList.add("site-nav--visible"),
      onLeaveBack: () => nav.classList.remove("site-nav--visible"),
    });
  } else {
    // Cases (sem hero): revela logo no primeiro trecho de rolagem, e já
    // deixa visível se a página abriu com algum scroll (ex.: âncora).
    const show = () => nav.classList.add("site-nav--visible");
    if (window.scrollY > 10) show();
    ScrollTrigger.create({
      start: "top -40",
      onEnter: show,
      onLeaveBack: () => nav.classList.remove("site-nav--visible"),
    });
  }
}

/* =========================================================================
   FUNDO DE ESTRELAS — canvas fixo atrás de tudo (blindado: só roda se
   #stars-bg existir). Campo de pontos com twinkle sutil (seno no tempo) +
   estrela cadente ocasional. Sob reduced-motion: só pontos estáticos.
   ========================================================================= */
function initStarsBackground() {
  const canvas = document.getElementById("stars-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];

  function buildStars() {
    // ~80–120 pontos, proporcional à área da viewport.
    const count = Math.round(gsap.utils.clamp(80, 120, (width * height) / 18000));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1 + 0.5, // 0.5–1.5px
        baseAlpha: Math.random() * 0.5 + 0.3, // 0.3–0.8
        twSpeed: Math.random() * 1.5 + 0.5,
        twPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  // Estrela cadente (só sem reduced-motion).
  let shooting = null;
  let nextShoot = 0;

  function spawnShooting(now) {
    const angle = Math.PI * (0.15 + Math.random() * 0.1); // diagonal p/ baixo-dir.
    shooting = {
      x: Math.random() * width * 0.8, // ponto inicial aleatório
      y: Math.random() * height * 0.4,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      len: Math.random() * 120 + 120, // comprimento do traço (120–240px)
      start: now,
      dur: 800 + Math.random() * 400, // 0.8–1.2s
      travel: Math.max(width, height) * 0.9,
    };
    nextShoot = now + 8000 + Math.random() * 7000; // próxima em 8–15s
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, height);

    // Campo de pontos (com twinkle, salvo reduced-motion).
    ctx.fillStyle = "#ffffff";
    for (const s of stars) {
      let alpha = s.baseAlpha;
      if (!prefersReducedMotion) {
        alpha = s.baseAlpha * (0.55 + 0.45 * Math.sin(now * 0.001 * s.twSpeed + s.twPhase));
      }
      ctx.globalAlpha = alpha < 0 ? 0 : alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Estrela cadente.
    if (!prefersReducedMotion) {
      if (!shooting && now >= nextShoot) spawnShooting(now);
      if (shooting) {
        const t = (now - shooting.start) / shooting.dur;
        if (t >= 1) {
          shooting = null;
        } else {
          const dist = t * shooting.travel;
          const hx = shooting.x + shooting.dx * dist; // "cabeça" do traço
          const hy = shooting.y + shooting.dy * dist;
          const tx = hx - shooting.dx * shooting.len; // "cauda"
          const ty = hy - shooting.dy * shooting.len;
          const fade = Math.sin(Math.PI * t); // fade in/out suave
          const grad = ctx.createLinearGradient(tx, ty, hx, hy);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(1, "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
      }
    }
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (prefersReducedMotion) {
    draw(0); // desenha os pontos estáticos uma vez e para.
    return;
  }

  nextShoot = performance.now() + 3000 + Math.random() * 4000; // 1ª logo no início
  gsap.ticker.add(() => draw(performance.now()));
}

/* =========================================================================
   RASTRO BINÁRIO — 0s e 1s discretos seguindo o cursor dentro do #hero.
   Blindado: só roda com #hero, e nunca sob reduced-motion ou em telas sem
   hover (touch — sem cursor, sem efeito). Throttle no mousemove + limite de
   dígitos simultâneos pra não pesar.
   ========================================================================= */
function initBinaryTrail() {
  const hero = document.getElementById("hero");
  if (!hero) return;
  if (prefersReducedMotion) return;
  if (window.matchMedia("(hover: none)").matches) return;

  // Camada sobre o hero (abaixo do conteúdo central — ver .hero__binary).
  const layer = document.createElement("div");
  layer.className = "hero__binary";
  layer.setAttribute("aria-hidden", "true");
  hero.appendChild(layer);

  const MAX = 18; // máximo de dígitos simultâneos
  const THROTTLE = 120; // ms entre dígitos (não a cada pixel)
  let last = 0;
  const digits = [];

  function drop(span) {
    const i = digits.indexOf(span);
    if (i !== -1) digits.splice(i, 1);
    gsap.killTweensOf(span);
    span.remove();
  }

  hero.addEventListener(
    "mousemove",
    (e) => {
      const now = performance.now();
      if (now - last < THROTTLE) return;
      last = now;

      const rect = hero.getBoundingClientRect();
      const span = document.createElement("span");
      span.textContent = Math.random() < 0.5 ? "0" : "1";
      span.style.left = e.clientX - rect.left + gsap.utils.random(-12, 12) + "px";
      span.style.top = e.clientY - rect.top + gsap.utils.random(-12, 12) + "px";
      layer.appendChild(span);
      digits.push(span);

      // Estoura o limite? Remove o mais antigo.
      if (digits.length > MAX) drop(digits[0]);

      // Fade in rápido → deriva pra baixo com fade out → remove do DOM.
      gsap
        .timeline({ onComplete: () => drop(span) })
        .fromTo(
          span,
          { opacity: 0, y: 0 },
          { opacity: 0.35, duration: 0.2, ease: "power1.out" }
        )
        .to(span, {
          opacity: 0,
          y: gsap.utils.random(10, 20),
          duration: gsap.utils.random(1, 1.5),
          ease: "power1.in",
        });
    },
    { passive: true }
  );
}

/* =========================================================================
   CARROSSEL DE CASES — efeito coverflow (slide central maior/em foco, os
   laterais menores e recuados). Blindado: só roda se .cases-swiper existir
   e a lib Swiper tiver carregado. Swipe/drag, setas, teclado, paginação e
   a11y vêm do próprio Swiper.
   ========================================================================= */
function initCasesSwiper() {
  const el = document.querySelector(".cases-swiper");
  if (!el) return;
  if (typeof Swiper === "undefined") return;

  new Swiper(".cases-swiper", {
    effect: "coverflow",
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: "auto",
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 150,
      modifier: 1.5,
      slideShadows: false,
    },
    pagination: { el: ".cases-swiper .swiper-pagination", clickable: true },
    navigation: {
      nextEl: ".cases-swiper .swiper-button-next",
      prevEl: ".cases-swiper .swiper-button-prev",
    },
    keyboard: { enabled: true },
    a11y: { enabled: true },
  });
}

/* =========================================================================
   MODAL DE CASE — abre por cima da página ao clicar num slide do carrossel
   (sem navegar). Blindado: só roda se #case-modal e os slides existirem.
   Conteúdo espelha o das páginas case-XX.html, que seguem existindo.
   ========================================================================= */
const CASES = {
  1: {
    eyebrow: "CASE 01",
    title: "UP! Especialidades Pediátricas",
    meta: {
      Cliente: "UP! Especialidades Pediátricas",
      Papel: "Design & Desenvolvimento + Tráfego Pago",
      Ano: "2025",
      Stack: "HTML · CSS · JavaScript",
    },
    text:
      "A clínica já tinha uma identidade física lúdica — personagens de " +
      "bichinhos pintados nas paredes do consultório. O desafio foi estender " +
      "essa mesma imersão pro digital: desenvolvi o site do zero, design e " +
      "código, reaproveitando os próprios personagens da clínica (leão, " +
      "elefante, macaco, zebra, galinha) na experiência online, pra que pais " +
      "e crianças reconhecessem o site como extensão natural do espaço " +
      "físico. Hoje também acompanho o tráfego pago do cliente.",
    live: "https://uppediatria.com.br",
    media: "media/up-hero.jpg",
    alt: "Captura de tela do site UP! Especialidades Pediátricas",
  },
  2: {
    eyebrow: "CASE 02",
    title: "Rizzatti Dermatologia e Saúde",
    meta: {
      Cliente: "Rizzatti Dermatologia e Saúde",
      Papel: "Design & Desenvolvimento + Tráfego Pago",
      Ano: "2025",
      Stack: "HTML · CSS · JavaScript",
    },
    text:
      "Site construído do zero — design e código — pra apresentar as cinco " +
      "frentes de atendimento da clínica (dermatologia clínica, cirúrgica, " +
      "estética facial, estética corporal e tricologia) e os dois " +
      "especialistas responsáveis, com foco em conversão direta via WhatsApp. " +
      "Acompanho o tráfego pago do cliente.",
    live: "https://clinicarizzatti.com.br",
    media: "media/rizzatti-hero.jpg",
    alt: "Captura de tela do site Rizzatti Dermatologia e Saúde",
  },
  3: {
    eyebrow: "CASE 03",
    title: "SULCARDIO Clínica Cardiológica",
    meta: {
      Cliente: "SULCARDIO Clínica Cardiológica",
      Papel: "Design & Desenvolvimento + Tráfego Pago",
      Ano: "2025",
      Stack: "HTML · CSS · JavaScript",
    },
    text:
      "Site institucional construído do zero pra uma clínica de cardiologia " +
      "consolidada desde 2010. O objetivo era comunicar autoridade através de " +
      "números reais — mais de 10 mil pacientes atendidos, 15 anos de " +
      "experiência, 50 mil exames realizados — e facilitar o agendamento de " +
      "consultas e exames. Acompanho o tráfego pago do cliente.",
    live: "https://sulcardio.com.br",
    media: "media/sulcardio-hero.jpg",
    alt: "Captura de tela do site SULCARDIO Clínica Cardiológica",
  },
  4: {
    eyebrow: "CASE 04",
    title: "Ostermann Medical Center",
    meta: {
      Cliente: "Ostermann Medical Center",
      Papel: "Personalização & Desenvolvimento",
      Ano: "2025",
      Stack: "HTML · CSS · JavaScript",
    },
    text:
      "Projeto diferente dos outros três: o cliente chegou com o site já bem " +
      "desenvolvido e participou ativamente de cada etapa, dando direção e " +
      "feedback constante. Em vez de criação do zero, o trabalho aqui foi de " +
      "personalização e refinamento — mantendo a comunicação clara da " +
      "proposta da clínica (investigação da causa raiz dos sintomas) e a " +
      "jornada de agendamento por unidade (Criciúma, Araranguá e Garopaba).",
    live: "https://ostermannmedicalcenter.com.br",
    media: "media/ostermann-hero.jpg",
    alt: "Captura de tela do site Ostermann Medical Center",
  },
};

function initCaseModal() {
  const modal = document.getElementById("case-modal");
  if (!modal) return;
  const slides = gsap.utils.toArray(".case-slide");
  if (!slides.length) return;

  const panel = modal.querySelector(".case-modal__panel");
  const media = modal.querySelector(".case-modal__media");
  const eyebrow = modal.querySelector(".case-modal__eyebrow");
  const title = modal.querySelector(".case-modal__title");
  const metaEl = modal.querySelector(".case-modal__meta");
  const text = modal.querySelector(".case-modal__text");
  const live = modal.querySelector(".case-modal__live");
  const closeBtn = modal.querySelector(".case-modal__close");

  let isOpen = false;
  let closing = false;
  let closeTimer = null;
  let lastTrigger = null;
  let shotImg = null; // screenshot atual (estado inicial da mídia)
  let liveFrame = null; // iframe do site ao vivo, quando o embed passa
  let liveTimer = null;

  // Derruba qualquer tentativa de embed em andamento e limpa o iframe —
  // evita iframes acumulando ao trocar de case ou fechar o modal.
  function destroyLive() {
    if (liveTimer) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
    if (liveFrame) {
      liveFrame.remove();
      liveFrame = null;
    }
    const badge = media.querySelector(".case-modal__live-badge");
    if (badge) badge.remove();
  }

  /* Tenta embutir o site real. O screenshot já está na tela; o iframe entra
     invisível e só substitui se o embed funcionar. Muitos hosts mandam
     X-Frame-Options / CSP frame-ancestors e o browser recusa renderizar
     SEM disparar "error" — por isso o timeout é a rede de segurança, e a
     checagem pós-load distingue conteúdo real de frame recusado. */
  function tryLive(data) {
    const frame = document.createElement("iframe");
    frame.className = "case-modal__frame";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms" // nunca allow-top-navigation
    );
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("title", "Site ao vivo — " + data.title);
    frame.style.opacity = "0";
    liveFrame = frame;

    let settled = false;

    function fail() {
      if (settled) return;
      settled = true;
      destroyLive(); // fica só o screenshot estático
    }

    function succeed() {
      if (settled) return;
      settled = true;
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
      const badge = document.createElement("span");
      badge.className = "case-modal__live-badge";
      badge.textContent = "🔴 ao vivo — role e explore";
      media.appendChild(badge);

      // O iframe entra por cima do screenshot (que continua por baixo como
      // rede de segurança — ver .case-modal__frame no CSS).
      if (prefersReducedMotion) {
        frame.style.opacity = "1";
      } else {
        gsap.to(frame, { opacity: 1, duration: 0.4, ease: "power2.out" });
      }
    }

    frame.addEventListener("error", fail);
    frame.addEventListener("load", () => {
      // Frame recusado (XFO/CSP) fica em about:blank — same-origin, então a
      // leitura passa. Conteúdo cross-origin de verdade lança SecurityError.
      let embedded;
      try {
        const href = frame.contentWindow.location.href;
        embedded = href !== "about:blank" && href !== "";
      } catch (e) {
        embedded = true;
      }
      if (embedded) succeed();
      else fail();
    });

    liveTimer = setTimeout(fail, 2500);
    frame.src = data.live;
    media.appendChild(frame);
  }

  function fill(data) {
    destroyLive();
    // Estado inicial da mídia: sempre o screenshot estático.
    media.textContent = "";
    const img = document.createElement("img");
    img.src = data.media;
    img.alt = data.alt;
    media.appendChild(img);
    shotImg = img;

    eyebrow.textContent = data.eyebrow;
    title.textContent = data.title;
    text.textContent = data.text;
    live.href = data.live;

    // Meta: mesma estrutura dt/dd das páginas de case.
    metaEl.textContent = "";
    Object.keys(data.meta).forEach((k) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = data.meta[k];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      metaEl.appendChild(wrap);
    });
  }

  function open(data, trigger) {
    // Fechamento pendente (animação ainda rodando)? Encerra na hora, pra não
    // desmontar por cima do modal que está sendo aberto agora.
    if (closing) finishClose();
    if (isOpen) return;
    gsap.killTweensOf([modal, panel]);
    fill(data);
    lastTrigger = trigger || null;
    isOpen = true;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lenis.stop(); // trava o scroll suave da página por baixo

    if (prefersReducedMotion) {
      gsap.set(modal, { opacity: 1 });
      gsap.set(panel, { opacity: 1, scale: 1, y: 0 });
    } else {
      gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.96, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: "power3.out" }
      );
    }

    panel.scrollTop = 0;
    closeBtn.focus();

    // Só agora (modal já visível) tenta o embed — iframe lazy dentro de
    // container escondido não chega a carregar.
    tryLive(data);
  }

  function finishClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    if (!closing) return; // já encerrado
    closing = false;
    isOpen = false;
    gsap.killTweensOf([modal, panel]);
    destroyLive();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    gsap.set(modal, { clearProps: "opacity" });
    gsap.set(panel, { clearProps: "opacity,transform" });
    document.body.style.overflow = "";
    lenis.start();
    if (lastTrigger) lastTrigger.focus(); // devolve o foco ao slide
    lastTrigger = null;
  }

  function close() {
    if (!isOpen || closing) return;
    closing = true;
    if (prefersReducedMotion) {
      finishClose();
      return;
    }
    gsap.to(panel, { opacity: 0, scale: 0.97, y: 8, duration: 0.2, ease: "power2.in" });
    gsap.to(modal, { opacity: 0, duration: 0.25, ease: "power2.in", onComplete: finishClose });
    // Rede de segurança: em aba de segundo plano o rAF é estrangulado e o
    // onComplete pode não disparar — sem isso o modal ficaria preso aberto
    // com o scroll da página travado.
    closeTimer = setTimeout(finishClose, 600);
  }

  // Slides viram botões acessíveis (clique + Enter/Espaço + foco).
  slides.forEach((slide) => {
    const data = CASES[slide.dataset.case];
    if (!data) return;
    slide.setAttribute("role", "button");
    slide.setAttribute("tabindex", "0");
    slide.setAttribute("aria-label", "Ver detalhes do case " + data.title);
    slide.addEventListener("click", () => open(data, slide));
    slide.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(data, slide);
      }
    });
  });

  // Fechar: botão ×, backdrop e ESC.
  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    // Focus trap simples: Tab circula só dentro do painel.
    if (e.key !== "Tab") return;
    const focusables = panel.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/* =========================================================================
   TÍTULO DO HERO — typewriter: apaga a palavra letra por letra e digita a
   próxima, com cursor piscando. Blindado: só roda se .hero__title-rotate
   existir. Fixa min-width com a maior palavra (+ cursor) pra frase não
   pular enquanto o texto cresce/encolhe, pausa com a aba oculta e, sob
   reduced-motion, mostra só a primeira palavra estática.
   ========================================================================= */
function initHeroTitleRotate() {
  const el = document.querySelector(".hero__title-rotate");
  if (!el) return;

  // O ponto final acompanha a palavra: como o min-width reserva a largura da
  // MAIOR palavra, um "." solto fora do span ficaria descolado nas curtas.
  const words = (el.dataset.words || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w + ".");
  if (words.length < 2) return;

  // Texto e cursor viram elementos próprios: só o texto muda a cada tick.
  el.textContent = "";
  const wordEl = document.createElement("span");
  wordEl.className = "hero__title-word";
  const cursorEl = document.createElement("span");
  cursorEl.className = "hero__title-cursor";
  cursorEl.setAttribute("aria-hidden", "true");
  cursorEl.textContent = "|";
  el.appendChild(wordEl);
  el.appendChild(cursorEl);
  wordEl.textContent = words[0];

  /* Reserva a largura da maior palavra JÁ COM o cursor: mede o próprio
     elemento (em vez de um probe) porque assim entram fonte real, cursor e
     espaçamentos. Usa offsetWidth (não getBoundingClientRect): a entrada do
     hero anima o conteúdo em scale < 1, e o rect viria escalado/curto — o
     offsetWidth ignora transforms e dá a largura de layout real. */
  function applyMinWidth() {
    const prev = wordEl.textContent;
    el.style.minWidth = "0px";
    let max = 0;
    words.forEach((w) => {
      wordEl.textContent = w;
      max = Math.max(max, el.offsetWidth);
    });
    wordEl.textContent = prev;
    el.style.minWidth = Math.ceil(max) + "px";
  }

  applyMinWidth();

  // A entrada do hero anima o conteúdo em scale (~0,9s) e, durante isso, a
  // medida do título sai encolhida. Re-mede após um ciclo de layout, quando
  // as fontes ficam prontas e depois que a entrada termina — travando a
  // largura no valor final sem depender do momento exato.
  requestAnimationFrame(() => requestAnimationFrame(applyMinWidth));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(applyMinWidth);
  }
  setTimeout(applyMinWidth, 1200); // após a animação de entrada do hero

  // O título usa clamp() (fonte fluida), então a largura da maior palavra
  // muda com o viewport. ResizeObserver no <h1> é mais confiável que o
  // evento "resize" da window (que nem sempre dispara em todo contexto).
  let resizeTimer = null;
  const remeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyMinWidth, 150);
  };
  window.addEventListener("resize", remeasure, { passive: true });
  const titleEl = el.closest(".hero__title");
  if (titleEl && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(remeasure).observe(titleEl);
  }

  // Acessibilidade: sem movimento — primeira palavra estática, sem digitar.
  if (prefersReducedMotion) {
    wordEl.textContent = words[0];
    cursorEl.remove();
    return;
  }

  const TYPE = 80; // ms por caractere ao digitar (±10)
  const ERASE = 52; // ms por caractere ao apagar (±7)
  const PAUSE_EMPTY = 200; // campo vazio, antes de digitar a próxima
  const PAUSE_FULL = 2000; // palavra completa parada (±200)

  // Variação por caractere pra não soar robótico.
  const jitter = (base, spread) => base + (Math.random() * 2 - 1) * spread;

  let idx = 0;
  let shown = words[0]; // trecho atualmente visível
  let erasing = true; // começa apagando a palavra inicial
  let timer = null;
  let paused = false;

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(step, ms);
  }

  function step() {
    if (document.hidden) {
      paused = true; // retomado no visibilitychange
      return;
    }
    const full = words[idx];

    if (erasing) {
      if (shown.length > 0) {
        shown = full.slice(0, shown.length - 1);
        wordEl.textContent = shown;
        schedule(jitter(ERASE, 7));
        return;
      }
      // Vazio: cursor piscando um instante e vai pra próxima palavra.
      erasing = false;
      idx = (idx + 1) % words.length;
      schedule(PAUSE_EMPTY);
      return;
    }

    if (shown.length < full.length) {
      shown = full.slice(0, shown.length + 1);
      wordEl.textContent = shown;
      schedule(jitter(TYPE, 10));
      return;
    }
    // Palavra completa: pausa longa antes de apagar de novo.
    erasing = true;
    schedule(jitter(PAUSE_FULL, 200));
  }

  // Aba oculta: para o ciclo; ao voltar, retoma de onde parou. O estado é
  // só texto (sem tween pela metade), então não precisa normalizar nada.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      paused = true;
      return;
    }
    if (paused) {
      paused = false;
      schedule(400);
    }
  });

  schedule(jitter(PAUSE_FULL, 200));
}

/* =========================================================================
   TRÁFEGO PAGO — faixa de 3 contadores. Blindado: só roda se .trafego__stats
   existir. Contagem 0→valor ao entrar na tela; "Campanhas ativas" segue
   variando ao vivo (40–50) num loop. Sob reduced-motion: valores finais
   direto e sem loop.
   ========================================================================= */
function initTrafegoStats() {
  const stats = document.querySelector(".trafego__stats");
  if (!stats) return;

  const values = gsap.utils.toArray(".trafego__stat-value", stats);
  const format = (el, n) =>
    (el.dataset.prefix || "") + Math.round(n) + (el.dataset.suffix || "");

  // Escreve todos no valor final (usado sob reduced-motion).
  function fillFinal() {
    values.forEach((el) => {
      el.textContent = format(el, Number(el.dataset.countTo) || 0);
    });
  }

  const live = document.getElementById("stat-campanhas");
  const LIVE_MIN = 40;
  const LIVE_MAX = 50;
  let liveTimer = null;
  let livePaused = false;

  // Loop "ao vivo" das campanhas ativas: delta -3..+3 (sem 0), preso a 40–50.
  function scheduleLive() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(tickLive, gsap.utils.random(4000, 9000));
  }

  function tickLive() {
    if (document.hidden) {
      livePaused = true; // retomado no visibilitychange
      return;
    }
    const cur = parseInt(live.textContent, 10) || LIVE_MIN;
    let delta = Math.round(gsap.utils.random(-3, 3));
    if (delta === 0) delta = Math.random() < 0.5 ? -1 : 1;
    let next = cur + delta;
    if (next < LIVE_MIN || next > LIVE_MAX) next = cur - delta; // inverte se estourar
    next = Math.max(LIVE_MIN, Math.min(LIVE_MAX, next));

    // "Pisca e troca": fade/scale rápido no próprio número.
    gsap.to(live, {
      opacity: 0.2,
      scale: 0.9,
      duration: 0.15,
      ease: "power1.in",
      onComplete: () => {
        live.textContent = next;
        gsap.to(live, { opacity: 1, scale: 1, duration: 0.15, ease: "power1.out" });
      },
    });
    scheduleLive();
  }

  // Acessibilidade: sem contagem nem loop — números fixos no valor final.
  if (prefersReducedMotion) {
    fillFinal();
    return;
  }

  // Contagem de entrada (uma vez), disparada quando a faixa aparece.
  ScrollTrigger.create({
    trigger: stats,
    start: "top 85%",
    once: true,
    onEnter: () => {
      values.forEach((el) => {
        const target = Number(el.dataset.countTo) || 0;
        const proxy = { val: 0 };
        gsap.to(proxy, {
          val: target,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = format(el, proxy.val);
          },
          onComplete: () => {
            el.textContent = format(el, target);
            // Terminou a contagem inicial das campanhas? Começa o "ao vivo".
            if (el === live) scheduleLive();
          },
        });
      });
    },
  });

  // Aba oculta pausa o loop; ao voltar, retoma de onde parou.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(liveTimer);
      livePaused = true;
      return;
    }
    if (livePaused) {
      livePaused = false;
      scheduleLive();
    }
  });
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

/* =========================================================================
   CARROSSEL DE PROVAS — um print do gerenciador por slide. Seletores
   escopados em .provas-swiper pra não brigar com o carrossel de cases.
   Blindado: só roda se a seção e a lib Swiper existirem.
   ========================================================================= */
function initProvasSwiper() {
  const el = document.querySelector(".provas-swiper");
  if (!el) return;
  if (typeof Swiper === "undefined") return;

  new Swiper(".provas-swiper", {
    slidesPerView: 1,
    spaceBetween: 24,
    autoHeight: true, // cada prova tem um texto de tamanho diferente
    grabCursor: true,
    pagination: { el: ".provas-swiper .swiper-pagination", clickable: true },
    navigation: {
      nextEl: ".provas-swiper .swiper-button-next",
      prevEl: ".provas-swiper .swiper-button-prev",
    },
    keyboard: { enabled: true },
    a11y: { enabled: true },
  });
}

/* =========================================================================
   LIGHTBOX DAS PROVAS — o print é largo demais pra ser lido dentro do card,
   então clicar abre ele em tamanho cheio. Fecha no Esc, no X ou clicando no
   fundo. Devolve o foco pro botão de origem ao fechar.
   ========================================================================= */
function initProvaLightbox() {
  const box = document.getElementById("prova-lightbox");
  const img = document.getElementById("prova-lightbox-img");
  const closeBtn = box && box.querySelector(".prova-lightbox__close");
  const triggers = document.querySelectorAll("[data-prova-shot]");
  if (!box || !img || !closeBtn || !triggers.length) return;

  let lastTrigger = null;

  function open(trigger) {
    const shot = trigger.getAttribute("data-prova-shot");
    const inner = trigger.querySelector("img");
    if (!shot) return;

    lastTrigger = trigger;
    img.src = shot;
    img.alt = inner ? inner.alt : "";
    box.classList.add("is-open");
    box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    lenis.stop(); // trava o scroll suave da página por baixo
    closeBtn.focus();
  }

  function close() {
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lenis.start();
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => open(trigger));
  });

  closeBtn.addEventListener("click", close);

  // Clique no fundo (fora da imagem) fecha.
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.classList.contains("prova-lightbox__stage")) {
      close();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box.classList.contains("is-open")) close();
  });
}

initPortfolioReveal();
initCasesSwiper();
initProvasSwiper();
initProvaLightbox();
initCaseModal();
initHeroIcons();
initHeroTitleRotate();
initSiteNav();
initStarsBackground();
initBinaryTrail();
initTrafegoStats();
