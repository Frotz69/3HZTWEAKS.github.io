/* 3HZ — shared motion. No dependencies, no build step. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* reveal on scroll */
  const revealables = [...document.querySelectorAll('.reveal')]
  if (!('IntersectionObserver' in window) || reduce) {
    revealables.forEach((el) => el.classList.add('in'))
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('in')
          io.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    revealables.forEach((el) => io.observe(el))
  }

  /* count-up numbers: <b data-count="168">168</b> */
  const counters = [...document.querySelectorAll('[data-count]')]
  const runCount = (el) => {
    const target = Number(el.dataset.count)
    if (!Number.isFinite(target) || reduce) return
    const suffix = el.dataset.suffix || ''
    const start = performance.now()
    const dur = 1100
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = String(Math.round(target * eased)) + suffix
      if (t < 1) requestAnimationFrame(tick)
    }
    el.textContent = '0' + suffix
    requestAnimationFrame(tick)
  }
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          runCount(entry.target)
          cio.unobserve(entry.target)
        }
      },
      { threshold: 0.5 }
    )
    counters.forEach((el) => cio.observe(el))
  }

  /* pointer tilt + cursor glow for [data-tilt] */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const max = Number(card.dataset.tilt) || 6
      card.addEventListener('pointermove', (event) => {
        const r = card.getBoundingClientRect()
        const px = (event.clientX - r.left) / r.width
        const py = (event.clientY - r.top) / r.height
        card.style.setProperty('--mx', `${px * 100}%`)
        card.style.setProperty('--my', `${py * 100}%`)
        if (card.classList.contains('pcard')) {
          card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateY(-6px)`
        }
      })
      card.addEventListener('pointerleave', () => {
        card.style.transform = ''
      })
    })
  }

  /* subtle parallax on [data-parallax] */
  const layers = [...document.querySelectorAll('[data-parallax]')]
  if (!reduce && layers.length) {
    let raf = 0
    const apply = () => {
      raf = 0
      const vh = window.innerHeight
      for (const el of layers) {
        const rect = el.getBoundingClientRect()
        if (rect.bottom < -200 || rect.top > vh + 200) continue
        const speed = Number(el.dataset.parallax) || 0.06
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed
        el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    apply()
  }

  /* inertial wheel scrolling — eases the page towards the wheel target instead of
     stepping one notch at a time. Touch, reduced-motion and modified wheel events
     are left to the browser. */
  /* input-driven easing stays on even with reduced motion: the page only moves
     because the user asked it to, and it never moves on its own. */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let target = window.scrollY
    let raf = null
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const clamp = (value) => Math.min(maxY(), Math.max(0, value))
    const step = () => {
      const distance = target - window.scrollY
      if (Math.abs(distance) < 0.6) {
        window.scrollTo(0, target)
        raf = null
        return
      }
      window.scrollTo(0, window.scrollY + distance * 0.18)
      raf = requestAnimationFrame(step)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step)
    }
    window.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaY) < 1) return
        const delta = event.deltaMode === 1 ? event.deltaY * 18 : event.deltaY
        event.preventDefault()
        target = clamp(target + delta)
        kick()
      },
      { passive: false }
    )
    /* keep the target in sync when the page moves by scrollbar, keyboard or anchor */
    window.addEventListener(
      'scroll',
      () => {
        if (!raf) target = window.scrollY
      },
      { passive: true }
    )
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href')
        if (!href || href.length < 2) return
        const el = document.querySelector(href)
        if (!el) return
        event.preventDefault()
        target = clamp(el.getBoundingClientRect().top + window.scrollY - 84)
        kick()
      })
    })
  }

  /* seamless marquee: two identical groups, translated by exactly half */
  const marqueeTrack = document.querySelector('.marquee-track')
  if (marqueeTrack) {
    let groups = [...marqueeTrack.querySelectorAll('.marquee-group')]
    if (groups.length === 0) {
      const items = marqueeTrack.innerHTML
      marqueeTrack.innerHTML = `<span class="marquee-group">${items}</span>`
      groups = [marqueeTrack.querySelector('.marquee-group')]
    }
    /* the track translates by exactly -50%, which only loops seamlessly with two copies */
    while (marqueeTrack.querySelectorAll('.marquee-group').length < 2) {
      const clone = groups[0].cloneNode(true)
      clone.setAttribute('aria-hidden', 'true')
      marqueeTrack.appendChild(clone)
    }
  }

  /* nav shrink + mobile menu */
  const nav = document.getElementById('nav')
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const burger = document.getElementById('burger')
    if (burger) {
      burger.addEventListener('click', () => {
        const open = nav.classList.toggle('open')
        burger.setAttribute('aria-expanded', String(open))
      })
      nav.querySelectorAll('.nav-links a, .nav-links button, .nav-cta a, .nav-cta button').forEach((link) =>
        link.addEventListener('click', () => {
          nav.classList.remove('open')
          burger.setAttribute('aria-expanded', 'false')
        })
      )
    }
  }

  /* year stamp */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear())
  })

  /* page fade-in */
  document.body.classList.add('loaded')
})()
