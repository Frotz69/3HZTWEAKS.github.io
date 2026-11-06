/* 3HZ Client — ClickGUI demo, modelled on the client's WindowClickGui.svelte:
   category rail, module list with state dots, per-module settings, status foot.

   The Resource Packs category is the one live part: it lists resource packs from
   Modrinth's public API, downloads them, and repairs the three things that make a
   pack look like it "did nothing" — a wrapper folder, a stale pack format, and the
   1.13 texture folder rename. Local state only otherwise; the real window talks to
   the client over its own bridge. */
(() => {
  const root = document.getElementById('clickgui-demo')
  if (!root) return

  const PACK_CATEGORY = 'Resource Packs'
  const CATEGORIES = ['Combat', 'Movement', 'Render', 'World', 'Player', 'Misc', PACK_CATEGORY]

  const range = (label, min, max, value, suffix = '') => ({ type: 'range', label, min, max, value, suffix })
  const bool = (label, value = false) => ({ type: 'bool', label, value })

  const MODULES = {
    Combat: [
      { id: 'killaura', name: 'KillAura', desc: 'Attacks entities in reach.', tag: 'legit', key: 'R', settings: [range('Range', 2, 6, 3.2, ' blocks'), range('CPS', 1, 20, 12, ' /s'), bool('Only while sprinting')] },
      { id: 'autoclicker', name: 'AutoClicker', desc: 'Holds attack for you at a fixed rate.', settings: [range('CPS', 1, 20, 10, ' /s'), bool('Randomise timing', true)] },
      { id: 'velocity', name: 'Velocity', desc: 'Scales knockback on hit.', settings: [range('Horizontal', 0, 100, 40, '%'), range('Vertical', 0, 100, 60, '%')] },
      { id: 'criticals', name: 'Criticals', desc: 'Forces a critical hit on every swing.', tag: 'bypass', settings: [bool('Only on ground', true), range('Chance', 0, 100, 100, '%')] }
    ],
    Movement: [
      { id: 'sprint', name: 'Sprint', desc: 'Keeps you sprinting without holding the key.', key: 'V', settings: [bool('Omni sprint'), bool('Only on ground', true)] },
      { id: 'safewalk', name: 'SafeWalk', desc: 'Stops you at block edges.', settings: [bool('Sneak at edge', true)] },
      { id: 'step', name: 'Step', desc: 'Walks up full blocks.', settings: [range('Height', 1, 2.5, 1.5, ' blocks'), bool('Only when sprinting', true)] },
      { id: 'noslow', name: 'NoSlow', desc: 'Keeps speed while using items.', settings: [bool('While eating', true), bool('While blocking', true)] }
    ],
    Render: [
      { id: 'esp', name: 'ESP', desc: 'Outlines entities through walls.', tag: 'visual', settings: [range('Range', 16, 128, 64, ' blocks'), bool('Players', true), bool('Mobs')] },
      { id: 'tracers', name: 'Tracers', desc: 'Draws a line to each target.', settings: [range('Range', 16, 128, 96, ' blocks'), bool('Only visible')] },
      { id: 'hud', name: 'HUD', desc: 'Array list of enabled modules.', settings: [range('Scale', 50, 150, 100, '%'), bool('Show disabled', true)] },
      { id: 'nametags', name: 'Nametags', desc: 'Larger names with health.', settings: [range('Scale', 50, 200, 100, '%'), bool('Show health', true)] }
    ],
    World: [
      { id: 'scaffold', name: 'Scaffold', desc: 'Places blocks under you.', tag: 'bypass', settings: [range('Delay', 0, 500, 80, ' ms'), bool('Tower', true)] },
      { id: 'autotool', name: 'AutoTool', desc: 'Switches to the best tool.', settings: [bool('Swap back', true)] },
      { id: 'nuker', name: 'Nuker', desc: 'Breaks blocks around you.', settings: [range('Range', 2, 6, 4, ' blocks'), range('Delay', 0, 500, 120, ' ms')] },
      { id: 'xray', name: 'XRay', desc: 'Shows only selected ores.', tag: 'visual', settings: [bool('Diamond', true), bool('Ancient debris', true), bool('Iron')] }
    ],
    Player: [
      { id: 'cheststealer', name: 'ChestStealer', desc: 'Empties containers into your inventory.', settings: [range('Delay', 0, 300, 60, ' ms'), bool('Skip full stacks', true)] },
      { id: 'autoarmor', name: 'AutoArmor', desc: 'Equips the best armour.', settings: [bool('Keep armour on', true)] },
      { id: 'invmanager', name: 'InvManager', desc: 'Sorts and drops junk.', settings: [bool('Drop junk', true), bool('Keep tools', true)] },
      { id: 'fastplace', name: 'FastPlace', desc: 'Removes the block-place delay.', settings: [bool('Only blocks', true)] }
    ],
    Misc: [
      { id: 'clickgui', name: 'ClickGUI', desc: 'This window.', settings: [range('Scale', 50, 150, 100, '%'), bool('Blur background', true)] },
      { id: 'middleclick', name: 'MiddleClick', desc: 'Middle click to add a friend.', settings: [bool('Friends only', true)] },
      { id: 'panic', name: 'Panic', desc: 'Disables every module at once.', settings: [bool('Ask first', true)] },
      { id: 'spammer', name: 'Spammer', desc: 'Repeats a message on a delay.', settings: [range('Delay', 500, 5000, 2500, ' ms')] }
    ]
  }

  const ALL = Object.entries(MODULES).flatMap(([category, modules]) => modules.map((module) => ({ ...module, category })))
  const DEFAULTS = ['sprint', 'esp', 'hud', 'clickgui']

  const state = {
    category: 'Combat',
    query: '',
    selectedId: ALL[0].id,
    enabled: new Set(DEFAULTS),
    values: Object.fromEntries(ALL.map((module) => [module.id, module.settings.map((setting) => setting.value)])),
    packs: {
      version: '26.3',
      query: '',
      hits: [],
      offset: 0,
      total: 0,
      loading: false,
      loaded: false,
      error: '',
      status: {},
      busy: {}
    }
  }

  /* ------------------------------------------------------------ resource packs */

  // pack_format per version, from the wiki's table; 26.x also reads min/max ranges.
  const PACK_FORMATS = { '26.3': 97, '1.21.11': 75, '1.21.4': 46, '1.20.1': 15, '1.16.5': 6, '1.12.2': 3, '1.8.9': 1 }
  const PACK_VERSIONS = Object.keys(PACK_FORMATS)
  const API = 'https://api.modrinth.com/v2'
  const PAGE = 9
  const REWRITE_LIMIT = 48 * 1024 * 1024
  const packs = state.packs
  let searchTimer = 0

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
  const compact = (n) => {
    if (!Number.isFinite(n)) return '—'
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
    return String(n)
  }
  const safeName = (value) => String(value || 'resource-pack').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'resource-pack'

  const getJSON = async (url) => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('Modrinth ' + res.status)
    return res.json()
  }
  const packVersions = (slug, version) =>
    getJSON(`${API}/project/${slug}/version` + (version ? `?game_versions=${encodeURIComponent(JSON.stringify([version]))}` : ''))

  const loadPacks = async (reset) => {
    if (packs.loading) return
    if (reset) {
      packs.hits = []
      packs.offset = 0
      packs.total = 0
      packs.error = ''
      renderPackGrid()
    }
    packs.loading = true
    renderPackNote()
    // no version facet: packs without a build for the selected version still show,
    // flagged as "convert" instead of being hidden
    const facets = JSON.stringify([['project_type:resourcepack']])
    const url = `${API}/search?limit=${PAGE}&offset=${packs.offset}&index=relevance` +
      `&query=${encodeURIComponent(packs.query)}&facets=${encodeURIComponent(facets)}`
    try {
      const data = await getJSON(url)
      const fresh = (data.hits || []).filter((hit) => !packs.hits.some((seen) => seen.slug === hit.slug))
      packs.hits.push(...fresh)
      packs.offset += (data.hits || []).length
      packs.total = data.total_hits || packs.hits.length
      packs.loaded = true
      packs.error = ''
      renderPackGrid()
      hydrateAvailability()
    } catch (err) {
      packs.error = err && err.message ? err.message : 'Request failed'
    }
    packs.loading = false
    renderPackNote()
  }

  // ask each shown project whether it has a build for the selected version, so the
  // card can say "convert" before you click instead of after the download starts
  const hydrateAvailability = async () => {
    const version = packs.version
    const targets = packs.hits.filter((hit) => hit.checked !== version)
    targets.forEach((hit) => { hit.checked = version; hit.available = null })
    await Promise.all(targets.map(async (hit) => {
      try {
        const list = await packVersions(hit.slug, version)
        hit.available = Array.isArray(list) && list.length > 0
      } catch {
        hit.available = null
      }
    }))
    if (packs.version === version) renderPackGrid()
  }

  const setPackStatus = (slug, text, kind) => {
    packs.status[slug] = { text, kind: kind || '' }
    const line = root.querySelector(`[data-pack-status="${slug}"]`)
    if (line) {
      line.textContent = text
      line.dataset.kind = kind || ''
      line.title = text
    }
    const button = root.querySelector(`[data-pack="${slug}"]`)
    if (button) button.disabled = kind === 'work'
  }

  const loadJSZip = () => new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip)
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
    script.onload = () => (window.JSZip ? resolve(window.JSZip) : reject(new Error('zip library missing')))
    script.onerror = () => reject(new Error('zip library failed to load'))
    document.head.appendChild(script)
  })

  /* The repair pass. Returns a rebuilt zip plus a plain-language list of what was
     wrong with the original — which is usually the answer to "the pack changed
     nothing". */
  const rebuildPack = async (buffer, { version, title }) => {
    const JSZip = await loadJSZip()
    const report = []
    const zip = await JSZip.loadAsync(buffer)
    const entries = Object.entries(zip.files).filter(([, file]) => !file.dir)
    const names = entries.map(([name]) => name)

    // 1. wrapper folder — Minecraft only reads pack.mcmeta at the zip root
    let prefix = ''
    if (!names.includes('pack.mcmeta')) {
      const nested = names.filter((name) => /^[^/]+\/pack\.mcmeta$/.test(name))
      if (nested.length === 1) {
        prefix = nested[0].slice(0, nested[0].indexOf('/') + 1)
        report.push(`unpacked the wrapper folder "${prefix.replace(/\/$/, '')}" — a pack.mcmeta below the root is ignored`)
      }
    }

    // 2. texture folder names: 1.13 renamed blocks/items to block/item
    const modern = (PACK_FORMATS[version] || 99) >= 4
    const fixDir = (path) => modern
      ? path.replace(/^assets\/minecraft\/textures\/blocks\//, 'assets/minecraft/textures/block/')
            .replace(/^assets\/minecraft\/textures\/items\//, 'assets/minecraft/textures/item/')
      : path.replace(/^assets\/minecraft\/textures\/block\//, 'assets/minecraft/textures/blocks/')
            .replace(/^assets\/minecraft\/textures\/item\//, 'assets/minecraft/textures/items/')

    const out = new JSZip()
    const taken = new Set()
    let dirFixes = 0
    for (const [name, file] of entries) {
      const rel = prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name
      const fixed = fixDir(rel)
      if (fixed !== rel) dirFixes++
      let target = fixed
      let n = 1
      while (taken.has(target)) target = fixed.replace(/(\.[^./]+)?$/, (ext) => ` (${n++})${ext || ''}`)
      taken.add(target)
      out.file(target, await file.async('uint8array'))
    }
    if (dirFixes) {
      report.push(modern
        ? `renamed ${dirFixes} texture path(s) from blocks/ items/ to block/ item/ (renamed in 1.13)`
        : `renamed ${dirFixes} texture path(s) from block/ item/ to blocks/ items/ (what 1.8.9 reads)`)
    }

    // 3. pack.mcmeta: format number and description
    const metaEntry = out.file('pack.mcmeta')
    let meta = {}
    if (metaEntry) {
      try {
        meta = JSON.parse((await metaEntry.async('string')).replace(/^\uFEFF/, ''))
      } catch {
        meta = {}
        report.push('pack.mcmeta was not valid JSON, rebuilt it')
      }
    } else {
      report.push('no pack.mcmeta at all, created one — without it the pack never loads')
    }
    meta.pack = meta.pack && typeof meta.pack === 'object' ? meta.pack : {}
    if (!meta.pack.description) meta.pack.description = title || '3HZ converted pack'
    const format = PACK_FORMATS[version]
    if (format) {
      meta.pack.pack_format = format
      meta.pack.min_format = 1
      meta.pack.max_format = 999
      meta.pack.supported_formats = [1, 999]
      report.push(`declared pack_format ${format} for ${version} (loads across the 1–999 range)`)
    }
    out.file('pack.mcmeta', JSON.stringify(meta, null, 2))

    const outNames = Object.keys(out.files)
    if (!outNames.some((name) => name.startsWith('assets/minecraft/textures/'))) {
      report.push('this pack ships no assets/minecraft/textures — it is a mod pack or an overlay, not vanilla textures')
    }

    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    return { blob, report }
  }

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const downloadPack = async (slug) => {
    if (packs.busy[slug]) return
    const hit = packs.hits.find((entry) => entry.slug === slug)
    if (!hit) return
    const version = packs.version
    packs.busy[slug] = true
    try {
      setPackStatus(slug, `checking ${version} builds`, 'work')
      let versions = await packVersions(slug, version)
      let convertedFrom = ''
      if (!Array.isArray(versions) || !versions.length) {
        setPackStatus(slug, `no ${version} build, converting`, 'work')
        const all = await packVersions(slug, null)
        if (!Array.isArray(all) || !all.length) throw new Error('no published files')
        convertedFrom = (all[0].game_versions || []).slice(-1)[0] || 'another version'
        versions = all.slice(0, 1)
      }
      const chosen = versions.find((entry) => entry.files && entry.files.length)
      if (!chosen) throw new Error('no downloadable file')
      const file = chosen.files.find((entry) => entry.primary) || chosen.files[0]
      const megabytes = (file.size / 1048576).toFixed(1)
      setPackStatus(slug, `downloading ${megabytes} MB`, 'work')
      const response = await fetch(file.url)
      if (!response.ok) throw new Error('download failed (' + response.status + ')')
      const buffer = await response.arrayBuffer()

      if (file.size > REWRITE_LIMIT) {
        saveBlob(new Blob([buffer], { type: 'application/zip' }), `${safeName(hit.title)} ${version}.zip`)
        setPackStatus(slug, `saved unmodified — ${megabytes} MB is too big to rewrite here`, 'done')
        return
      }

      setPackStatus(slug, 'checking pack contents', 'work')
      const { blob, report } = await rebuildPack(buffer, { version, title: hit.title })
      const filename = `${safeName(hit.title)} ${version}${convertedFrom ? ' (converted)' : ''}.zip`
      saveBlob(blob, filename)
      const lead = convertedFrom ? `converted from ${convertedFrom} → ${version}. ` : ''
      const summary = report.length ? report.slice(0, 3).join(' · ') : 'nothing to fix — the pack was already correct'
      setPackStatus(slug, lead + summary, 'done')
    } catch (err) {
      setPackStatus(slug, err && err.message ? err.message : 'download failed', 'error')
    } finally {
      packs.busy[slug] = false
    }
  }

  /* ------------------------------------------------------------------ render */

  const visible = () => {
    if (state.category === PACK_CATEGORY) return []
    if (state.query) {
      const q = state.query.toLowerCase()
      return ALL.filter((module) => module.name.toLowerCase().includes(q))
    }
    return MODULES[state.category]
  }

  const enabledCount = () => ALL.filter((module) => state.enabled.has(module.id)).length

  const catCount = (name) => (name === PACK_CATEGORY ? (packs.loaded ? packs.hits.length || packs.total : 0) : MODULES[name].length)

  const packNote = () => {
    if (packs.error) return `Could not reach Modrinth: ${esc(packs.error)} — check the connection and retry.`
    if (packs.loading) return `Loading packs for ${esc(packs.version)}…`
    if (!packs.hits.length) return `No resource packs match “${esc(packs.query)}” on ${esc(packs.version)}.`
    const converted = packs.hits.filter((hit) => hit.available === false).length
    return `Showing ${packs.hits.length} of ${compact(packs.total)} resource packs` +
      (converted ? ` · ${converted} have no ${esc(packs.version)} build and get converted on download` : '') +
      ' · files come from Modrinth'
  }

  const packCards = () => packs.hits.map((hit) => {
    const status = packs.status[hit.slug]
    const needsConvert = hit.available === false
    const label = hit.available === null ? 'Download' : needsConvert ? 'Convert &amp; download' : 'Download'
    return `
      <article class="cgui-pack">
        <div class="cgui-pack-thumb">
          ${hit.icon_url ? `<img src="${esc(hit.icon_url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}
        </div>
        <div class="cgui-pack-body">
          <h3 title="${esc(hit.title)}">${esc(hit.title)}</h3>
          <p class="cgui-pack-author">${esc(hit.author || 'unknown')}</p>
        </div>
        <div class="cgui-pack-meta"><span>${compact(hit.downloads)} dl</span><span>${needsConvert ? 'no ' + esc(packs.version) + ' build' : esc(packs.version)}</span></div>
        <button class="cgui-pack-btn" type="button" data-pack="${esc(hit.slug)}"${needsConvert ? ' data-convert="true"' : ''}>${label}</button>
        <p class="cgui-pack-status" data-pack-status="${esc(hit.slug)}" data-kind="${status ? status.kind : ''}" title="${status ? esc(status.text) : ''}">${status ? esc(status.text) : ''}</p>
      </article>`
  }).join('')

  const packsPane = () => `
    <section class="cgui-packs">
      <div class="cgui-packs-head">
        <div>
          <div class="cgui-label">RESOURCE PACKS</div>
          <h2>Browse packs for ${esc(packs.version)}</h2>
        </div>
        <label class="cgui-vsel">
          <span class="cgui-label">VERSION</span>
          <select id="pack-version" data-pack-version aria-label="Target Minecraft version">
            ${PACK_VERSIONS.map((version) => `<option value="${version}"${version === packs.version ? ' selected' : ''}>${version}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="cgui-packs-note" id="pack-note">${packNote()}</div>
      <div class="cgui-pack-scroll">
        <div class="cgui-pack-grid" id="pack-grid">${packCards()}</div>
        <button class="cgui-packs-more" type="button" data-pack-more${packs.hits.length >= packs.total || packs.loading ? ' hidden' : ''}>Load 9 more</button>
      </div>
    </section>`

  const renderPackGrid = () => {
    const grid = root.querySelector('#pack-grid')
    if (!grid) return
    const scroll = root.querySelector('.cgui-pack-scroll')
    const top = scroll ? scroll.scrollTop : 0
    grid.innerHTML = packCards()
    const more = root.querySelector('[data-pack-more]')
    if (more) more.hidden = packs.loading || packs.hits.length >= packs.total
    if (scroll) scroll.scrollTop = top
    renderPackNote()
    const badge = root.querySelector('[data-cat="' + PACK_CATEGORY + '"] .cgui-cat-count')
    if (badge) badge.textContent = String(catCount(PACK_CATEGORY))
  }

  const renderPackNote = () => {
    const note = root.querySelector('#pack-note')
    if (note) note.innerHTML = packNote()
  }

  const render = () => {
    const isPacks = state.category === PACK_CATEGORY
    const modules = visible()
    if (!isPacks && !modules.some((module) => module.id === state.selectedId)) state.selectedId = modules[0]?.id ?? null
    const selected = ALL.find((module) => module.id === state.selectedId)

    root.innerHTML = `
      <header class="cgui-head">
        <div class="cgui-brand">
          <div class="cgui-mark">3HZ</div>
          <div class="cgui-brand-text"><strong>3HZ CLIENT</strong><small>CLICKGUI</small></div>
        </div>
        <label class="cgui-search">
          <span class="cgui-search-icon" aria-hidden="true"></span>
          <input id="gui-search" type="text" placeholder="${isPacks ? `Search resource packs for ${esc(packs.version)}` : 'Search modules'}"
                 value="${esc(isPacks ? packs.query : state.query)}" spellcheck="false" autocomplete="off" aria-label="${isPacks ? 'Search resource packs' : 'Search modules'}">
          ${(isPacks ? packs.query : state.query) ? '<button class="cgui-clear" id="gui-clear" type="button" aria-label="Clear search">×</button>' : ''}
        </label>
        <div class="cgui-meta">
          <span class="cgui-count">${isPacks ? `${packs.hits.length} packs` : `${enabledCount()} active`}</span>
          <span class="cgui-hint">RIGHT SHIFT TO CLOSE</span>
        </div>
      </header>
      <div class="cgui-body${isPacks ? ' packs' : ''}">
        <nav class="cgui-cats" aria-label="Categories">
          <div class="cgui-label">CATEGORIES</div>
          ${CATEGORIES.map((name) => `
            <button class="cgui-cat${!state.query && name === state.category ? ' on' : ''}" type="button" data-cat="${name}">
              <span class="cgui-cat-icon"></span>
              <span>${name}</span>
              <span class="cgui-cat-count">${catCount(name)}</span>
            </button>`).join('')}
        </nav>
        ${isPacks ? packsPane() : `
        <section class="cgui-mods">
          <div class="cgui-mods-head">
            <div>
              <div class="cgui-label">${state.query ? 'SEARCH' : 'MODULES'}</div>
              <h2 id="gui-title">${state.query ? `Results for “${esc(state.query)}”` : state.category}</h2>
            </div>
            <span class="cgui-modcount">${modules.length}</span>
          </div>
          <div class="cgui-list" role="list">
            ${modules.length === 0
              ? '<div class="cgui-empty">No module matches that search.</div>'
              : modules.map((module) => {
                  const on = state.enabled.has(module.id)
                  return `
                  <div class="cgui-row${on ? ' on' : ''}${module.id === state.selectedId ? ' sel' : ''}" role="listitem" tabindex="0" data-row="${module.id}">
                    <span class="cgui-state-dot"></span>
                    <span class="cgui-name">${module.name}</span>
                    ${module.tag ? `<span class="cgui-tag">${module.tag}</span>` : ''}
                    ${module.key ? `<span class="cgui-key">${module.key}</span>` : ''}
                    <button class="cgui-sw" type="button" role="switch" aria-checked="${on}" data-switch="${module.id}"
                            aria-label="Toggle ${module.name}"></button>
                  </div>`
                }).join('')}
          </div>
        </section>
        <aside class="cgui-settings">
          ${selected ? `
            <div class="cgui-set-head">
              <div>
                <div class="cgui-label">SETTINGS</div>
                <h2>${selected.name}</h2>
              </div>
              <button class="cgui-sw large" type="button" role="switch" aria-checked="${state.enabled.has(selected.id)}"
                      data-switch="${selected.id}" aria-label="Toggle ${selected.name}"></button>
            </div>
            <p class="cgui-desc">${selected.desc}</p>
            <div class="cgui-set-body">
              ${selected.settings.map((setting, index) => {
                const value = state.values[selected.id][index]
                return setting.type === 'range'
                  ? `<label class="cgui-set-row">
                       <span>${setting.label}</span>
                       <span class="cgui-val">${value}${setting.suffix}</span>
                       <input type="range" min="${setting.min}" max="${setting.max}" step="0.1" value="${value}"
                              data-setting="${index}" aria-label="${selected.name} ${setting.label}">
                     </label>`
                  : `<label class="cgui-set-row">
                       <span>${setting.label}</span>
                       <input type="checkbox" ${value ? 'checked' : ''} data-setting="${index}"
                              aria-label="${selected.name} ${setting.label}">
                     </label>`
              }).join('')}
            </div>` : '<div class="cgui-empty">Pick a module from the list.</div>'}
        </aside>`}
      </div>
      <footer class="cgui-foot">
        <span><i class="cgui-live"></i>${enabledCount()} enabled</span>
        <span>${ALL.length} modules</span>
        <span class="cgui-grow"></span>
        <span>3HZ Client</span>
      </footer>`
  }

  const toggle = (id) => {
    if (state.enabled.has(id)) state.enabled.delete(id)
    else state.enabled.add(id)
    state.selectedId = id
    render()
  }

  root.addEventListener('click', (event) => {
    const sw = event.target.closest('[data-switch]')
    if (sw) {
      event.stopPropagation()
      toggle(sw.dataset.switch)
      return
    }
    const pack = event.target.closest('[data-pack]')
    if (pack) {
      downloadPack(pack.dataset.pack)
      return
    }
    if (event.target.closest('[data-pack-more]')) {
      loadPacks(false)
      return
    }
    const cat = event.target.closest('[data-cat]')
    if (cat) {
      state.category = cat.dataset.cat
      state.query = ''
      if (state.category === PACK_CATEGORY) {
        render()
        if (!packs.loaded) loadPacks(true)
      } else {
        state.selectedId = MODULES[state.category][0].id
        render()
      }
      return
    }
    if (event.target.closest('#gui-clear')) {
      if (state.category === PACK_CATEGORY) {
        packs.query = ''
        render()
        loadPacks(true)
      } else {
        state.query = ''
        render()
      }
      return
    }
    const row = event.target.closest('[data-row]')
    if (row) {
      state.selectedId = row.dataset.row
      render()
    }
  })

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-pack-version]')) {
      packs.version = event.target.value
      packs.status = {}
      render()
      loadPacks(true)
    }
  })

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const row = event.target.closest('[data-row]')
    if (!row || event.target.closest('[data-switch]')) return
    event.preventDefault()
    state.selectedId = row.dataset.row
    render()
  })

  root.addEventListener('input', (event) => {
    const input = event.target
    if (input.id === 'gui-search') {
      if (state.category === PACK_CATEGORY) {
        packs.query = input.value.trim()
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => { loadPacks(true) }, 320)
        const clear = root.querySelector('#gui-clear')
        if (packs.query && !clear) {
          const button = document.createElement('button')
          button.className = 'cgui-clear'
          button.id = 'gui-clear'
          button.type = 'button'
          button.setAttribute('aria-label', 'Clear search')
          button.textContent = '×'
          input.parentElement.appendChild(button)
        } else if (!packs.query && clear) {
          clear.remove()
        }
        return
      }
      state.query = input.value.trim()
      render()
      const field = document.getElementById('gui-search')
      if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length) }
      return
    }
    const control = input.closest('[data-setting]')
    if (!control) return
    const selected = ALL.find((module) => module.id === state.selectedId)
    if (!selected) return
    const index = Number(control.dataset.setting)
    if (control.type === 'range') {
      state.values[selected.id][index] = Number(control.value)
      const value = control.closest('.cgui-set-row').querySelector('.cgui-val')
      if (value) value.textContent = `${control.value}${selected.settings[index].suffix}`
    } else {
      state.values[selected.id][index] = control.checked
    }
  })

  render()
  root.dataset.ready = 'true'
})()
