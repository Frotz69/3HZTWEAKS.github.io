# 3HZTWEAKS.github.io

The landing page for **3hz Tweaks**, served by GitHub Pages at
<https://frotz69.github.io/3HZTWEAKS.github.io/>.

Plain HTML, CSS and JavaScript — no build step. `index.html` is the page,
`success.html` is where Stripe returns a buyer (it polls the Worker for the
licence key), and everything else lives in `assets/`. Pushes to `main` deploy
through `.github/workflows/deploy-pages.yml`. `.nojekyll` keeps the files
exactly as committed.
