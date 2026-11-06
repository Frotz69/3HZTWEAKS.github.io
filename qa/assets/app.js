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
    // Accounts, verification codes and licence keys live in the Worker in
    // accounts_api/. Point this at the deployed site URL (preview or
    // production) - the page never invents a key locally.
    // ?api=http://127.0.0.1:8787 points the page at a local `wrangler dev`.
    api:
      new URLSearchParams(location.search).get("api") ||
      "https://site-10cf5e522f974961a21ae12b9d829f1c.freebuff.page",
    // Checkout is a Stripe subscription created by the Worker (/api/checkout),
    // so there is no payment link to paste here: the page asks the Worker for a
    // session URL and sends the buyer to Stripe's own page. While Stripe is not
    // configured the Worker answers 501 and this page falls back to the card-less
    // key handout, so the buttons keep working during setup.
    // The Windows build, served from this repository so the button always has
    // something behind it (the installer zip; the portable zip is linked beside
    // it in the download section). Rebuild them from native/build with
    // tools/pack_release.py, which prints the checksums the FAQ quotes.
    downloadUrl: "download/3hzTweaks-Setup.zip",
  };

  // Monthly subscriptions. Pro unlocks the whole tweak catalogue; Ultra adds
  // 3HZ AI (the assistant page in the app is Ultra-only). Pro and Ultra are
  // separate keys, and an account shows whichever plan is better.
  const TIERS = {
    pro: {
      name: "Pro",
      price: 1,
      billing: "Monthly, cancel anytime",
      perks: "every tweak in the catalogue",
    },
    ultra: {
      name: "Ultra",
      price: 3,
      billing: "Monthly, cancel anytime",
      perks: "every tweak, plus 3HZ AI",
    },
  };

  // Free / Pro / Ultra. "premium" is the old name for the single paid tier, so a
  // session saved before the split still reads as Pro.
  function planOf(raw) {
    const t = String(raw || "").toLowerCase();
    if (t.includes("ultra")) return { name: "ultra", label: "Ultra", paid: true, blurb: "everything plus 3HZ AI" };
    if (t.includes("pro") || t.includes("premium")) return { name: "pro", label: "Pro", paid: true, blurb: "every tweak unlocked" };
    return { name: "free", label: "Free", paid: false, blurb: "69 tweaks · 3HZ AI is Ultra" };
  }

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

  // The button is a plain link with the archive's own path in the markup, so it
  // still downloads if this script never runs; the download attribute pins the
  // saved filename, which keeps some browsers from opening the zip in a tab.
  // Split download control, used twice on the page (hero and final call to
  // action): the wide half downloads the Windows installer, the caret drops a
  // menu with the portable zip and the macOS build. The menu is plain markup
  // with real hrefs, so it works before this script runs; this only adds the
  // open/close, the arrow, Escape and arrow-key movement.
  document.querySelectorAll(".dl-split").forEach((split) => {
    const main = split.querySelector(".dl-main");
    const toggle = split.querySelector(".dl-caret");
    const menu = split.querySelector(".dl-menu");
    if (!main || !toggle || !menu) return;

    main.href = CONFIG.downloadUrl;
    main.setAttribute("download", CONFIG.downloadUrl.split("/").pop());

    const items = Array.prototype.slice.call(menu.querySelectorAll(".dl-item"));
    const isOpen = () => split.classList.contains("open");
    const setOpen = (open) => {
      split.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    // Click (or Enter/Space) is the only way in: hovering the caret must never
    // open the panel, and must never close one that is already open.
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      setOpen(!isOpen());
    });

    document.addEventListener("click", (e) => {
      if (!split.contains(e.target)) setOpen(false);
    });

    menu.addEventListener("click", (e) => {
      if (e.target.closest(".dl-item")) setOpen(false);
    });

    // Enter and Space are left to the button itself; only the arrow keys need
    // help. The handler sits on the split so it can also move between rows, and
    // it ignores the caret's own event so one press never moves focus twice.
    split.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const at = items.indexOf(document.activeElement);
      if (at === -1) {
        if (e.target !== toggle) return;
        setOpen(true);
        const first = e.key === "ArrowDown" ? items[0] : items[items.length - 1];
        if (first) first.focus();
        return;
      }
      const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
      items[next].focus();
    });
  });

  /* ------------------------------------------------------------- accounts */
  // Everything account-shaped talks to the Worker in accounts_api/: it mails
  // verification codes and licence keys, so this page never fakes a key.
  const API = CONFIG.api.replace(/\/$/, "");
  const SESSION_KEY = "3hz.session";
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (_) { session = null; }
  let pendingEmail = "";
  let lastFocus = null;

  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
    paintNav();
  }

  async function api(path, body, token) {
    let res;
    try {
      res = await fetch(API + path, {
        method: body === undefined ? "GET" : "POST",
        headers: Object.assign(
          { "content-type": "application/json" },
          token ? { authorization: "Bearer " + token } : {}
        ),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (_) {
      return { ok: false, status: 0, data: { error: "No connection to the account service." } };
    }
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!data.error && !res.ok) data.error = "That did not work (" + res.status + ").";
    return { ok: res.ok, status: res.status, data };
  }

  const navSignIn = $("#navSignIn");
  const navSignUp = $("#navSignUp");
  const navAccount = $("#navAccount");

  function paintNav() {
    const signed = !!(session && session.user);
    if (navSignIn) navSignIn.hidden = signed;
    if (navSignUp) navSignUp.hidden = signed;
    if (navAccount) navAccount.hidden = !signed;
    if (signed) {
      const plan = planOf(session.user.tier);
      $("#navAccountLabel").textContent = session.user.email.split("@")[0];
      $("#navPlan").textContent = plan.label;
      $("#navPlan").style.color = plan.paid ? "#9ccbfa" : "";
    }
  }

  async function refreshSession() {
    if (!session || !session.token) return paintNav();
    const r = await api("/api/me", undefined, session.token);
    if (r.ok) saveSession({ token: session.token, user: r.data.user });
    else if (r.status === 401) saveSession(null);
    else paintNav();
  }

  /* account modal ---------------------------------------------------------- */
  const acct = $("#acctModal");
  const acctMsg = $("#acctMsg");
  const acctTabs = $("#acctTabs");
  const acctInk = $("#acctInk");
  const ACCT_TITLES = {
    signin: ["Welcome back", "One account for your plan, your key and your tweaks."],
    signup: ["Create your account", "Free to start. 3HZ AI is included on every plan."],
    verify: ["Check your inbox", "One step left - the code proves the address is yours."],
    account: ["Your account", "Your plan, your licence key and this browser's session."],
  };

  function moveInk(tab) {
    if (!acctInk || !tab) return;
    acctInk.style.width = tab.offsetWidth + "px";
    acctInk.style.transform = "translateX(" + tab.offsetLeft + "px)";
  }

  function acctTab(name) {
    if (!acct) return;
    const tab = acct.querySelector('.acct-tab[data-tab="' + name + '"]');
    $$(".acct-tab", acct).forEach((t) => t.classList.toggle("is-on", t === tab));
    $$(".acct-panel", acct).forEach((p) => p.classList.toggle("is-on", p.dataset.panel === name));
    acctTabs.hidden = name === "verify" || name === "account";
    const titles = ACCT_TITLES[name] || ACCT_TITLES.signin;
    $("#acctTitle").textContent = titles[0];
    $("#acctSub").textContent = titles[1];
    if (tab && !acctTabs.hidden) requestAnimationFrame(() => moveInk(tab));
    if (name === "account") paintAccount();
    if (name === "signin") setTimeout(() => $("#siEmail").focus(), 220);
    if (name === "signup") setTimeout(() => $("#suEmail").focus(), 220);
  }

  function openAcct(name) {
    if (!acct) return;
    lastFocus = document.activeElement;
    acct.classList.add("open");
    acct.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setMsg("");
    acctTab(session && session.user ? "account" : name || "signin");
  }

  function closeAcct() {
    if (!acct) return;
    acct.classList.remove("open");
    acct.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function setMsg(text, kind) {
    if (!acctMsg) return;
    acctMsg.textContent = text || "";
    acctMsg.className = "acct-msg" + (kind ? " " + kind : "");
  }

  function paintAccount() {
    if (!session || !session.user) { acctTab("signin"); return; }
    const u = session.user;
    const tier = planOf(u.tier);
    $("#acctEmail").textContent = u.email;
    $("#acctAvatar").textContent = (u.email[0] || "?").toUpperCase();
    const plan = $("#acctPlan");
    plan.textContent = tier.label + " plan · " + tier.blurb;
    plan.className = "acct-plan" + (tier.paid ? " pro" : "");
    $("#acctKey").textContent = u.licence || "No key yet";
    $("#acctUpgrade").hidden = tier.name === "ultra";
    $("#acctUpgrade").textContent = tier.name === "pro" ? "Get Ultra — €3/mo" : "Get Pro — €1/mo";
    $("#copyAcctKey").hidden = !u.licence;
  }

  if (navSignIn) navSignIn.addEventListener("click", () => openAcct("signin"));
  if (navSignUp) navSignUp.addEventListener("click", () => openAcct("signup"));
  if (navAccount) navAccount.addEventListener("click", () => openAcct("account"));
  if (acct) {
    $("#acctClose").addEventListener("click", closeAcct);
    acct.addEventListener("click", (e) => { if (e.target === acct) closeAcct(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && acct.classList.contains("open")) closeAcct();
    });
    $$("[data-tab]", acct).forEach((b) =>
      b.addEventListener("click", () => { setMsg(""); acctTab(b.dataset.tab); })
    );
  }

  const $signin = $('.acct-panel[data-panel="signin"]');
  const $signup = $('.acct-panel[data-panel="signup"]');
  const $verify = $('.acct-panel[data-panel="verify"]');

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + (label || "Working…");
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || label || "Continue";
    }
  }

  if ($signin) {
    $signin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#siEmail").value.trim();
      const pass = $("#siPass").value;
      if (!email) return $("#siEmail").focus();
      if (!pass) return $("#siPass").focus();
      const btn = $("button[type=submit]", $signin);
      busy(btn, true, "Signing in…");
      setMsg("");
      const r = await api("/api/login", { email: email, password: pass });
      busy(btn, false, "Sign in");
      if (r.ok) {
        saveSession({ token: r.data.token, user: r.data.user });
        setMsg("Signed in. Your key travels with the account.", "ok");
        acctTab("account");
      } else if (r.data.code === "unverified") {
        pendingEmail = email;
        $("#verifyLede").textContent = "Enter the 6-digit code we just sent to " + email + ".";
        if (r.data.devCode) $("#verifyLede").textContent += " (dev code " + r.data.devCode + ")";
        acctTab("verify");
        setMsg(r.data.error);
      } else {
        setMsg(r.data.error, "err");
      }
    });
  }

  if ($signup) {
    $signup.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#suEmail").value.trim();
      const pass = $("#suPass").value;
      if (!email) return $("#suEmail").focus();
      if (pass.length < 8) { setMsg("Use a password of at least 8 characters.", "err"); return $("#suPass").focus(); }
      const btn = $("button[type=submit]", $signup);
      busy(btn, true, "Sending code…");
      setMsg("");
      const r = await api("/api/signup", { email: email, password: pass });
      busy(btn, false, "Create account");
      if (r.ok) {
        pendingEmail = email;
        $("#verifyLede").textContent = "Enter the 6-digit code we sent to " + email + ".";
        if (r.data.devCode) $("#verifyLede").textContent += " (dev code " + r.data.devCode + ")";
        acctTab("verify");
        setTimeout(() => $("#verifyCode").focus(), 250);
        setMsg("Code sent. It expires in 15 minutes.", "ok");
      } else {
        setMsg(r.data.error, "err");
        if (r.data.code === "exists") acctTab("signin");
      }
    });
  }

  if ($verify) {
    $verify.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = $("#verifyCode").value.replace(/\D/g, "");
      if (code.length !== 6) { setMsg("The code is six digits.", "err"); return $("#verifyCode").focus(); }
      const btn = $("button[type=submit]", $verify);
      busy(btn, true, "Checking…");
      const r = await api("/api/verify", { email: pendingEmail, code: code });
      busy(btn, false, "Verify and sign in");
      if (r.ok) {
        saveSession({ token: r.data.token, user: r.data.user });
        setMsg("Email verified. Welcome in.", "ok");
        acctTab("account");
      } else {
        setMsg(r.data.error, "err");
      }
    });
    $("#verifyCode").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
    $("#resendCode").addEventListener("click", async () => {
      const r = await api("/api/resend", { email: pendingEmail });
      setMsg(r.ok ? "Another code is on its way." : r.data.error, r.ok ? "ok" : "err");
    });
  }

  if ($("#acctSignOut")) {
    $("#acctSignOut").addEventListener("click", () => {
      saveSession(null);
      $("#siPass").value = "";
      acctTab("signin");
      setMsg("Signed out on this device.");
    });
  }

  if ($("#copyAcctKey")) {
    $("#copyAcctKey").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($("#acctKey").textContent);
        setMsg("Key copied.", "ok");
      } catch (_) {
        setMsg("Select the key and copy it manually.");
      }
    });
  }

  if ($("#acctUpgrade")) {
    $("#acctUpgrade").addEventListener("click", () => {
      closeAcct();
      openModal("pro", session && session.user ? session.user.email : "");
    });
  }

  paintNav();
  refreshSession();

  /* ------------------------------------------------------------- checkout */
  const modal = $("#modal");
  const modalForm = $("#modalForm");
  const modalDone = $("#modalDone");
  const payForm = $("#payForm");
  const payBtn = $("#payBtn");
  let currentTier = "pro";
  let betaMode = false;      // true once the Worker says Stripe is not configured

  function showBetaMode() {
    betaMode = true;
    const flag = $("#betaFlag");
    if (flag) flag.hidden = false;
    if (payBtn) payBtn.textContent = "Email my licence key";
  }

  // Checkout problems are explained inside the card: an alert() is unreadable,
  // and a raw API error like "Not found" tells a buyer nothing.
  function payNote(message) {
    const note = $("#payNote");
    if (!note) return;
    if (!message) { note.hidden = true; note.textContent = ""; return; }
    note.textContent = message;
    note.hidden = false;
  }

  // The Worker answers 404 for /api/checkout when the deployed build predates
  // Stripe, which is a different problem from Stripe refusing a card.
  function checkoutUnavailable(res) {
    return res.status === 404 || res.status === 501 || res.status === 503 ||
           res.status === 0 || (res.data && res.data.needsSetup);
  }

  const UNAVAILABLE =
    "Card payments are not switched on yet, so nothing was charged. The account " +
    "service needs its Stripe keys and a redeploy before this button can take a card.";

  const money = (n) => "€" + n.toFixed(2);
  const perMonth = (n) => money(n) + " / mo";

  function fillTier(tier) {
    const t = TIERS[tier];
    if (!t) return;
    $("#modalTitle").textContent = "Checkout";
    $("#modalSub").textContent = t.name + " · " + perMonth(t.price) + " · " + t.perks;
    $("#orderTier").textContent = t.name + " subscription";
    $("#orderPrice").textContent = perMonth(t.price);
    $("#orderUpdates").textContent = t.billing;
    $("#orderTotal").textContent = money(t.price);
    payBtn.textContent = betaMode ? "Email my licence key" : "Continue to Stripe";
    modalDone.hidden = true;
    modalForm.hidden = false;
    payNote("");
  }

  function openModal(tier, prefillEmail) {
    if (!modal) return;
    currentTier = tier;
    fillTier(tier);
    const field = $("#email");
    if (field) field.value = prefillEmail || (session && session.user ? session.user.email : "");
    lastFocus = document.activeElement;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    if (field) setTimeout(() => field.focus(), 220);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // Buy -> the checkout card. The card collects the email (Stripe would too) and
  // then asks the Worker for a Stripe subscription session.
  $$("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tier = btn.dataset.buy;
      if (!TIERS[tier]) return;
      openModal(tier);
    });
  });

  if (modal) {
    $("#modalClose").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    });
  }

  if (payForm) {
    payForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailField = $("#email");
      const email = emailField.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { emailField.focus(); return; }

      // 1. the real path: the Worker opens a Stripe subscription session and the
      //    page goes to Stripe's own checkout (the card never touches this page).
      if (!betaMode) {
        payNote("");
        busy(payBtn, true, "Opening Stripe…");
        const co = await api("/api/checkout", { email: email, tier: currentTier });
        if (co.ok && co.data.url) {
          window.location.href = co.data.url;
          return;
        }
        busy(payBtn, false, "Continue to Stripe");
        if (!checkoutUnavailable(co)) {
          // Stripe itself refused: say what it said, in the card
          payNote((co.data && co.data.error) || "Stripe did not accept that. Try again in a moment.");
          return;
        }
        // The service cannot take a card. Only a Worker that offers the
        // card-less handout as a deliberate setup mode is stepped down to it;
        // an old build that simply has no /api/checkout must not hand out keys.
        const welcomeBeta = !!(co.data && co.data.needsSetup);
        if (!welcomeBeta) {
          payNote(UNAVAILABLE);
          return;
        }
        showBetaMode();
      }

      busy(payBtn, true, "Mailing your key…");
      const r = await api("/api/purchase", { email: email, tier: currentTier });
      busy(payBtn, false, "Email my licence key");
      if (!r.ok) {
        if (r.data.key) {
          // the key exists but the mail did not go out; still show it
          modalForm.hidden = true;
          modalDone.hidden = false;
          $("#licenceKey").textContent = r.data.key;
          $("#doneCopy").textContent = r.data.error + " Your key is below - save it somewhere.";
          return;
        }
        // A production Worker refuses the card-less handout (403, with a
        // pointer at /api/checkout). That is not a buyer's error to read: it
        // means checkout itself is not ready, so say that instead.
        const noHandout = r.status === 403 || !!(r.data && r.data.checkout);
        payNote(noHandout ? UNAVAILABLE : (r.data.error || "That did not work."));
        return;
      }
      modalForm.hidden = true;
      modalDone.hidden = false;
      $("#licenceKey").textContent = r.data.key;
      $("#doneCopy").textContent =
        "Your " + TIERS[currentTier].name + " plan is active and the key is in " + email +
        ". Paste it into the app under Account → Have a key?";
      if (session && session.user && session.user.email === email) refreshSession();
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

  /* ------------------------------------------------------------ bit quest */
  // The nav's pixel person opens a full-screen game: seven moments in computing
  // and one typed guess each. Points fall off with distance from the real year,
  // older moments forgive a wider guess, and the traveller strides on by
  // exactly as far as the guess was close. Local only - no request, no storage.
  const arcadeModal = $("#arcadeModal");
  const arcadeOpenBtn = $("#arcadeOpen");

  if (arcadeModal && arcadeOpenBtn) {
    const ROUNDS = 7;
    const CLOCK = 20;              // seconds a moment stays open
    const WALKER_Y = 262;          // the traveller's feet sit on the road
    const WALK_FROM = 40;
    const WALK_TO = 540;
    const ERAS = ["Valves", "Transistors", "Mainframes", "Microchips", "Networks"];
    const BANDS = ["band-exact", "band-close", "band-near", "band-rough", "band-off", "band-timeout"];
    const VARIANTS = { "band-exact": 3, "band-close": 3, "band-near": 2, "band-rough": 2, "band-off": 3, "band-timeout": 1 };
    const STATE_CLASSES = BANDS.concat(["v1", "v2", "v3"]);

    // y is the year the moment happened; the whole game is guessing it.
    const MOMENTS = [
      { q: "The first Apple computer went on sale in…",
        y: 1976,
        f: "Steve Wozniak's Apple I was a $666.66 circuit board - case, keyboard and screen not included." },
      { q: "IBM shipped its first personal computer in…",
        y: 1981,
        f: "The 5150 ran PC-DOS and set the shape every clone followed for a decade." },
      { q: "ENIAC, the first general-purpose electronic computer, was shown to the public in…",
        y: 1946,
        f: "18,000 vacuum tubes, about 30 tonnes, and programs patched in by hand with cables." },
      { q: "The C programming language appeared at Bell Labs in…",
        y: 1972,
        f: "Dennis Ritchie wrote it so Unix could move from one machine to another." },
      { q: "The first website went live at CERN in…",
        y: 1991,
        f: "Tim Berners-Lee published the first page on 6 August 1991. It explained what the web was." },
      { q: "Microsoft released Windows 95 in…",
        y: 1995,
        f: "The Start menu, the taskbar and a queue around the block at midnight." },
      { q: "Apple announced the first iPhone in…",
        y: 2007,
        f: "It went on sale that June. The App Store arrived a year later." },
      { q: "IBM announced the first hard disk drive, the RAMAC 305, in…",
        y: 1956,
        f: "Five megabytes, stacked on fifty platters, the size of two refrigerators." },
      { q: "The transistor was invented at Bell Labs in…",
        y: 1947,
        f: "Bardeen, Brattain and Shockley replaced the vacuum tube and shrank everything after it." },
      { q: "Ray Tomlinson sent the first networked email in…",
        y: 1971,
        f: "He picked the @ sign because it appeared in nobody's name." },
      { q: "The first computer mouse was demonstrated in…",
        y: 1968,
        f: "Douglas Engelbart's was a wooden block with two metal wheels, on a stage in San Francisco." },
      { q: "Google was founded in…",
        y: 1998,
        f: "Two Stanford students, a Menlo Park garage and a misspelling of googol." },
      { q: "The first computer game, Tennis for Two, appeared in…",
        y: 1958,
        f: "An oscilloscope, an analogue computer and two knobs at Brookhaven National Laboratory." },
      { q: "The Mosaic browser, the first popular one, arrived in…",
        y: 1993,
        f: "Inline images on a page - and the web stopped being text only." },
      { q: "Alan Turing's paper on computable numbers was published in…",
        y: 1936,
        f: "It described a machine that reads symbols from a tape. We still call it the Turing machine." },
      { q: "USB 1.0 was released in…",
        y: 1996,
        f: "12 Mbit/s, one plug, and the beginning of the end for the serial port." },
      { q: "The first 1 GHz desktop processor launched in…",
        y: 2000,
        f: "AMD's Athlon crossed the line a few days ahead of Intel's Pentium III." },
      { q: "Raspberry Pi went on sale in…",
        y: 2012,
        f: "A $35 board built to get a generation programming again." },
      { q: "Ada Lovelace's notes on the Analytical Engine were published in…",
        y: 1843,
        f: "They contain the first published algorithm, written for a machine that was never built." },
    ];

    const RANKS = [
      [700, "Kernel developer"],
      [600, "Systems engineer"],
      [450, "Power user"],
      [250, "Script kiddie"],
      [0, "Packet loss"],
    ];

    const screenEl = $(".arcade-screen");
    const scene = $("#arcadeScene");
    const walker = $("#arcadeWalker");
    const scoreEl = $("#arcadeScore");
    const roundEl = $("#arcadeRound");
    const eraEl = $("#arcadeEra");
    const pipsEl = $("#arcadePips");
    const startEl = $("#arcadeStart");
    const quizEl = $("#arcadeQuiz");
    const qEl = $("#arcadeQ");
    const formEl = $("#arcadeForm");
    const guessEl = $("#arcadeGuess");
    const clockEl = $("#arcadeClock");
    const clockFill = $("#arcadeClockFill");
    const revealEl = $("#arcadeReveal");
    const guessOut = $("#arcadeGuessOut");
    const answerOut = $("#arcadeAnswerOut");
    const ptsEl = $("#arcadePts");
    const factEl = $("#arcadeFact");
    const nextBtn = $("#arcadeNext");
    const endEl = $("#arcadeEnd");
    const startBtn = $("#arcadePlay");
    const againBtn = $("#arcadePlay2");
    const bankEl = $("#arcadeBank");
    const rankEl = $("#arcadeRank");
    const dotsEl = $("#arcadeDots");

    let deck = [];
    let turn = 0;
    let score = 0;
    let results = [];
    let locked = true;
    let frame = 0;
    let endsAt = 0;
    let lastSpot = null;
    let progress = 0;            // 0..1 of the way along the road
    let bandTimer = 0;

    function shuffle(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const held = copy[i];
        copy[i] = copy[j];
        copy[j] = held;
      }
      return copy;
    }

    // Progress, not rounds, decides both the walk and the sky: a way-off guess
    // barely moves him, an exact one carries him a full seventh of the road.
    function drawWalker() {
      const x = WALK_FROM + progress * (WALK_TO - WALK_FROM);
      walker.style.transform = "translate(" + x.toFixed(1) + "px, " + WALKER_Y + "px)";
    }

    function resetWalk() {
      progress = 0;
      walker.style.transition = "none";
      drawWalker();
      void walker.getBoundingClientRect();
      walker.style.transition = "";
    }

    function travel(points) {
      progress = Math.min(1, progress + (points / 100) / ROUNDS);
      drawWalker();
      setEra(progress);
    }

    function setEra(at) {
      const era = Math.min(4, Math.floor(at * 5));
      scene.className = "arcade-scene era-" + (era + 1);
      eraEl.textContent = ERAS[era];
    }

    function buildPips() {
      pipsEl.innerHTML = "";
      for (let i = 0; i < ROUNDS; i += 1) pipsEl.appendChild(document.createElement("i"));
    }

    function pipClass(points) {
      if (points === 100) return "on";
      if (points >= 30) return "close";
      return "miss";
    }

    function markPip(index, points) {
      const pip = pipsEl.children[index];
      if (!pip) return;
      pip.className = pipClass(points);
      void pip.offsetWidth;
      pip.classList.add("pop");
    }

    // Bands widen for older moments: guessing 1843 within a couple of years is
    // much harder than guessing 2012 within a couple of years.
    function judge(guess, year) {
      const diff = Math.abs(guess - year);
      const span = year < 1900 ? 12 : year < 1950 ? 5 : 3;
      if (diff === 0) return { points: 100, band: "Exact", kind: "band-exact" };
      if (diff <= span) return { points: 85, band: "Close", kind: "band-close" };
      if (diff <= span * 4) return { points: 60, band: "Near", kind: "band-near" };
      if (diff <= span * 10) return { points: 30, band: "Rough", kind: "band-rough" };
      return { points: 10, band: "Way off", kind: "band-off" };
    }

    // One class on the screen drives the whole reaction: the flash over the sky,
    // the traveller's jump or stumble, and the shake on a bad guess.
    function react(kind) {
      STATE_CLASSES.forEach((name) => screenEl.classList.remove(name));
      void screenEl.offsetWidth;
      const count = VARIANTS[kind] || 1;
      screenEl.classList.add(kind, "v" + (1 + Math.floor(Math.random() * count)));
      clearTimeout(bandTimer);
      bandTimer = setTimeout(() => STATE_CLASSES.forEach((name) => screenEl.classList.remove(name)), 1500);
    }

    // He grins when the year lands, and frowns with a tear when it does not.
    function setMood(points) {
      walker.classList.remove("mood-happy", "mood-sad");
      walker.classList.add(points >= 85 ? "mood-happy" : "mood-sad");
    }

    function clearMood() {
      walker.classList.remove("mood-happy", "mood-sad");
    }

    // An interval rather than animation frames: a backgrounded tab stops
    // painting, and the moment should still close when its time is up.
    function stopClock() {
      if (frame) clearInterval(frame);
      frame = 0;
    }

    function runClock() {
      stopClock();
      endsAt = Date.now() + CLOCK * 1000;
      const tick = () => {
        const left = Math.max(0, endsAt - Date.now());
        clockFill.textContent = String(Math.ceil(left / 1000));
        clockEl.classList.toggle("warn", left <= 6000);
        if (left <= 0) {
          stopClock();
          answer(-1);
        }
      };
      tick();
      frame = setInterval(tick, 100);
    }

    function renderTurn() {
      const item = deck[turn];
      locked = false;
      qEl.textContent = item.q;
      roundEl.textContent = String(turn + 1);
      guessEl.value = "";
      guessEl.disabled = false;
      formEl.hidden = false;
      revealEl.hidden = true;
      formEl.classList.remove("nudge");
      setTimeout(() => guessEl.focus(), 80);
      runClock();
    }

    function nudge() {
      formEl.classList.remove("nudge");
      void formEl.offsetWidth;
      formEl.classList.add("nudge");
      guessEl.focus();
    }

    function submitGuess() {
      if (locked) return;
      const guess = parseInt(guessEl.value, 10);
      if (!guess || guess < 1700 || guess > 2100) {
        nudge();
        return;
      }
      answer(guess);
    }

    function answer(guess) {
      if (locked) return;
      locked = true;
      stopClock();

      const item = deck[turn];
      const timedOut = guess === -1;
      const verdict = timedOut
        ? { points: 0, band: "Out of time", kind: "band-timeout" }
        : judge(guess, item.y);

      score += verdict.points;
      results[turn] = verdict.points;
      scoreEl.textContent = String(score);
      markPip(turn, verdict.points);
      travel(verdict.points);
      react(verdict.kind);
      setMood(verdict.points);

      guessEl.disabled = true;
      guessOut.textContent = timedOut ? "—" : String(guess);
      answerOut.textContent = String(item.y);
      ptsEl.textContent = verdict.band + " · +" + verdict.points;
      ptsEl.className = "arcade-points" + (verdict.points < 30 ? " zero" : "");
      factEl.textContent = item.f;
      formEl.hidden = true;
      revealEl.hidden = false;

      nextBtn.textContent = turn === ROUNDS - 1 ? "See the result ▶" : "Next ▶";
      nextBtn.focus();
    }

    function finish() {
      locked = true;
      stopClock();
      quizEl.hidden = true;
      startEl.hidden = true;
      endEl.hidden = false;
      bankEl.textContent = score + " / " + ROUNDS * 100;
      rankEl.textContent = RANKS.find((rank) => score >= rank[0])[1];
      dotsEl.innerHTML = "";
      results.forEach((points) => {
        const dot = document.createElement("i");
        dot.className = pipClass(points);
        dotsEl.appendChild(dot);
      });
      againBtn.focus();
    }

    function next() {
      turn += 1;
      if (turn >= ROUNDS) {
        finish();
        return;
      }
      renderTurn();
    }

    function start() {
      deck = shuffle(MOMENTS).slice(0, ROUNDS);
      turn = 0;
      score = 0;
      results = [];
      scoreEl.textContent = "0";
      roundEl.textContent = "1";
      buildPips();
      resetWalk();
      setEra(0);
      clearMood();
      startEl.hidden = true;
      endEl.hidden = true;
      quizEl.hidden = false;
      renderTurn();
    }

    function showStart() {
      stopClock();
      locked = true;
      deck = [];
      score = 0;
      turn = 0;
      scoreEl.textContent = "0";
      roundEl.textContent = "1";
      buildPips();
      resetWalk();
      setEra(0);
      clearMood();
      startEl.hidden = false;
      quizEl.hidden = true;
      endEl.hidden = true;
      startBtn.focus();
    }

    function openArcade() {
      if (arcadeModal.classList.contains("open")) return;
      lastSpot = document.activeElement;
      arcadeModal.classList.add("open");
      arcadeModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      showStart();
    }

    function closeArcade() {
      if (!arcadeModal.classList.contains("open")) return;
      stopClock();
      clearTimeout(bandTimer);
      STATE_CLASSES.forEach((name) => screenEl.classList.remove(name));
      arcadeModal.classList.remove("open");
      arcadeModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastSpot && lastSpot.focus) lastSpot.focus();
    }

    guessEl.addEventListener("input", () => {
      guessEl.value = guessEl.value.replace(/\D/g, "").slice(0, 4);
    });

    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      submitGuess();
    });

    arcadeOpenBtn.addEventListener("click", openArcade);
    $("#arcadeClose").addEventListener("click", closeArcade);
    startBtn.addEventListener("click", start);
    againBtn.addEventListener("click", start);
    nextBtn.addEventListener("click", next);

    document.addEventListener("keydown", (e) => {
      if (!arcadeModal.classList.contains("open")) return;
      if (e.key === "Escape") { closeArcade(); return; }
      if (!startEl.hidden) {
        if (e.key === "Enter" || e.key === " ") {
          if (document.activeElement !== startBtn) { e.preventDefault(); start(); }
        }
        return;
      }
      if (!revealEl.hidden) {
        if ((e.key === "Enter" || e.key === " ") && document.activeElement !== nextBtn) {
          e.preventDefault();
          next();
        }
      }
    });
  }
})();
