/* ==========================================================================
   3hz Tweaks — site behaviour
   Everything here is progressive: with JS off the page still reads, the FAQ
   still opens via <details>-like behaviour? (no: keep it accessible by JS only,
   so mark the first one open if JS is missing.)
   ========================================================================== */

(function () {
  "use strict";

  /* --------------------------------------------------------------- config */
  const CONFIG = {
    // Paste a Stripe Payment Link (or Lemon Squeezy / Gumroad checkout URL)
    // per tier. When a link is present the button goes straight there and the
    // in-page preview checkout is skipped.
    checkout: {
      pro: "",
      ultra: "",
    },
    // Where the installer lives. Point this at your GitHub release asset.
    downloadUrl: "https://github.com/frotz69/3HZTWEAKS.github.io/releases/latest",
    // true  -> the Buy buttons open the preview checkout (no charge)
    // false -> Buy buttons with no link are hidden behind a setup notice
    previewCheckout: true,
  };

  // Monthly subscriptions. The only difference between the two tiers is
  // 3HZ AI: Ultra has it, Pro does not.
  const TIERS = {
    pro: {
      name: "Pro subscription",
      price: 1,
      billing: "Monthly, cancel anytime",
    },
    ultra: {
      name: "Ultra subscription",
      price: 2,
      billing: "Monthly, cancel anytime",
    },
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------------ nav */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("#burger");
  if (burger) {
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    $$(".nav-links a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* --------------------------------------------------------------- reveal */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* -------------------------------------------------------------- counters */
  const counters = $$("[data-count]");
  const runCounter = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = target + suffix;
      return;
    }
    const start = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const settleCounter = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    el.textContent = (el.dataset.count || "0") + (el.dataset.suffix || "");
  };

  // A scroll check rather than an IntersectionObserver: an anchor jump can
  // scroll past the strip before the observer ever runs, which used to leave
  // hard zeros on the page. This animates when visible and settles values that
  // were skipped over.
  const checkCounters = () => {
    counters.forEach((el) => {
      if (el.dataset.counted) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0) settleCounter(el);
      else if (r.top < window.innerHeight * 0.9) runCounter(el);
    });
  };
  checkCounters();
  window.addEventListener("scroll", checkCounters, { passive: true });
  window.addEventListener("resize", checkCounters);
  window.addEventListener("load", checkCounters);

  /* -------------------------------------------------------- pointer glow */
  $$("[data-spot]").forEach((el) => {
    el.addEventListener("pointermove", (ev) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      el.style.setProperty("--my", `${ev.clientY - r.top}px`);
    });
  });

  /* ----------------------------------------------------------- shot tilt */
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && window.matchMedia("(hover: hover)").matches) {
    $$("[data-tilt]").forEach((wrap) => {
      const frame = $(".shot-frame", wrap);
      if (!frame) return;
      let raf = 0;
      const apply = (rx, ry) => {
        frame.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      };
      wrap.addEventListener("pointermove", (ev) => {
        const r = wrap.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width - 0.5;
        const py = (ev.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => apply(-py * 3.2, px * 4.2));
      });
      wrap.addEventListener("pointerleave", () => {
        cancelAnimationFrame(raf);
        frame.style.transform = "";
      });
    });

    // gentle scroll parallax on the hero shot
    const heroShot = $(".hero-shot");
    if (heroShot) {
      let ticking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            const y = Math.min(window.scrollY, 600);
            heroShot.style.transform = `translateY(${y * 0.045}px)`;
            ticking = false;
          });
        },
        { passive: true }
      );
    }
  }

  /* ------------------------------------------------------- deep links ---- */
  // The browser resolves a #hash before the web font swaps in, so a direct
  // link to #pricing could land hundreds of pixels past the section. Once
  // everything has loaded, put the target where it belongs.
  let userMoved = false;
  ["wheel", "touchstart", "keydown"].forEach((ev) =>
    window.addEventListener(ev, () => (userMoved = true), { passive: true, once: true })
  );

  const realignHash = () => {
    if (userMoved || !location.hash || location.hash.length < 2) return;
    let target = null;
    try { target = document.querySelector(location.hash); } catch (_) { return; }
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - 88;
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, y));
    root.style.scrollBehavior = prev;
  };

  // Repeat once the font has swapped and the images have settled: the first
  // pass can run before the browser finishes its own fragment scroll.
  realignHash();
  window.addEventListener("load", () => {
    setTimeout(realignHash, 60);
    setTimeout(realignHash, 600);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(realignHash, 80));
  }

  /* -------------------------------------------------------------- marquee */
  const track = $("#marquee");
  if (track) {
    // duplicate once so translateX(-50%) loops without a visible seam
    track.innerHTML += track.innerHTML;
  }

  /* ------------------------------------------------------------------ faq */
  $$(".faq-item").forEach((item) => {
    const q = $(".faq-q", item);
    const a = $(".faq-a", item);
    if (!q || !a) return;
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      $$(".faq-item.open").forEach((other) => {
        other.classList.remove("open");
        $(".faq-a", other).style.maxHeight = "0px";
        $(".faq-q", other).setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        a.style.maxHeight = a.scrollHeight + "px";
        q.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* --------------------------------------------------------------- footer */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const dl = $("#downloadBtn");
  if (dl) dl.href = CONFIG.downloadUrl;

  /* ------------------------------------------------------------- checkout */
  const modal = $("#modal");
  const modalForm = $("#modalForm");
  const modalDone = $("#modalDone");
  const payForm = $("#payForm");
  const payBtn = $("#payBtn");
  let currentTier = "pro";
  let lastFocus = null;

  const money = (n) => "€" + n.toFixed(2);
  const perMonth = (n) => money(n) + " / mo";

  function fillTier(tier) {
    const t = TIERS[tier];
    if (!t) return;
    $("#modalTitle").textContent = "Checkout";
    $("#modalSub").textContent = t.name + " · " + perMonth(t.price);
    $("#orderTier").textContent = t.name;
    $("#orderPrice").textContent = perMonth(t.price);
    $("#orderUpdates").textContent = t.billing;
    $("#orderTotal").textContent = money(t.price);
    payBtn.textContent = "Subscribe — " + money(t.price) + "/mo";
    $("#modalDone").hidden = true;
    modalForm.hidden = false;
    $("#licenceKey").textContent = "3HZ-0000-0000-0000";
  }

  function openModal(tier) {
    currentTier = tier;
    fillTier(tier);
    lastFocus = document.activeElement;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    const email = $("#email");
    if (email) setTimeout(() => email.focus(), 220);
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function makeKey() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const group = () =>
      Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    return `3HZ-${group()}-${group()}-${group()}`;
  }

  $$("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tier = btn.dataset.buy;
      const link = CONFIG.checkout[tier];
      if (link) {
        window.location.href = link;
        return;
      }
      if (!CONFIG.previewCheckout) {
        alert("Checkout is not connected yet. Add your Payment Link in assets/app.js.");
        return;
      }
      openModal(tier);
    });
  });

  if (modal) {
    $("#modalClose").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
  }

  // input helpers: keep the card fields looking like a checkout should
  const card = $("#card");
  if (card) {
    card.addEventListener("input", () => {
      const digits = card.value.replace(/\D/g, "").slice(0, 16);
      card.value = digits.replace(/(.{4})/g, "$1 ").trim();
    });
  }

  const exp = $("#exp");
  if (exp) {
    exp.addEventListener("input", () => {
      const d = exp.value.replace(/\D/g, "").slice(0, 4);
      exp.value = d.length > 2 ? d.slice(0, 2) + " / " + d.slice(2) : d;
    });
  }

  const cvc = $("#cvc");
  if (cvc) cvc.addEventListener("input", () => (cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4)));

  if (payForm) {
    payForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = $("#email").value.trim();
      const digits = card.value.replace(/\s/g, "");
      const expOk = /^\d{2} \/ \d{2}$/.test(exp.value);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return $("#email").focus();
      if (digits.length < 15) return card.focus();
      if (!expOk) return exp.focus();
      if (cvc.value.length < 3) return cvc.focus();

      payBtn.disabled = true;
      payBtn.innerHTML = '<span class="spinner"></span> Processing…';

      // Preview mode: nothing is charged, the flow is simulated end to end so
      // the layout and the post-purchase state can be seen. Connect a real
      // Payment Link in CONFIG.checkout to take payments.
      setTimeout(() => {
        payBtn.disabled = false;
        payBtn.textContent = "Subscribe — " + money(TIERS[currentTier].price) + "/mo";
        modalForm.hidden = true;
        modalDone.hidden = false;
        $("#licenceKey").textContent = makeKey();
        $("#doneCopy").textContent =
          "Your " + TIERS[currentTier].name + " is active at " +
          money(TIERS[currentTier].price) + " a month. Paste the key into Settings → Licence. " +
          (CONFIG.checkout[currentTier] ? "" : "This is a preview — no payment was taken.");
      }, 1400);
    });
  }

  const copyKey = $("#copyKey");
  if (copyKey) {
    copyKey.addEventListener("click", async () => {
      const key = $("#licenceKey").textContent;
      try {
        await navigator.clipboard.writeText(key);
        copyKey.textContent = "Copied";
        setTimeout(() => (copyKey.textContent = "Copy licence key"), 1600);
      } catch (_) {
        copyKey.textContent = "Select and copy manually";
      }
    });
  }
})();
