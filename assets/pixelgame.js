/* 3HZ — "Spike Run": a small pixel runner opened from the nav. No deps, no build.
   Canvas is drawn at 192x120 and scaled up with nearest-neighbour, so every
   pixel stays square. Score is distance; the best run is kept per browser. */
(() => {
  const trigger = document.getElementById('game-open')
  if (!trigger) return

  const BEST_KEY = '3hz.pixel.best'
  const W = 192
  const H = 120
  const GROUND = 100
  const PLAYER = { x: 22, w: 11, h: 16 }
  const GRAVITY = 1500
  const JUMP = 470

  const modal = document.createElement('div')
  modal.className = 'pg'
  modal.hidden = true
  modal.innerHTML = `
    <button class="pg-back" type="button" aria-label="Close game"></button>
    <div class="pg-card" role="dialog" aria-modal="true" aria-labelledby="pg-title">
      <div class="pg-head">
        <span class="pg-title" id="pg-title">SPIKE RUN</span>
        <span class="pg-scores">
          <span>SCORE <b data-score>0</b></span>
          <span>BEST <b data-best>0</b></span>
        </span>
        <button class="pg-close" type="button" aria-label="Close game">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="pg-stage">
        <canvas width="${W}" height="${H}" role="img" aria-label="Pixel runner: a small figure jumping over blocks"></canvas>
        <div class="pg-over" data-over>
          <span class="big" data-over-title>RUN IT</span>
          <p data-over-text>Space, the up arrow, or a tap sends the runner over each spike. It speeds up as you go.</p>
          <button class="btn primary small" type="button" data-start>Start</button>
        </div>
      </div>
      <div class="pg-hint"><kbd>Space</kbd><kbd>↑</kbd> jump <span aria-hidden="true">·</span> <kbd>Esc</kbd> close <span aria-hidden="true">·</span> best score stays in this browser</div>
    </div>`
  document.body.appendChild(modal)

  const canvas = modal.querySelector('canvas')
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  const el = {
    score: modal.querySelector('[data-score]'),
    best: modal.querySelector('[data-best]'),
    over: modal.querySelector('[data-over]'),
    overTitle: modal.querySelector('[data-over-title]'),
    overText: modal.querySelector('[data-over-text]'),
    start: modal.querySelector('[data-start]')
  }

  let best = 0
  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    best = 0
  }
  el.best.textContent = String(best)

  const game = {
    running: false,
    over: false,
    started: false,
    vy: 0,
    lift: 0,
    speed: 112,
    distance: 0,
    score: 0,
    spikes: [],
    nextSpawn: 150,
    stars: Array.from({ length: 14 }, (_, i) => ({
      x: (i * 53 + 17) % W,
      y: 8 + ((i * 29) % 54),
      s: i % 5 === 0 ? 2 : 1
    })),
    raf: 0,
    last: 0
  }

  const reset = () => {
    game.running = false
    game.over = false
    game.started = false
    game.vy = 0
    game.lift = 0
    game.speed = 112
    game.distance = 0
    game.score = 0
    game.spikes = []
    game.nextSpawn = 150
    el.score.textContent = '0'
    draw()
  }

  const drawPixel = (x, y, w, h, color) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }

  const draw = () => {
    drawPixel(0, 0, W, H, '#0b1119')

    for (const star of game.stars) {
      drawPixel(star.x, star.y, star.s, star.s, star.s === 2 ? '#2b3d52' : '#1d2b3b')
    }

    // ground slab plus a lighter hairline
    drawPixel(0, GROUND, W, H - GROUND, '#121a24')
    drawPixel(0, GROUND, W, 1, '#27384c')
    for (let x = (Math.round(game.distance) % 16) - 16; x < W; x += 16) {
      drawPixel(x, GROUND + 5, 6, 1, '#1d2835')
    }

    for (const spike of game.spikes) {
      const top = GROUND - spike.h
      drawPixel(spike.x, top, spike.w, spike.h, '#3a4b62')
      drawPixel(spike.x, top, spike.w, 2, '#6d86a2')
      drawPixel(spike.x, top + 4, 2, spike.h - 6, '#2b3a4d')
    }

    const feet = GROUND - game.lift
    const head = feet - PLAYER.h
    drawPixel(PLAYER.x, head, PLAYER.w, PLAYER.h, '#5ba8f0')
    drawPixel(PLAYER.x + 2, head + 3, 3, 3, '#0b1119')
    drawPixel(PLAYER.x + 2, head + 9, PLAYER.w - 4, 2, '#2f6fae')

    if (game.over) {
      drawPixel(0, 0, W, H, 'rgba(7,9,13,0.45)')
    }
  }

  const finish = () => {
    game.running = false
    game.over = true
    if (game.score > best) {
      best = game.score
      el.best.textContent = String(best)
      try {
        localStorage.setItem(BEST_KEY, String(best))
      } catch {
        /* storage can be blocked; the run still counts for this session */
      }
      el.overTitle.textContent = `NEW BEST · ${best}`
    } else {
      el.overTitle.textContent = `HIT AT ${game.score}`
    }
    el.overText.textContent = 'Space, the up arrow, or a tap restarts.'
    el.start.textContent = 'Run again'
    el.over.hidden = false
    draw()
  }

  const jump = () => {
    if (game.over) {
      reset()
      start()
      return
    }
    if (!game.running) {
      start()
      return
    }
    if (game.lift <= 0.5) {
      game.vy = JUMP
    }
  }

  const step = (dt) => {
    game.vy -= GRAVITY * dt
    game.lift += game.vy * dt
    if (game.lift <= 0) {
      game.lift = 0
      game.vy = 0
    }

    game.speed = Math.min(320, game.speed + 6 * dt)
    game.distance += game.speed * dt
    game.score = Math.floor(game.distance / 10)

    game.nextSpawn -= game.speed * dt
    if (game.nextSpawn <= 0) {
      const w = 6 + Math.floor(Math.random() * 5)
      const h = 12 + Math.floor(Math.random() * 13)
      game.spikes.push({ x: W + 4, w, h })
      game.nextSpawn = 92 + Math.random() * 78 + game.speed * 0.12
    }

    for (const spike of game.spikes) spike.x -= game.speed * dt
    game.spikes = game.spikes.filter((spike) => spike.x + spike.w > -6)

    const px = PLAYER.x + 1
    const py = GROUND - game.lift - PLAYER.h + 1
    const pw = PLAYER.w - 2
    const ph = PLAYER.h - 2
    for (const spike of game.spikes) {
      const sx = spike.x + 1
      const sy = GROUND - spike.h
      if (px < sx + spike.w - 1 && px + pw > sx && py < GROUND && py + ph > sy) {
        finish()
        return
      }
    }

    const shown = String(game.score)
    if (el.score.textContent !== shown) el.score.textContent = shown
  }

  const frame = (now) => {
    if (!game.running) return
    if (!game.last) game.last = now
    let dt = (now - game.last) / 1000
    game.last = now
    if (dt > 0.05) dt = 0.05
    step(dt)
    draw()
    if (game.running) game.raf = requestAnimationFrame(frame)
  }

  const start = () => {
    if (game.running) return
    game.started = true
    game.running = true
    game.over = false
    game.last = 0
    el.over.hidden = true
    game.raf = requestAnimationFrame(frame)
  }

  /* A background tab keeps its run: the loop parks, then picks up on return
     without a modal, so the game never freezes mid-jump behind an overlay. */
  const suspend = () => {
    if (!game.running) return
    game.running = false
    cancelAnimationFrame(game.raf)
  }

  const resume = () => {
    if (modal.hidden || game.over || !game.started || game.running) return
    game.running = true
    game.last = 0
    el.over.hidden = true
    game.raf = requestAnimationFrame(frame)
  }

  el.start.addEventListener('click', () => {
    if (game.over) {
      reset()
      start()
    } else if (game.started) {
      el.over.hidden = true
      resume()
    } else start()
  })

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    jump()
  })

  const open = () => {
    modal.hidden = false
    document.body.style.overflow = 'hidden'
    reset()
    el.start.focus()
  }

  const close = () => {
    modal.hidden = true
    document.body.style.overflow = ''
    game.running = false
    cancelAnimationFrame(game.raf)
    reset()
    trigger.focus()
  }

  modal.querySelector('.pg-close').addEventListener('click', close)
  modal.querySelector('.pg-back').addEventListener('click', close)

  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'Enter') {
      if (event.target === el.start && event.key === 'Enter') return
      event.preventDefault()
      jump()
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend()
    else resume()
  })

  trigger.addEventListener('click', open)

  reset()
})()
