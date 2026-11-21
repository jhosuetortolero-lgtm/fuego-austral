/* ==========================================================================
   FUEGO AUSTRAL — main.js
   Fluxo: loader → sequência de frames no <canvas> → animações de scroll
          → La Carta (filtros com GSAP Flip) → carrinho lateral em CLP.
   Dependências globais via CDN: gsap, ScrollTrigger, Flip, Lenis (opcional).
   Roda direto do disco (file://) ou em servidor local — sem módulos ES.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     0. Utilidades
     ------------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Formato chileno: $10.900 (ponto como separador de milhar, sem decimais).
     Feito à mão porque Intl em "es" não agrupa números de 4 dígitos (6900). */
  const formatCLP = (n) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DATA = window.FA_DATA || { categories: {}, menu: [] };
  const MENU_BY_ID = Object.fromEntries(DATA.menu.map((item) => [item.id, item]));

  /* Se o CDN do GSAP falhar, libera a página sem animações em vez de travar no loader */
  if (!window.gsap || !window.ScrollTrigger) {
    document.getElementById('loader')?.remove();
    console.warn('[Fuego Austral] GSAP no disponible: modo estático.');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.Flip) gsap.registerPlugin(Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Sempre começa no topo → a sequência abre no frame 0001 */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ------------------------------------------------------------------------
     1. Configuração
     ------------------------------------------------------------------------ */
  /* Telas pequenas recebem frames de 1280px: −42% de download e metade da memória.
     Mesmo critério do <link rel="preload" media> no index.html. */
  const SMALL_SCREEN = window.matchMedia('(max-width: 767px)').matches;

  const CONFIG = {
    frameCount: 94,
    framePath: (n) => `./public/${SMALL_SCREEN ? 'frames-mobile' : 'frames'}/frame_${String(n).padStart(4, '0')}.webp`,
    criticalStep: 4,          // antes de liberar o site, carrega 1 a cada 4 frames
    concurrency: 6,           // downloads simultâneos
    scrub: 0.5,               // suavização do ScrollTrigger
    maxDpr: SMALL_SCREEN ? 1.5 : 2, // limita resolução do canvas (casa com os frames de 1280px)
    bg: '#0A0A0B',            // mesma cor do fundo da página
    portraitFit: 0.46,        // em telas verticais, o hambúrguer ocupa ~1/0.46 da largura útil
    loaderMinTime: 1100,      // ms mínimos de loader (ritmo cinematográfico)
    loaderTimeout: 12000,     // libera o site mesmo se a rede estiver lenta
  };

  /* ------------------------------------------------------------------------
     2. Smooth scroll (Lenis) + trava de scroll para overlays
     ------------------------------------------------------------------------ */
  let lenis = null;

  function initSmoothScroll() {
    if (prefersReducedMotion || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* Contador: menu móvel + carrinho podem travar o scroll ao mesmo tempo */
  const ScrollLock = (() => {
    let count = 0;
    return {
      lock() {
        count += 1;
        if (count === 1) { lenis?.stop(); document.documentElement.classList.add('is-locked'); }
      },
      unlock() {
        count = Math.max(0, count - 1);
        if (count === 0) { lenis?.start(); document.documentElement.classList.remove('is-locked'); }
      },
      get active() { return count > 0; },
    };
  })();

  /* Overlay aberto: conteúdo de fundo sai do alcance do teclado e do leitor de tela */
  function setBackgroundInert(on, { header = false } = {}) {
    $('#contenido').inert = on;
    $('#santiago').inert = on;
    if (header) $('#site-header').inert = on;
  }

  function scrollToTarget(target) {
    const el = typeof target === 'string' ? $(target) : target;
    const toTop = !el || el.id === 'top';
    if (lenis) {
      lenis.scrollTo(toTop ? 0 : el, { duration: 1.6 });
    } else if (toTop) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    } else {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  /* ------------------------------------------------------------------------
     3. Loader
     ------------------------------------------------------------------------ */
  const Loader = (() => {
    const el = $('#loader');
    const bar = $('#loader-bar');
    const pct = $('#loader-pct');
    const shown = { v: 0 };

    function progress(p) {
      gsap.to(shown, {
        v: p,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: true,
        onUpdate: () => {
          bar.style.transform = `scaleX(${shown.v})`;
          pct.textContent = `${String(Math.round(shown.v * 100)).padStart(3, '0')}%`;
        },
      });
    }

    /* Frame 0001 pronto: deixa o hambúrguer aparecer por trás do loader */
    function preview() { el?.classList.add('has-preview'); }

    /* Resolve no meio da cortina para a intro do hero começar junto */
    function hide() {
      return new Promise((resolve) => {
        progress(1);
        if (prefersReducedMotion) {
          gsap.to(el, { autoAlpha: 0, duration: 0.4, delay: 0.3, onComplete: () => { el.remove(); resolve(); } });
          return;
        }
        gsap.timeline({ delay: 0.4, onComplete: () => el.remove() })
          .to($('.loader__inner', el), { autoAlpha: 0, y: -24, duration: 0.5, ease: 'power2.in' })
          .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, '-=0.15')
          .add(resolve, '-=0.8');
      });
    }

    return { progress, preview, hide };
  })();

  /* ------------------------------------------------------------------------
     4. Sequência de frames no <canvas>
     ------------------------------------------------------------------------ */
  const FrameSequence = (() => {
    const N = CONFIG.frameCount;
    const canvas = $('#hero-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const frames = new Array(N);
    const loaded = new Uint8Array(N);
    let current = 0;     // frame pedido pelo scroll
    let drawn = -1;      // frame efetivamente desenhado
    let cw = 0;
    let ch = 0;
    let dpr = 1;

    function resize() {
      // clientWidth/Height ignoram o transform (scale) da intro
      dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
      ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = cw;
      canvas.height = ch;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = CONFIG.bg;
      ctx.fillRect(0, 0, cw, ch);
      drawn = -1;
      render(current);
    }

    /* Se o frame pedido ainda não chegou, usa o vizinho carregado mais próximo */
    function nearestLoaded(index) {
      if (loaded[index]) return index;
      for (let d = 1; d < N; d += 1) {
        if (index - d >= 0 && loaded[index - d]) return index - d;
        if (index + d < N && loaded[index + d]) return index + d;
      }
      return -1;
    }

    /* Esfuma as bordas da imagem quando ela não cobre a tela (telas verticais) */
    function featherEdges(dy, dh) {
      const f = Math.min(dh * 0.2, 180 * dpr);
      let g = ctx.createLinearGradient(0, dy, 0, dy + f);
      g.addColorStop(0, CONFIG.bg);
      g.addColorStop(1, 'rgba(10,10,11,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, dy - 1, cw, f + 1);
      const bottom = dy + dh;
      g = ctx.createLinearGradient(0, bottom - f, 0, bottom);
      g.addColorStop(0, 'rgba(10,10,11,0)');
      g.addColorStop(1, CONFIG.bg);
      ctx.fillStyle = g;
      ctx.fillRect(0, bottom - f, cw, f + 1);
    }

    function render(index) {
      current = Math.max(0, Math.min(N - 1, Math.round(index)));
      const i = nearestLoaded(current);
      if (i < 0 || i === drawn) return;
      const img = frames[i];
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // object-fit: cover; em retrato limita a escala para o hambúrguer caber inteiro
      const portrait = cw < ch;
      let scale = Math.max(cw / iw, ch / ih);
      if (portrait) scale = Math.min(scale, cw / (iw * CONFIG.portraitFit));
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (cw - dw) / 2;
      // paisagem larga: corta mais embaixo (área vazia) e preserva o topo do pão
      const dy = portrait ? (ch - dh) * 0.38 : (ch - dh) * 0.22;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = CONFIG.bg;
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
      // "lighten" eleva o preto puro (#000) dos frames para #0A0A0B → fusão perfeita com a página
      ctx.globalCompositeOperation = 'lighten';
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'source-over';
      if (dy > 1) featherEdges(dy, dh);
      drawn = i;
    }

    function loadFrame(i) {
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        if (i === 0) img.fetchPriority = 'high';
        const done = () => {
          frames[i] = img;
          loaded[i] = 1;
          // redesenha se este frame está mais perto do pedido do que o atual
          if (drawn < 0 || Math.abs(i - current) < Math.abs(drawn - current)) { drawn = -1; render(current); }
          resolve(true);
        };
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(done);
        img.onerror = () => resolve(false);
        img.src = CONFIG.framePath(i + 1);
      });
    }

    /* Ordem: frame 0001 → 1 a cada `criticalStep` (cobertura grossa) → o resto */
    function buildLoadOrder() {
      const order = [0];
      const seen = new Set(order);
      for (let i = CONFIG.criticalStep; i < N; i += CONFIG.criticalStep) { order.push(i); seen.add(i); }
      if (!seen.has(N - 1)) { order.push(N - 1); seen.add(N - 1); }
      const criticalCount = order.length;
      for (let i = 0; i < N; i += 1) if (!seen.has(i)) order.push(i);
      return { order, criticalCount };
    }

    /* Resolve quando os frames críticos chegaram; o resto continua em segundo plano */
    async function preload({ onFirst, onProgress }) {
      const { order, criticalCount } = buildLoadOrder();
      await loadFrame(0);          // frame 0001 primeiro, desenhado imediatamente
      onFirst?.();
      let done = 1;
      onProgress?.(done / criticalCount);

      let cursor = 1;
      let releaseCritical;
      const criticalReady = new Promise((r) => { releaseCritical = r; });
      if (criticalCount === 1) releaseCritical();

      const worker = async () => {
        while (cursor < order.length) {
          const position = cursor;
          cursor += 1;
          await loadFrame(order[position]);
          if (position < criticalCount) {
            done += 1;
            onProgress?.(done / criticalCount);
            if (done === criticalCount) releaseCritical();
          }
        }
      };
      for (let k = 0; k < CONFIG.concurrency; k += 1) worker();
      return criticalReady;
    }

    function init() {
      resize();
      new ResizeObserver(debounce(resize, 60)).observe(canvas);
    }

    return { init, render, preload, count: N };
  })();

  /* ------------------------------------------------------------------------
     5. Hero: timeline com scrub (frames + 3 blocos de storytelling)
     ------------------------------------------------------------------------ */
  function storySegment(tl, block, start, end) {
    const io = 0.06; // duração de entrada/saída (fração do scroll)
    const lines = $$('.line-inner', block);
    const fades = $$('[data-fade]', block);
    tl.fromTo(block, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, duration: 0.01 }, start)
      .fromTo(lines, { yPercent: 115 }, { yPercent: 0, duration: io, stagger: 0.012, ease: 'power3.out' }, start)
      .fromTo(fades, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: io, ease: 'power2.out' }, start + 0.02)
      .to(block, { autoAlpha: 0, y: -50, duration: io, ease: 'power2.in' }, end - io);
  }

  function initHero() {
    const hero = $('#top');
    const blocks = $$('.story-block', hero);
    const counter = $('#frame-counter');
    const bar = $('#hero-progress');
    const N = FrameSequence.count;
    const state = { frame: 0 };
    let last = -1;

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom bottom',
        scrub: prefersReducedMotion ? true : CONFIG.scrub,
      },
    });

    // Frames: 0 → 93 ao longo de 100% do scroll (duração 1 = timeline normalizada)
    tl.to(state, {
      frame: N - 1,
      duration: 1,
      onUpdate: () => {
        const f = Math.round(state.frame);
        if (f === last) return;
        last = f;
        FrameSequence.render(f);
        counter.textContent = String(f + 1).padStart(3, '0');
        bar.style.transform = `scaleX(${f / (N - 1)})`;
      },
    }, 0);

    tl.to('#scroll-hint', { autoAlpha: 0, y: 12, duration: 0.04 }, 0.01);

    // Bloco 1 (0% → 25%): já visível na chegada, sai entre 18% e 25%
    tl.to(blocks[0], { autoAlpha: 0, y: -60, duration: 0.07, ease: 'power2.in' }, 0.18);
    // Bloco 2 (35% → 60%) e Bloco 3 (70% → 95%)
    storySegment(tl, blocks[1], 0.35, 0.6);
    storySegment(tl, blocks[2], 0.7, 0.95);
  }

  /* Intro após o loader: título do bloco 1 sobe linha a linha */
  function introHero() {
    if (prefersReducedMotion) return;
    const block = $('.story-block--1');
    gsap.from($$('.line-inner', block), { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: 0.09 });
    gsap.from($$('[data-fade]', block), { autoAlpha: 0, y: 24, duration: 1.1, ease: 'power3.out', stagger: 0.12, delay: 0.35 });
    gsap.from(['.scroll-hint__inner', '.hud-right'], { autoAlpha: 0, y: 16, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.6 });
    gsap.from('.site-header__inner', { yPercent: -120, autoAlpha: 0, duration: 1.2, ease: 'expo.out', delay: 0.15 });
    gsap.fromTo('#hero-canvas', { scale: 1.08 }, { scale: 1, duration: 2.4, ease: 'expo.out' });
  }

  /* ------------------------------------------------------------------------
     6. Header + navegação
     ------------------------------------------------------------------------ */
  function initHeader() {
    const header = $('#site-header');
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const y = self.scroll();
        header.classList.toggle('is-scrolled', y > 40);
        // some ao descer, volta ao subir (mais espaço para o filme)
        header.classList.toggle('is-hidden', self.direction === 1 && y > 320 && !ScrollLock.active);
      },
    });

    // Links âncora com Lenis
    $$('[data-scroll-to]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = $(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        MobileMenu.close();
        scrollToTarget(target);
      });
    });

    // Link ativo conforme a seção visível
    $$('.nav-link').forEach((link) => {
      const section = $(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });
  }

  const MobileMenu = (() => {
    const panel = $('#mobile-menu');
    const toggle = $('#menu-toggle');
    const header = $('#site-header');
    const labels = $$('.mobile-link__label', panel);
    let open = false;
    let anim = null; // animação de abrir/fechar em andamento

    function show() {
      if (open) return;
      open = true;
      ScrollLock.lock();
      header.classList.add('menu-open');
      header.classList.remove('is-hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Cerrar menú');
      panel.inert = false;
      setBackgroundInert(true);
      // Toques rápidos no celular: cancela o fechamento em andamento,
      // senão o onComplete dele escondia o menu já aberto (tela travada e vazia)
      anim?.kill();
      anim = gsap.timeline()
        .set(panel, { visibility: 'visible' })
        .to(panel, { clipPath: 'inset(0% 0% 0% 0%)', duration: prefersReducedMotion ? 0 : 0.8, ease: 'expo.inOut' })
        .fromTo(labels, { yPercent: 110 }, { yPercent: 0, duration: prefersReducedMotion ? 0 : 0.9, stagger: 0.07, ease: 'expo.out' }, '-=0.35');
    }

    function close() {
      if (!open) return;
      open = false;
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
      panel.inert = true;
      setBackgroundInert(false);
      anim?.kill();
      anim = gsap.to(panel, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: prefersReducedMotion ? 0 : 0.7,
        ease: 'expo.inOut',
        onComplete: () => gsap.set(panel, { visibility: 'hidden' }),
      });
      ScrollLock.unlock();
    }

    toggle?.addEventListener('click', () => (open ? close() : show()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const desktopMq = window.matchMedia('(min-width: 768px)');
    const onDesktop = (e) => { if (e.matches) close(); };
    // Safari < 14 só tem addListener: sem o fallback o script inteiro parava
    if (desktopMq.addEventListener) desktopMq.addEventListener('change', onDesktop);
    else desktopMq.addListener(onDesktop);

    return { close, get isOpen() { return open; } };
  })();

  /* ------------------------------------------------------------------------
     7. Nuestra Filosofía
     ------------------------------------------------------------------------ */
  /* Quebra o manifesto em palavras (mantém <em> como destaque) */
  function splitWords(el) {
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    const out = [];
    el.childNodes.forEach((node) => {
      const accent = node.nodeType === Node.ELEMENT_NODE;
      node.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
        out.push(`<span class="word${accent ? ' is-accent' : ''}" aria-hidden="true">${escapeHTML(word)}</span>`);
      });
    });
    el.setAttribute('aria-label', label);
    el.innerHTML = out.join(' ');
    return $$('.word', el);
  }

  function initPhilosophy() {
    const manifesto = $('[data-split]');
    if (manifesto) {
      const words = splitWords(manifesto);
      if (!prefersReducedMotion) {
        gsap.fromTo(words, { opacity: 0.14 }, {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: manifesto, start: 'top 78%', end: 'bottom 42%', scrub: true },
        });
      }
    }

    if (prefersReducedMotion) return;

    // Foto: cortina de revelação + parallax interno
    gsap.fromTo('.philo-figure__frame', { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.6,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: '.philo-figure', start: 'top 82%', once: true },
    });
    gsap.fromTo('.philo-figure__img', { yPercent: -7 }, {
      yPercent: 7,
      ease: 'none',
      scrollTrigger: { trigger: '.philo-figure', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // Números: linha desenha + contagem progressiva
    $$('.stat').forEach((stat) => {
      const rule = $('.stat__rule', stat);
      const num = $('[data-count]', stat);
      const target = Number(num.dataset.count);
      const counter = { v: 0 };
      num.textContent = '0';
      gsap.timeline({ scrollTrigger: { trigger: stat, start: 'top 85%', once: true } })
        .from(rule, { scaleX: 0, duration: 1.2, ease: 'expo.inOut' })
        .to(counter, {
          v: target,
          duration: 2.2,
          ease: 'power3.out',
          onUpdate: () => { num.textContent = Math.round(counter.v); },
        }, 0.2)
        .from($$('.stat__index, .stat__label, .stat__text', stat), { autoAlpha: 0, y: 24, stagger: 0.08, duration: 1, ease: 'expo.out' }, 0.3);
    });
  }

  /* ------------------------------------------------------------------------
     8. Reveals genéricos + marquee
     ------------------------------------------------------------------------ */
  function initReveals() {
    if (prefersReducedMotion) return;
    const items = $$('[data-reveal]');
    gsap.set(items, { autoAlpha: 0, y: 40 });
    ScrollTrigger.batch(items, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }),
    });
  }

  function initMarquee() {
    $$('.marquee').forEach((marquee) => {
      const track = $('.marquee__track', marquee);
      const group = $('.marquee__group', track);
      track.appendChild(group.cloneNode(true)); // 2 cópias → loop sem emenda em xPercent -50
      if (prefersReducedMotion) return;
      const loop = gsap.to(track, { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
      // acelera com a velocidade do scroll e volta ao ritmo normal
      ScrollTrigger.create({
        trigger: marquee,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 350, 5);
          gsap.to(loop, {
            timeScale: boost,
            duration: 0.2,
            overwrite: true,
            onComplete: () => gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' }),
          });
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     9. Ilustrações line-art dos cards (SVG inline, herdam cor via CSS)
     ------------------------------------------------------------------------ */
  const ART = {
    burger(variant) {
      const cheese = `M54 113${' l8 7 l8 -7'.repeat(8)}`;
      const greens = `M50 90${' q7 -9 14 0'.repeat(10)}`;
      const topping = variant === 'truffle'
        ? '<path class="nf a-soft" d="M84 60l6-3M104 52l7 1M130 50l6 3M150 60l6 3M116 64l5-2"/><circle cx="96" cy="66" r="2.5" class="a-cheese"/><circle cx="142" cy="68" r="2.5" class="a-cheese"/>'
        : '<path class="nf" d="M98 50l5-2M118 44h5M140 50l5 2M108 62l5-1M130 62l5 1M86 64l4-2M152 64l4 2"/>';
      return `<svg class="art" viewBox="0 0 240 160" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M50 136h140c0 10-8 16-18 16H68c-10 0-18-6-18-16Z"/>
        <rect x="48" y="118" width="144" height="16" rx="8"/>
        <path class="a-cheese" d="${cheese}"/>
        <rect x="48" y="96" width="144" height="16" rx="8"/>
        <path class="a-palta" d="${greens}"/>
        <path d="M52 80c0-28 30-46 68-46s68 18 68 46Z"/>
        ${topping}
      </g></svg>`;
    },

    pizza(variant) {
      let toppings;
      if (variant === 'pepperoni') {
        toppings = [[98, 56, 8], [143, 62, 8], [112, 101, 8], [84, 86, 7], [151, 99, 7], [128, 40, 6], [124, 78, 6]]
          .map(([x, y, r]) => `<circle class="a-tomato" cx="${x}" cy="${y}" r="${r}"/>`).join('')
          + '<path class="nf" style="stroke:#F4B53F" d="M78 70c10-12 18 10 28-2s18 10 28-2 18 10 28-2"/>';
      } else {
        toppings = [[96, 56], [141, 54], [108, 100], [149, 95], [83, 84], [126, 78]]
          .map(([x, y]) => `<rect class="a-cheese" x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2"/>`).join('')
          + '<path class="nf a-soft" d="M110 46a8 8 0 0 1 14 4M154 74a8 8 0 0 1 2 14M88 106a8 8 0 0 1 14-2M128 114a7 7 0 0 1 12 2"/>';
      }
      return `<svg class="art" viewBox="0 0 240 160" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="120" cy="80" r="62"/>
        <circle class="nf" cx="120" cy="80" r="50" stroke-dasharray="1 7" opacity=".7"/>
        <path class="nf a-soft" d="M120 18v124M66.3 49l107.4 62M66.3 111l107.4-62"/>
        ${toppings}
      </g></svg>`;
    },

    completo(variant) {
      const palta = `M44 69${' q8 -9 16 0'.repeat(9)}`;
      const mayo = `M50 47${' l6 -5 l6 5'.repeat(12)}`;
      const tomato = [[58, 51], [84, 49], [110, 52], [136, 49], [162, 52]]
        .map(([x, y]) => `<rect class="a-tomato" x="${x}" y="${y}" width="9" height="9" rx="2"/>`).join('');
      const extras = variant === 'dinamico'
        ? '<path class="nf a-soft" d="M70 60l6-6M96 61l5-7M124 60l6-6M150 61l5-7M176 60l6-6"/><circle class="a-palta" cx="76" cy="44" r="2"/><circle class="a-palta" cx="122" cy="42" r="2"/><circle class="a-palta" cx="170" cy="44" r="2"/>'
        : '';
      return `<svg class="art" viewBox="0 0 240 160" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect class="a-sausage" x="20" y="70" width="200" height="20" rx="10"/>
        <rect x="34" y="76" width="172" height="46" rx="23"/>
        <path class="nf a-soft" d="M56 100h128"/>
        <path class="a-palta" d="${palta}"/>
        ${tomato}
        ${extras}
        <path class="a-mayo" d="${mayo}"/>
      </g></svg>`;
    },
  };

  /* ------------------------------------------------------------------------
     10. La Carta: render, filtros (Flip) e "+ Agregar"
     ------------------------------------------------------------------------ */
  const Menu = (() => {
    const grid = $('#menu-grid');
    const filtersEl = $('#menu-filters');
    const pill = $('.filters__pill', filtersEl);
    const buttons = $$('[data-filter]', filtersEl);
    const status = $('#menu-status');
    let current = 'all';
    let flipTl = null; // animação de filtro em andamento

    function cardTemplate(item, index) {
      const art = (ART[item.art] || ART.burger)(item.variant);
      return `
        <article class="menu-card" data-category="${item.category}" data-id="${item.id}">
          <div class="menu-card__shell">
            <div class="menu-card__media" style="--accent:${item.accent}">
              <span class="menu-card__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
              ${item.badge ? `<span class="menu-card__badge">${escapeHTML(item.badge)}</span>` : ''}
              ${art}
            </div>
            <div class="menu-card__body">
              <p class="menu-card__cat">${escapeHTML(DATA.categories[item.category] || '')}</p>
              <div class="menu-card__head">
                <h3 class="menu-card__title">${escapeHTML(item.name)}</h3>
                <p class="menu-card__price">${formatCLP(item.price)}<small>CLP</small></p>
              </div>
              <p class="menu-card__desc">${escapeHTML(item.description)}</p>
              <div class="menu-card__foot">
                <span class="menu-card__meta">${escapeHTML(item.meta)}</span>
                <button type="button" class="add-btn" data-add="${item.id}" aria-label="Agregar ${escapeHTML(item.name)} al pedido">
                  <span class="add-btn__label">+ Agregar</span>
                </button>
              </div>
            </div>
          </div>
        </article>`;
    }

    function render() {
      grid.innerHTML = DATA.menu.map(cardTemplate).join('');
      buttons.forEach((btn) => {
        const f = btn.dataset.filter;
        const n = f === 'all' ? DATA.menu.length : DATA.menu.filter((i) => i.category === f).length;
        const sup = $('sup', btn);
        if (sup) sup.textContent = String(n).padStart(2, '0');
      });
    }

    function movePill(immediate = false) {
      const btn = buttons.find((b) => b.dataset.filter === current);
      if (!btn) return;
      gsap.to(pill, {
        x: btn.offsetLeft,
        width: btn.offsetWidth,
        duration: immediate || prefersReducedMotion ? 0 : 0.6,
        ease: 'expo.out',
      });
    }

    /* Celular: a barra de filtros rola na horizontal → centraliza o filtro escolhido
       (senão "Completos Chilenos" fica cortado na borda da tela) */
    function revealActiveFilter() {
      const wrap = filtersEl.parentElement;
      const btn = buttons.find((b) => b.dataset.filter === current);
      if (!wrap || !btn || wrap.scrollWidth <= wrap.clientWidth + 1) return;
      const w = wrap.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const delta = (b.left + b.width / 2) - (w.left + w.width / 2);
      if (Math.abs(delta) < 2) return;
      if (typeof wrap.scrollBy === 'function') wrap.scrollBy({ left: delta, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      else wrap.scrollLeft += delta;
    }

    function applyFilter(filter) {
      if (filter === current) return;
      current = filter;
      buttons.forEach((b) => {
        const on = b.dataset.filter === filter;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      movePill();
      revealActiveFilter();

      const cards = $$('.menu-card', grid);
      const matches = (card) => filter === 'all' || card.dataset.category === filter;

      // Cliques rápidos: termina o Flip anterior e limpa estilos inline
      // (senão um card "saindo" pode ficar invisível ocupando uma célula do grid)
      const fromH = grid.offsetHeight;
      if (flipTl) { flipTl.progress(1).kill(); flipTl = null; }
      gsap.killTweensOf([grid, ...cards]);
      gsap.set(grid, { clearProps: 'height' });
      gsap.set(cards, { clearProps: 'all' });

      const label = filter === 'all' ? 'toda La Carta' : DATA.categories[filter];
      const announce = () => {
        const n = cards.filter((c) => !c.classList.contains('is-hidden')).length;
        status.textContent = `Mostrando ${n} platos: ${label}.`;
      };

      if (prefersReducedMotion || !window.Flip) {
        cards.forEach((c) => c.classList.toggle('is-hidden', !matches(c)));
        announce();
        ScrollTrigger.refresh();
        return;
      }

      // FLIP: captura → muda o layout → anima da posição antiga para a nova
      const state = Flip.getState(cards, { props: 'opacity' });
      cards.forEach((c) => c.classList.toggle('is-hidden', !matches(c)));
      const toH = grid.offsetHeight;
      gsap.fromTo(grid, { height: fromH }, {
        height: toH,
        duration: 0.8,
        ease: 'expo.inOut',
        onComplete: () => { gsap.set(grid, { clearProps: 'height' }); ScrollTrigger.refresh(); },
      });

      flipTl = Flip.from(state, {
        duration: 0.8,
        ease: 'expo.inOut',
        absolute: true,
        stagger: 0.03,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, delay: 0.25, stagger: 0.06, ease: 'expo.out' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.4, ease: 'power2.in' }),
        onComplete: () => { flipTl = null; },
      });
      announce();
    }

    function flashAdded(btn) {
      const label = $('.add-btn__label', btn);
      btn.classList.add('is-added');
      label.textContent = '✓ Agregado';
      clearTimeout(btn._faTimer);
      btn._faTimer = setTimeout(() => {
        btn.classList.remove('is-added');
        label.textContent = '+ Agregar';
      }, 1400);
    }

    function init() {
      filtersEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (btn) applyFilter(btn.dataset.filter);
      });

      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add]');
        if (!btn) return;
        Cart.add(btn.dataset.add);
        flashAdded(btn);
        Cart.open(btn);
      });

      // spotlight do card segue o cursor
      grid.addEventListener('pointermove', (e) => {
        const shell = e.target.closest('.menu-card__shell');
        if (!shell) return;
        const r = shell.getBoundingClientRect();
        shell.style.setProperty('--mx', `${e.clientX - r.left}px`);
        shell.style.setProperty('--my', `${e.clientY - r.top}px`);
      });

      movePill(true);

      // entrada dos cards em lote conforme aparecem (anima o <article>;
      // o hover usa transform no .menu-card__shell, então não há conflito)
      if (!prefersReducedMotion) {
        const cards = $$('.menu-card', grid);
        gsap.set(cards, { autoAlpha: 0, y: 60 });
        ScrollTrigger.batch(cards, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 }),
        });
      }
    }

    return { render, init, movePill };
  })();

  /* ------------------------------------------------------------------------
     11. Carrinho lateral (drawer) — total em CLP, persistido no navegador
     ------------------------------------------------------------------------ */
  const Cart = (() => {
    const STORAGE_KEY = 'fuego-austral:pedido:v1';
    const MAX_QTY = 20;
    const drawer = $('#cart-drawer');
    const overlay = $('#cart-overlay');
    const toggle = $('#cart-toggle');
    const list = $('#cart-items');
    const empty = $('#cart-empty');
    const summary = $('#cart-summary');
    const view = $('#cart-view');
    const success = $('#cart-success');
    const badge = $('#cart-count');
    const headCount = $('#cart-head-count');
    let lines = read();
    let isOpen = false;
    let lastFocus = null;
    let lastCount = count();

    /* --- persistência (try/catch: modo privado pode bloquear o storage) --- */
    function read() {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((l) => MENU_BY_ID[l.id] && Number.isInteger(l.qty) && l.qty > 0)
          .map((l) => ({ id: l.id, qty: Math.min(l.qty, MAX_QTY) }));
      } catch {
        return [];
      }
    }
    function save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* sem storage: segue só em memória */ }
    }

    /* --- estado --- */
    function count() { return lines.reduce((sum, l) => sum + l.qty, 0); }
    function subtotal() { return lines.reduce((sum, l) => sum + MENU_BY_ID[l.id].price * l.qty, 0); }

    function add(id) {
      if (!MENU_BY_ID[id]) return;
      const line = lines.find((l) => l.id === id);
      if (line) line.qty = Math.min(line.qty + 1, MAX_QTY);
      else lines.push({ id, qty: 1 });
      commit(id);
    }
    function setQty(id, qty) {
      if (qty <= 0) lines = lines.filter((l) => l.id !== id);
      else {
        const line = lines.find((l) => l.id === id);
        if (line) line.qty = Math.min(qty, MAX_QTY);
      }
      commit();
    }
    function commit(highlightId) {
      save();
      render(highlightId);
    }

    /* --- UI --- */
    function lineTemplate(line) {
      const item = MENU_BY_ID[line.id];
      const art = (ART[item.art] || ART.burger)(item.variant);
      return `
        <li class="cart-line" data-line="${item.id}">
          <div class="cart-line__thumb" aria-hidden="true">${art}</div>
          <div>
            <p class="cart-line__name">${escapeHTML(item.name)}</p>
            <p class="cart-line__unit">${formatCLP(item.price)} c/u</p>
            <div class="cart-line__controls">
              <div class="qty" role="group" aria-label="Cantidad de ${escapeHTML(item.name)}">
                <button type="button" data-dec="${item.id}" aria-label="Quitar uno">−</button>
                <output aria-live="polite">${line.qty}</output>
                <button type="button" data-inc="${item.id}" aria-label="Agregar uno"${line.qty >= MAX_QTY ? ' disabled' : ''}>+</button>
              </div>
              <button type="button" class="cart-line__remove" data-remove="${item.id}">Quitar</button>
            </div>
          </div>
          <p class="cart-line__total">${formatCLP(item.price * line.qty)}</p>
        </li>`;
    }

    function render(highlightId) {
      const n = count();
      const total = subtotal();
      list.innerHTML = lines.map(lineTemplate).join('');
      empty.hidden = n > 0;
      summary.hidden = n === 0;
      $('#cart-subtotal').textContent = formatCLP(total);
      $('#cart-total').textContent = formatCLP(total);
      headCount.textContent = n;

      badge.textContent = n;
      badge.hidden = n === 0;
      toggle.setAttribute('aria-label', n ? `Abrir tu pedido (${n} productos)` : 'Abrir tu pedido');
      if (n > lastCount && !prefersReducedMotion) {
        gsap.fromTo(badge, { scale: 1.7 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      }
      lastCount = n;

      if (highlightId && !prefersReducedMotion) {
        const row = $(`[data-line="${highlightId}"]`, list);
        if (row) gsap.fromTo(row, { backgroundColor: 'rgba(232, 93, 4, 0.18)' }, { backgroundColor: 'rgba(232, 93, 4, 0)', duration: 1.4, delay: 0.3 });
      }
    }

    function showView(which) {
      view.hidden = which !== 'cart';
      success.hidden = which !== 'success';
    }

    function open(opener) {
      if (isOpen) return;
      MobileMenu.close();
      isOpen = true;
      lastFocus = opener || document.activeElement;
      showView('cart');
      ScrollLock.lock();
      toggle.setAttribute('aria-expanded', 'true');
      drawer.inert = false;
      setBackgroundInert(true, { header: true });
      const d = prefersReducedMotion ? 0 : 1;
      gsap.to(overlay, { autoAlpha: 1, duration: 0.5 * d, overwrite: true });
      gsap.fromTo(drawer, { xPercent: 100, autoAlpha: 1 }, { xPercent: 0, duration: 0.85 * d, ease: 'expo.out', overwrite: true });
      requestAnimationFrame(() => $('[data-cart-close]', drawer)?.focus({ preventScroll: true }));
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      toggle.setAttribute('aria-expanded', 'false');
      drawer.inert = true;
      setBackgroundInert(false, { header: true });
      const d = prefersReducedMotion ? 0 : 1;
      gsap.to(overlay, { autoAlpha: 0, duration: 0.45 * d, overwrite: true });
      gsap.to(drawer, {
        xPercent: 100,
        duration: 0.65 * d,
        ease: 'expo.inOut',
        overwrite: true,
        onComplete: () => gsap.set(drawer, { autoAlpha: 0 }),
      });
      ScrollLock.unlock();
      lastFocus?.focus?.({ preventScroll: true });
    }

    function checkout() {
      if (!lines.length) return;
      const total = subtotal();
      $('#order-number').textContent = `FA-${Math.floor(1000 + Math.random() * 9000)}`;
      $('#order-total').textContent = formatCLP(total);
      lines = [];
      commit();
      showView('success');
      if (!prefersReducedMotion) {
        gsap.from($$('#cart-success > *'), { autoAlpha: 0, y: 30, stagger: 0.07, duration: 0.8, ease: 'expo.out' });
      }
      $('#cart-success [data-cart-close]')?.focus({ preventScroll: true });
    }

    /* Mantém o foco dentro do drawer (Tab / Shift+Tab) */
    function trapFocus(e) {
      if (e.key !== 'Tab') return;
      const focusables = $$('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', drawer)
        .filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function init() {
      gsap.set(drawer, { xPercent: 100 });
      toggle.addEventListener('click', () => (isOpen ? close() : open(toggle)));
      overlay.addEventListener('click', close);
      drawer.addEventListener('keydown', trapFocus);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });

      drawer.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.matches('[data-cart-close]')) return close();
        if (t.matches('[data-goto-carta]')) { close(); return scrollToTarget('#la-carta'); }
        if (t.id === 'cart-checkout') return checkout();
        const id = t.dataset.inc || t.dataset.dec || t.dataset.remove;
        const line = lines.find((l) => l.id === id);
        if (!line) return;
        if (t.dataset.inc) setQty(id, line.qty + 1);
        else if (t.dataset.dec) setQty(id, line.qty - 1);
        else setQty(id, 0);
        // mantém o foco num lugar estável depois de re-renderizar
        const row = $(`[data-line="${id}"]`, list);
        const preferred = row && $(`[data-${t.dataset.inc ? 'inc' : 'dec'}]`, row);
        const fallback = row && $('[data-dec]', row);
        const next = [preferred, fallback].find((el) => el && !el.disabled) || $('[data-cart-close]', drawer);
        next.focus({ preventScroll: true });
      });

      render();
    }

    return { init, add, open, close, render };
  })();

  /* ------------------------------------------------------------------------
     12. Footer: tipografia gigante, horário de Santiago, voltar ao topo
     ------------------------------------------------------------------------ */
  function fitGiant() {
    const word = $('#giant-word');
    if (!word) return;
    const box = word.parentElement;
    const cs = getComputedStyle(box);
    const available = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    word.style.fontSize = '100px';
    const measured = word.getBoundingClientRect().width;
    if (measured > 0) word.style.fontSize = `${((100 * available) / measured).toFixed(2)}px`;
  }

  function initOpenStatus() {
    const status = $('#open-status');
    if (!status) return;
    // minutos desde 00:00 [abre, fecha]; fecha > 1440 = depois da meia-noite
    const HOURS = {
      0: [18 * 60, 23 * 60],
      1: [19 * 60, 24 * 60], 2: [19 * 60, 24 * 60], 3: [19 * 60, 24 * 60],
      4: [19 * 60, 26 * 60 + 30], 5: [19 * 60, 26 * 60 + 30], 6: [19 * 60, 26 * 60 + 30],
    };
    const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const update = () => {
      let day;
      let mins;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date());
        const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
        day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
        mins = (Number(map.hour) % 24) * 60 + Number(map.minute);
      } catch {
        const now = new Date();
        day = now.getDay();
        mins = now.getHours() * 60 + now.getMinutes();
      }
      const [openAt, closeAt] = HOURS[day];
      const prevClose = HOURS[(day + 6) % 7][1];
      const afterMidnight = prevClose > 1440 && mins < prevClose - 1440;
      const isOpen = (mins >= openAt && mins < closeAt) || afterMidnight;

      // destaca o dia "operacional" (madrugada conta como o dia anterior)
      const opDay = afterMidnight ? (day + 6) % 7 : day;
      $$('#hours li').forEach((li) => li.classList.toggle('is-today', li.dataset.days.split(',').includes(String(opDay))));

      status.classList.toggle('is-open', isOpen);
      let text;
      if (isOpen) text = `Abierto ahora · Cerramos a las ${fmt(afterMidnight ? prevClose : closeAt)}`;
      else if (mins < openAt) text = `Cerrado · Hoy abrimos a las ${fmt(openAt)}`;
      else text = `Cerrado · Mañana abrimos a las ${fmt(HOURS[(day + 1) % 7][0])}`;
      $('.open-status__text', status).textContent = text;
    };
    update();
    setInterval(update, 60000);
  }

  function initFooter() {
    const word = $('#giant-word');
    if (word) {
      const text = word.textContent.trim();
      word.innerHTML = [...text].map((c) => `<span class="giant__char">${c === ' ' ? '&nbsp;' : escapeHTML(c)}</span>`).join('');
      fitGiant();
      if (!prefersReducedMotion) {
        gsap.fromTo($$('.giant__char', word), { yPercent: 100 }, {
          yPercent: 0,
          ease: 'power3.out',
          stagger: 0.04,
          scrollTrigger: { trigger: '.giant', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
        });
      }
    }
    $('#back-to-top')?.addEventListener('click', () => scrollToTarget('#top'));
    initOpenStatus();
  }

  /* ------------------------------------------------------------------------
     13. Boot
     ------------------------------------------------------------------------ */
  async function boot() {
    initSmoothScroll();
    ScrollLock.lock();               // trava o scroll durante o loader

    Menu.render();
    Cart.init();
    FrameSequence.init();

    const framesReady = FrameSequence.preload({ onFirst: Loader.preview, onProgress: Loader.progress });
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

    await Promise.all([
      Promise.race([framesReady, wait(CONFIG.loaderTimeout)]),
      Promise.race([fontsReady, wait(3000)]),
      wait(CONFIG.loaderMinTime),
    ]);

    // Garante o topo antes de medir (alguns navegadores restauram o scroll no reload)
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });

    // Monta as animações com o layout final (fontes carregadas)
    initHeader();
    initHero();
    initPhilosophy();
    initReveals();
    initMarquee();
    Menu.init();
    initFooter();
    ScrollTrigger.refresh();

    // No celular a barra de endereço some/aparece ao rolar e dispara "resize" só com
    // mudança de altura: recalcular aí fazia o filme do hero pular de frame.
    // Altura sozinha o próprio ScrollTrigger já trata (ignoreMobileResize).
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      fitGiant();
      Menu.movePill(true);
      ScrollTrigger.refresh();
    }, 200));

    await Loader.hide();
    ScrollLock.unlock();
    introHero();
  }

  boot();
})();
