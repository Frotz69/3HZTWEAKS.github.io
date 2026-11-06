/* 3HZ Client — ClickGUI demo, modelled on the client's WindowClickGui.svelte:
   category rail, module list with state dots, per-module settings, status foot.
   Local state only; the real window talks to the client over its own bridge. */
(() => {
  const root = document.getElementById('clickgui-demo')
  if (!root) return

  const CATEGORIES = ['Combat', 'Movement', 'Render', 'World', 'Player', 'Misc']

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
    values: Object.fromEntries(ALL.map((module) => [module.id, module.settings.map((setting) => setting.value)]))
  }

  const visible = () => {
    if (state.query) {
      const q = state.query.toLowerCase()
      return ALL.filter((module) => module.name.toLowerCase().includes(q))
    }
    return MODULES[state.category]
  }

  const enabledCount = () => ALL.filter((module) => state.enabled.has(module.id)).length

  const catCount = (name) => MODULES[name].length

  const render = () => {
    const modules = visible()
    if (!modules.some((module) => module.id === state.selectedId)) state.selectedId = modules[0]?.id ?? null
    const selected = ALL.find((module) => module.id === state.selectedId)

    root.innerHTML = `
      <header class="cgui-head">
        <div class="cgui-brand">
          <div class="cgui-mark">3HZ</div>
          <div class="cgui-brand-text"><strong>3HZ CLIENT</strong><small>CLICKGUI</small></div>
        </div>
        <label class="cgui-search">
          <span class="cgui-search-icon" aria-hidden="true"></span>
          <input id="gui-search" type="text" placeholder="Search modules" value="${state.query}" spellcheck="false" autocomplete="off" aria-label="Search modules">
          ${state.query ? '<button class="cgui-clear" id="gui-clear" type="button" aria-label="Clear search">×</button>' : ''}
        </label>
        <div class="cgui-meta">
          <span class="cgui-count">${enabledCount()} active</span>
          <span class="cgui-hint">RIGHT SHIFT TO CLOSE</span>
        </div>
      </header>
      <div class="cgui-body">
        <nav class="cgui-cats" aria-label="Categories">
          <div class="cgui-label">CATEGORIES</div>
          ${CATEGORIES.map((name) => `
            <button class="cgui-cat${!state.query && name === state.category ? ' on' : ''}" type="button" data-cat="${name}">
              <span class="cgui-cat-icon"></span>
              <span>${name}</span>
              <span class="cgui-cat-count">${catCount(name)}</span>
            </button>`).join('')}
        </nav>
        <section class="cgui-mods">
          <div class="cgui-mods-head">
            <div>
              <div class="cgui-label">${state.query ? 'SEARCH' : 'MODULES'}</div>
              <h2 id="gui-title">${state.query ? `Results for “${state.query}”` : state.category}</h2>
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
        </aside>
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
    const cat = event.target.closest('[data-cat]')
    if (cat) {
      state.category = cat.dataset.cat
      state.query = ''
      state.selectedId = MODULES[state.category][0].id
      render()
      return
    }
    if (event.target.closest('#gui-clear')) {
      state.query = ''
      render()
      return
    }
    const row = event.target.closest('[data-row]')
    if (row) {
      state.selectedId = row.dataset.row
      render()
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
