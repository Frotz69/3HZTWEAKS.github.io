# 3hz Tweaks — website

A static marketing site for 3hz Tweaks, built to be dropped straight into the
`3HZTWEAKS.github.io` repository (GitHub Pages) with no build step.

```
website/
├── index.html
├── assets/
│   ├── styles.css
│   ├── app.js
│   └── img/        dashboard.png, tweaks.png, library.png, assistant.png, favicon.svg
└── README.md
```

Everything is plain HTML/CSS/JS. There is no npm, no bundler and no server
code — open `index.html` directly or serve the folder.

## Accounts, keys and the API

The header carries **Sign in** and **Create account**, and everything account
shaped talks to the Worker in `accounts_api/` (its preview URL sits in
`CONFIG.api` at the top of `assets/app.js`; `?api=http://127.0.0.1:8787` points
a local page at `wrangler dev`).

The page itself never invents a key:

- **Create account** takes an email and a password, then the Worker mails a
  6-digit code that the page asks for before the session starts.
- **Buy Pro (€1) or Ultra (€3)** asks for an email, then hands off to Stripe's
  hosted checkout for a monthly subscription. The Worker mails a real
  `3HZ-XXXX-XXXX-XXXX` licence key for that plan; the buyer lands back on
  `success.html`, which polls the order and shows the same key.
- While Stripe is not configured on the Worker (`/api/checkout` answers 501) the
  page falls back to the card-less handout, so the buttons keep working during
  setup.
- Only a purchase issues a key. The free plan has no key to redeem, and the old
  browser-side generator is gone: keys it produced are refused by the API.

---

## Publishing to GitHub Pages

The live site is <https://frotz69.github.io/3HZTWEAKS.github.io/> (repo
`Frotz69/3HZTWEAKS.github.io`). A clone of it sits next to this folder in
`Optimize/ghpages`, serving the repository root with a static Pages workflow,
so publishing is a copy and a push:

```bash
cp -r website/index.html website/assets website/success.html website/download ghpages/
cd ghpages
git add -A
git commit -m "Update the landing page"
git push origin main
```

`website/download` holds the Windows build the buttons hand out, so it travels
with the page.

The workflow in `.github/workflows/deploy-pages.yml` uploads the repository as
is (`.nojekyll` keeps Pages from transforming it). The site is live about a
minute after the push.

### The `/qa` copy

`qa/` is a second copy of the landing page at
<https://frotz69.github.io/3HZTWEAKS.github.io/qa/>, for trying a change without
changing what the root URL shows. Pages can only serve one tree, so `qa/` has
the same `index.html` plus its own `assets/`, while its download links point at
`../download/` so the 5 MB of archives is not duplicated in git.

It is a copy, not a redirect - refresh it whenever the page changes:

```bash
cp website/index.html ghpages/index.html
mkdir -p ghpages/qa
cp website/index.html ghpages/qa/index.html
rm -rf ghpages/qa/assets && cp -r website/assets ghpages/qa/assets
sed -i 's|href="download/|href="../download/|g' ghpages/qa/index.html
sed -i 's|downloadUrl: "download/|downloadUrl: "../download/|' ghpages/qa/assets/app.js
```

Local preview:

```bash
cd website
python -m http.server 8942
# open http://127.0.0.1:8942/
```

---

## The downloads

The Download buttons do not point at a GitHub release - releases were never
published, so the button used to land on an empty page. The build is served from
this repository instead:

- `download/3hzTweaks-Setup.zip` (~3 MB) - the installer plus the `app`
  folder it copies from. This is what `CONFIG.downloadUrl` points at. The button
  carries `download="3hzTweaks-Setup.zip"` so every browser saves the same
  filename instead of opening the archive in a tab.
- `download/3hzTweaks-Portable.zip` (~2 MB) - `3hzTweaks.exe` with
  `Inter.ttf` and `fa-solid-900.ttf`; the app loads those fonts from its own
  folder, so they have to ship together and the .exe alone would fall back to a
  system font.

Rebuild them after any app change (close the app first, or the link step fails):

```bash
cd native && cmake --build build -j 4 && cd ..
python tools/pack_release.py --publish    # packs and mirrors into ghpages/
```

It prints the sha256 of both zips, which is what the FAQ quotes - update those
two hashes in `index.html` whenever a new build is packed.

## Connecting real payments

There is no payment link to paste: the Buy buttons call the Worker, which opens
its own monthly Stripe Checkout Session and sends the buyer to Stripe's hosted
page. Turning it on is four secrets on the Worker — the full walkthrough is in
[../accounts_api/README.md](../accounts_api/README.md) ("Turning on card
payments").

What the page itself needs is only `CONFIG.api` (the Worker URL) and
`CONFIG.downloadUrl` (the installer). Everything else — prices, plans, keys —
lives on the Worker, so a price change is a Stripe change, not a site change.

`success.html` is the page Stripe returns the buyer to
(`?order=<id>`); it polls `/api/order` and shows the key once the webhook has
landed. It is noindex and takes `?api=` like the rest of the site, so it can be
tested against a local `wrangler dev`.

---

## Editing the tiers

Prices and feature lists live in two places, on purpose:

- `index.html` — the pricing cards (copy, bullets, prices).
- `assets/app.js` — the `TIERS` object used by the checkout summary
  (`price`, `billing`).

Current model: **Free €0 · Pro €1/month · Ultra €3/month**. Pro opens the whole
tweak catalogue (69 of the 168 tweaks are free); **3HZ AI is Ultra-only**. Keep
the cards and `TIERS` in sync when a price or a bullet
changes.

## Accounts and keys

The site no longer invents a licence key in the browser. `assets/app.js` talks
to the Worker in `../accounts_api/`:

- the header buttons open the account card (sign in · create account ·
  emailed 6-digit code · your plan and key);
- every pricing button opens checkout, which asks for an email and nothing else
  during the beta — the Worker mails the key and shows it on screen;
- `CONFIG.api` at the top of `app.js` is the API base. Append
  `?api=http://127.0.0.1:8787` to use a local `wrangler dev` instead.

Until the Resend domain is verified, mail only reaches the Resend account
owner's address — see `accounts_api/README.md` for the three DNS records.

---

## Notes

- Fonts: Inter from Google Fonts. Swap to a self-hosted copy if you would
  rather not call a third party.
- Animations: scroll reveals, counters, pointer tilt on the product shots, a
  marquee, FAQ accordion and the hero glow. All of them back off automatically
  under `prefers-reduced-motion`.
- Images are real screenshots of the app at 1280×800. Replace them with new
  captures and keep the aspect ratio; the frames crop with `object-fit`-free
  plain `<img>` scaling, so 16:10 is the safe shape.
- The site is dark-only, matching the app.
