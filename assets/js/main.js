document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "work") initWork();
});

function initWork() {
  const grid = document.querySelector(".grid");
  const backdrop = document.getElementById("glanceBackdrop");
  const mediaContainer = document.getElementById("glanceMedia");
  const titleEl = document.getElementById("glanceTitle");
  const metaEl = document.getElementById("glanceMeta");
  const contextEl = document.getElementById("glanceContext");
  const counterEl = document.getElementById("glanceCounter");
  const prevBtn = document.getElementById("glancePrev");
  const nextBtn = document.getElementById("glanceNext");
  const closeBtn = document.getElementById("glanceClose");

  if (!grid || !backdrop || typeof PROJECTS === "undefined") return;

  const FOCUSABLE =
    'a[href], button:not([disabled]), img[tabindex], [tabindex]:not([tabindex="-1"])';
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const AUTOPLAY_MS = 6500;

  let glanceActive = false;
  let glanceIndex = 0;
  let glanceImages = [];
  let glanceTimer = null;
  let lastFocused = null;

  /* --- project records ---------------------------------------------------- */
  function record(project) {
    const bits = [project.location, project.meta, project.year].filter(Boolean);
    return bits.join(", ");
  }

  function thumbUrl(project, file) {
    return `assets/images/work/${project.slug}/thumb/${file}`;
  }

  function fullUrl(project, file) {
    return `assets/images/work/${project.slug}/full/${file}`;
  }

  /* --- grid --------------------------------------------------------------- */
  function buildGrid() {
    const frag = document.createDocumentFragment();

    PROJECTS.forEach((project, i) => {
      const card = document.createElement("a");
      card.className = "card";
      card.href = `?project=${encodeURIComponent(project.slug)}`;
      card.dataset.slug = project.slug;
      // the card's accessible name comes from its visible text content, so
      // no aria-label is set (a mismatched label would fail Lighthouse's
      // label-content-name-mismatch audit). Thumbnails stay decorative.
      // (aria-label removed)

      const media = document.createElement("div");
      media.className = "card-media";
      const images = (project.images || []).map((file, k) => {
        const el = new Image();
        el.loading = i < 4 ? "eager" : "lazy";
        el.decoding = "async";
        el.src = thumbUrl(project, file);
        el.alt = "";
        el.dataset.file = file;
        if (k === 0) el.classList.add("active");
        media.appendChild(el);
        return el;
      });

      const body = document.createElement("div");
      body.className = "card-body";

      const h2 = document.createElement("h2");
      h2.className = "card-title";
      h2.textContent = project.title;

      body.appendChild(h2);

      const metaText = record(project);
      if (metaText) {
        const meta = document.createElement("p");
        meta.className = "card-meta";
        meta.textContent = metaText;
        body.appendChild(meta);
      }

      if (project.context) {
        const ctx = document.createElement("p");
        ctx.className = "card-context";
        ctx.textContent = project.context;
        body.appendChild(ctx);
      }

      card.appendChild(media);
      card.appendChild(body);

      card.addEventListener("click", (ev) => {
        ev.preventDefault();
        openGlance(project, images.map((im) => im.dataset.file), card);
      });

      frag.appendChild(card);
      if (images.length > 1) slideshow(card, images);
    });

    grid.appendChild(frag);
  }

  /* --- per-card slideshow, only while the card is on screen --------------- */
  function slideshow(card, images) {
    if (reduceMotion.matches) return;

    let idx = 0;
    let timer = null;

    const tick = () => {
      images[idx].classList.remove("active");
      idx = (idx + 1) % images.length;
      images[idx].classList.add("active");
    };

    const start = () => {
      if (timer) return;
      // stagger by card so the grid never flashes in unison
      timer = setInterval(tick, AUTOPLAY_MS + (idx + 1) * 380);
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0.2 }
      );
      io.observe(card);
    } else {
      start();
    }

    // hovering or focusing a card is a request to look at it: hold the frame
    card.addEventListener("mouseenter", stop);
    card.addEventListener("focus", stop);
  }

  /* --- the lightbox ------------------------------------------------------- */
  function openGlance(project, files, trigger) {
    const prevFiles = glanceImages.slice();
    glanceActive = true;
    glanceIndex = 0;
    glanceImages = (files || project.images || []).slice();
    lastFocused = trigger || document.activeElement;

    titleEl.textContent = project.title;
    const metaText = record(project);
    metaEl.textContent = metaText;
    metaEl.hidden = !metaText;
    contextEl.textContent = project.context || "";
    contextEl.hidden = !project.context;

    renderGlanceMedia(project.slug);
    updateGlance();
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    // keep assistive tech out of the page behind the dialog
    setBackgroundInert(true);
    closeBtn.focus();

    if (history.pushState && prevFiles.join() !== glanceImages.join()) {
      history.pushState(
        { project: project.slug },
        "",
        `?project=${encodeURIComponent(project.slug)}`
      );
    }

    startGlanceTimer();
  }

  function renderGlanceMedia(slug) {
    mediaContainer.querySelectorAll("img").forEach((im) => im.remove());
    const frag = document.createDocumentFragment();

    glanceImages.forEach((file, i) => {
      const el = new Image();
      el.loading = i === 0 ? "eager" : "lazy";
      el.decoding = "async";
      el.src = fullUrl({ slug }, file);
      // the dialog already names the project; this describes position only
      el.alt = `${titleEl.textContent}, image ${i + 1} of ${glanceImages.length}`;
      if (i === glanceIndex) el.classList.add("active");
      frag.appendChild(el);
    });

    mediaContainer.insertBefore(frag, mediaContainer.firstChild);
  }

  function updateGlance() {
    const total = Math.max(1, glanceImages.length);
    counterEl.textContent = `${glanceIndex + 1} of ${total}`;
    counterEl.hidden = total < 2;
    prevBtn.hidden = nextBtn.hidden = total < 2;

    mediaContainer.querySelectorAll("img").forEach((im, i) => {
      im.classList.toggle("active", i === glanceIndex);
    });
  }

  function startGlanceTimer() {
    if (reduceMotion.matches || glanceImages.length < 2) return;
    stopGlanceTimer();
    glanceTimer = setInterval(() => {
      glanceIndex = (glanceIndex + 1) % glanceImages.length;
      updateGlance();
    }, AUTOPLAY_MS);
  }

  function stopGlanceTimer() {
    if (!glanceTimer) return;
    clearInterval(glanceTimer);
    glanceTimer = null;
  }

  function closeGlance() {
    if (!glanceActive) return;
    glanceActive = false;
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
    setBackgroundInert(false);
    stopGlanceTimer();

    if (history.pushState && location.search) {
      history.replaceState({}, "", "work.html");
    }
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  function setBackgroundInert(on) {
    document
      .querySelectorAll(".site-header, main, .pool")
      .forEach((el) => el.toggleAttribute("inert", on));
  }

  function step(delta) {
    if (!glanceActive) return;
    const total = glanceImages.length;
    if (total < 2) return;
    glanceIndex = (glanceIndex + delta + total) % total;
    updateGlance();
    startGlanceTimer();
  }

  /* --- wiring ------------------------------------------------------------- */
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  closeBtn.addEventListener("click", closeGlance);

  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) closeGlance();
  });

  document.addEventListener("keydown", (ev) => {
    if (!glanceActive) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeGlance();
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      step(-1);
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      step(1);
    } else if (ev.key === "Tab") {
      trapFocus(ev);
    }
  });

  // Tab must stay inside the dialog while it is open
  function trapFocus(ev) {
    const items = Array.from(backdrop.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hidden && el.offsetParent !== null
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (ev.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
      ev.preventDefault();
      first.focus();
    }
  }

  mediaContainer.addEventListener("mouseenter", stopGlanceTimer);
  mediaContainer.addEventListener("mouseleave", startGlanceTimer);
  mediaContainer.addEventListener("focusin", stopGlanceTimer);
  mediaContainer.addEventListener("focusout", startGlanceTimer);
  mediaContainer.addEventListener("touchstart", stopGlanceTimer, { passive: true });
  mediaContainer.addEventListener("touchend", startGlanceTimer);

  window.addEventListener("popstate", (ev) => {
    const slug = ev.state && ev.state.project;
    if (slug) {
      const p = PROJECTS.find((x) => x.slug === slug);
      if (p) {
        openGlance(p);
        return;
      }
    }
    closeGlance();
  });

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches) stopGlanceTimer();
    else if (glanceActive) startGlanceTimer();
  });

  buildGrid();

  const slugParam = new URLSearchParams(location.search).get("project");
  if (slugParam) {
    const p = PROJECTS.find((x) => x.slug === slugParam);
    if (p) openGlance(p);
  }
}
