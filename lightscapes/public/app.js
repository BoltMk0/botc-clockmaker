// The configuration page. Edits a working copy of the configuration, saved as a whole with the save bar.

import { COOLEST, WARMEST, hexToMireds, miredsToHex } from './whites.js';

const PHASES = ['morning', 'day', 'dusk', 'night'];
const PHASE_LABELS = { morning: 'Morning', day: 'Day', dusk: 'Dusk', night: 'Night' };
const PHASE_HINTS = {
    morning: 'Once the day\'s timer is set up, until it\'s started (or while it\'s paused).',
    day: 'While the countdown runs.',
    dusk: 'When the countdown runs out, or the day is ended.',
    night: 'Night.'
};
const BELLS = [
    { id: 'startBell', label: 'Start of day bell', hint: 'Rings as night turns to day.' },
    { id: 'reminderBell', label: 'Reminder bell', hint: 'Rings when the countdown gets to the reminder time it was set up with.' },
    { id: 'handBell', label: 'Hand bell', hint: 'Rung from the remote, or a button.' }
];
const COMMANDS = [
    ['day', 'Day (set the timer up)'],
    ['startPause', 'Start / pause the timer'],
    ['dusk', 'Dusk'],
    ['night', 'Night'],
    ['ringBell', 'Ring the bell'],
    ['sting', 'Play the armed sting']
];
const EFFECTS = [
    ['', 'No effect'], ['blink', 'Blink'], ['breathe', 'Breathe'], ['okay', 'Okay'],
    ['channel_change', 'Channel change'], ['finish_effect', 'Finish effect'], ['stop_effect', 'Stop effect']
];

/** The configuration as last saved (JSON), and the working copy being edited. */
let saved = '';
let config = null;
let zigbee = { devices: [], groups: [] };
let zigbeeJson = '';
let status = null;
let clocks = [];
let phaseTab = 'morning';
let previewProgress = 0.5;
let learning = false;
let learnMessage = '';

// --- Helpers -------------------------------------------------------------------------------------------------------

/** Makes an element: props are attributes, except `class`, `on<event>` handlers and DOM properties like `value`. */
function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
        else if (key in el && key !== 'list' && key !== 'type') el[key] = value;
        else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat(Infinity)) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

/** Replaces an element's children, skipping the empty ones as h() does. */
function fill(id, ...children) {
    document.getElementById(id).replaceChildren(...children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false));
}

function option(value, label, selected) {
    return h('option', { value, selected: value === selected }, label);
}

async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(path, {
        method,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `${response.status} ${response.statusText}`);
    return data;
}

let toastTimer = null;
function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.hidden = true, 5000);
}

function changed() {
    const dirty = JSON.stringify(config) !== saved;
    document.getElementById('savebar').hidden = !dirty;
    if (!dirty) document.getElementById('save-error').textContent = '';
}

function kelvin(mireds) {
    return Math.round(1_000_000 / mireds / 50) * 50;
}

// --- Lights and groups ---------------------------------------------------------------------------------------------

function lightTargets() {
    return {
        groups: zigbee.groups.map(g => g.name),
        devices: zigbee.devices.filter(d => d.switchable).map(d => d.name)
    };
}

function targetSelect(value, onChange) {
    const { groups, devices } = lightTargets();
    const known = groups.includes(value) || devices.includes(value);
    return h('select', { class: 'target', onchange: e => onChange(e.target.value) },
        option('', 'Pick a light or group…', value),
        !known && value ? option(value, `${value} (not found)`, value) : null,
        groups.length ? h('optgroup', { label: 'Groups' }, groups.map(g => option(g, g, value))) : null,
        devices.length ? h('optgroup', { label: 'Lights' }, devices.map(d => option(d, d, value))) : null
    );
}

// --- Scene editor (a list of lights and what to set them to) ------------------------------------------------------

function sceneEditor(entries, rerender, { effects = false } = {}) {
    const list = h('div', { class: 'entries' },
        entries.length === 0 ? h('div', { class: 'empty' }, 'No lights: they\'re left as they are.') : null,
        entries.map((entry, i) => entryRow(entry, entries, i, rerender, effects))
    );
    return h('div', {},
        list,
        h('div', { class: 'actions' },
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => {
                    entries.push({ target: '', light: { on: true, brightness: 254 } });
                    changed();
                    rerender();
                }
            }, '+ Add a light')
        )
    );
}

function entryRow(entry, entries, index, rerender, effects) {
    const light = entry.light;
    const device = zigbee.devices.find(d => d.name === entry.target);
    const colorMode = light.color?.kind ?? 'keep';

    const brightnessValue = h('span', { class: 'value' }, light.brightness === undefined ? '' : `${Math.round(light.brightness / 254 * 100)}%`);
    const tempValue = h('span', { class: 'value' }, light.color?.kind === 'temp' ? `${kelvin(light.color.mireds)}K` : '');

    return h('div', { class: 'entry' },
        targetSelect(entry.target, value => { entry.target = value; changed(); rerender(); }),
        h('select', {
            onchange: e => {
                light.on = e.target.value === 'on';
                if (!light.on) { delete light.brightness; delete light.color; delete light.effect; }
                changed();
                rerender();
            }
        }, option('on', 'On', light.on ? 'on' : 'off'), option('off', 'Off', light.on ? 'on' : 'off')),
        light.on ? [
            h('label', { class: 'inline brightness', title: 'Brightness (leave unticked to keep it as it is)' },
                h('input', {
                    type: 'checkbox', checked: light.brightness !== undefined,
                    onchange: e => {
                        if (e.target.checked) light.brightness = 254; else delete light.brightness;
                        changed();
                        rerender();
                    }
                }),
                'Brightness',
                light.brightness !== undefined ? h('input', {
                    type: 'range', min: 1, max: 254, value: light.brightness,
                    oninput: e => {
                        light.brightness = Number(e.target.value);
                        brightnessValue.textContent = `${Math.round(light.brightness / 254 * 100)}%`;
                        changed();
                    }
                }) : null,
                brightnessValue
            ),
            h('select', {
                title: 'Colour',
                onchange: e => {
                    const mode = e.target.value;
                    if (mode === 'keep') delete light.color;
                    else if (mode === 'rgb') light.color = { kind: 'rgb', hex: '#ffb46b' };
                    else light.color = { kind: 'temp', mireds: 370 };
                    changed();
                    rerender();
                }
            }, option('keep', 'Keep colour', colorMode), option('rgb', 'Colour', colorMode), option('temp', 'White', colorMode)),
            light.color?.kind === 'rgb' ? h('input', {
                type: 'color', value: light.color.hex,
                oninput: e => { light.color.hex = e.target.value; changed(); }
            }) : null,
            light.color?.kind === 'temp' ? h('span', { class: 'brightness', title: 'Colour temperature: warm to cool' },
                h('input', {
                    type: 'range', min: 153, max: 500, value: 653 - light.color.mireds,
                    // Reversed, so the slider goes warm (left) to cool (right)
                    oninput: e => {
                        light.color.mireds = 653 - Number(e.target.value);
                        tempValue.textContent = `${kelvin(light.color.mireds)}K`;
                        changed();
                    }
                }),
                tempValue
            ) : null,
            effects || light.effect ? h('select', {
                title: 'Effect',
                onchange: e => {
                    if (e.target.value) light.effect = e.target.value; else delete light.effect;
                    changed();
                }
            }, EFFECTS.map(([value, label]) => option(value, label, light.effect ?? ''))) : null,
            device && light.color?.kind === 'rgb' && !device.color ? h('span', { class: 'note' }, 'This light may not do colours') : null,
            device && light.color?.kind === 'temp' && !device.colorTemp ? h('span', { class: 'note' }, 'This light may not do white temperatures') : null
        ] : null,
        h('span', { class: 'spacer' }),
        h('button', {
            type: 'button', class: 'icon', title: 'Remove',
            onclick: () => { entries.splice(index, 1); changed(); rerender(); }
        }, '×')
    );
}

// --- Sections ------------------------------------------------------------------------------------------------------

function renderClockmaker() {
    const c = config.clockmaker;
    const message = h('p', { class: 'message' });
    const knownClock = clocks.some(k => k.id === c.clockId);

    const findGames = async () => {
        message.className = 'message';
        message.textContent = 'Looking…';
        try {
            clocks = await api('/api/clocks', { method: 'POST', body: { url: c.url, token: c.token } });
            if (!c.clockId && clocks.length === 1) { c.clockId = clocks[0].id; changed(); }
            renderClockmaker();
        } catch (err) {
            message.className = 'message error';
            message.textContent = err.message;
        }
    };

    fill('clockmaker', 
        h('div', { class: 'grid' },
            h('label', {}, 'Address',
                h('input', {
                    type: 'url', placeholder: 'http://homelab:3000', value: c.url,
                    oninput: e => { c.url = e.target.value.trim(); changed(); }
                })
            ),
            h('label', {}, 'API token',
                h('input', {
                    type: 'password', autocomplete: 'off', value: c.token,
                    placeholder: c.tokenSet ? 'Saved: enter a new one to replace it' : 'From Clockmaker\'s settings',
                    oninput: e => { c.token = e.target.value.trim(); changed(); }
                })
            ),
            h('label', {}, 'Game',
                h('select', { onchange: e => { c.clockId = e.target.value; changed(); } },
                    option('', clocks.length ? 'Pick a game…' : 'Find the games first', c.clockId),
                    !knownClock && c.clockId ? option(c.clockId, `${c.clockId} (saved)`, c.clockId) : null,
                    clocks.map(k => option(k.id, k.name ? `${k.name} (${k.id})` : k.id, c.clockId))
                )
            )
        ),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'secondary', onclick: findGames }, 'Find games')),
        message
    );
}

function renderPhases() {
    const entries = config.phases[phaseTab];
    const spectrumHere = config.spectrum.enabled && (phaseTab === 'day' || (phaseTab === 'morning' && config.spectrum.holdInMorning));
    const overridden = spectrumHere ? entries.filter(e => config.spectrum.targets.includes(e.target)).map(e => e.target) : [];

    fill('phases', 
        h('div', { class: 'row center' },
            h('label', { class: 'inline' }, 'Fade between phases over',
                h('input', {
                    type: 'number', min: 0, max: 60, step: 0.5, value: config.transitionSeconds,
                    oninput: e => { config.transitionSeconds = Number(e.target.value) || 0; changed(); }
                }),
                'seconds'
            )
        ),
        h('div', { class: 'tabs', style: 'margin-top: 1rem' },
            PHASES.map(phase => h('button', {
                type: 'button', class: `tab${phase === phaseTab ? ' active' : ''}`,
                onclick: () => { phaseTab = phase; renderPhases(); }
            }, PHASE_LABELS[phase]))
        ),
        h('p', { class: 'hint' }, PHASE_HINTS[phaseTab],
            spectrumHere ? ' The day spectrum\'s lights follow the spectrum here.' : ''),
        sceneEditor(entries, renderPhases),
        overridden.length ? h('p', { class: 'note' }, `${overridden.join(', ')} follow${overridden.length === 1 ? 's' : ''} the day spectrum in this phase instead.`) : null,
        h('div', { class: 'actions' },
            h('button', { type: 'button', onclick: () => preview({ phase: phaseTab, progress: phaseTab === 'day' ? previewProgress : 0 }) },
                `Preview ${PHASE_LABELS[phaseTab].toLowerCase()}`)
        )
    );
}

/** A spectrum stop's colour as the lights show it: its white's, if it's white. */
function shownHex(stop) {
    return stop.white ? miredsToHex(stop.mireds) : stop.hex;
}

function gradientCss(stops) {
    if (stops.length === 0) return 'var(--raised)';
    if (stops.length === 1) return shownHex(stops[0]);
    return `linear-gradient(to right, ${stops.map(s => `${shownHex(s)} ${s.at * 100}%`).join(', ')})`;
}

function renderSpectrum() {
    const spectrum = config.spectrum;
    const stops = spectrum.stops;
    const { groups, devices } = lightTargets();
    const missing = spectrum.targets.filter(t => !groups.includes(t) && !devices.includes(t));
    const progressLabel = h('span', { class: 'value' }, `${Math.round(previewProgress * 100)}%`);

    const targetBox = name => h('label', { class: 'inline' },
        h('input', {
            type: 'checkbox', checked: spectrum.targets.includes(name),
            onchange: e => {
                spectrum.targets = e.target.checked ? [...spectrum.targets, name] : spectrum.targets.filter(t => t !== name);
                changed();
                renderPhases();
            }
        }),
        name
    );

    const live = status?.clock?.timeOfDay === 'day' ? status.clock.progress : null;

    fill('spectrum', 
        h('label', { class: 'inline' },
            h('input', {
                type: 'checkbox', checked: spectrum.enabled,
                onchange: e => { spectrum.enabled = e.target.checked; changed(); renderPhases(); }
            }),
            'Use the day spectrum'
        ),
        h('div', { class: 'gradient', id: 'gradient', style: `background: ${gradientCss(stops)}` },
            stops.map(s => h('span', { class: 'tick', style: `left: ${s.at * 100}%`, title: `${Math.round(s.at * 100)}%` })),
            live !== null ? h('span', { class: 'marker', id: 'gradient-marker', style: `left: ${live * 100}%`, title: 'Now' }) : null
        ),

        h('h3', {}, 'Lights that follow it'),
        groups.length + devices.length + missing.length === 0
            ? h('p', { class: 'empty' }, 'No lights found yet: pair some in Zigbee2MQTT.')
            : h('div', { class: 'targets' }, [...groups, ...devices, ...missing].map(targetBox)),

        h('h3', {}, 'Colours'),
        stops.length === 0 ? h('p', { class: 'empty' }, 'No colours yet: start from the town square\'s sky, or add your own.') :
        h('table', { class: 'stops' },
            h('thead', {}, h('tr', {}, h('th', {}, 'At'), h('th', {}, 'Colour'), h('th', {}, 'Brightness'), h('th', {}))),
            h('tbody', {}, stops.map((stop, i) => {
                const brightness = h('span', { class: 'value' }, `${Math.round(stop.brightness / 254 * 100)}%`);
                const tempValue = h('span', { class: 'value' }, `${kelvin(stop.mireds)}K`);
                const gradient = () => document.getElementById('gradient').style.background = gradientCss(stops);
                return h('tr', {},
                    h('td', {}, h('input', {
                        type: 'number', min: 0, max: 100, step: 1, value: Math.round(stop.at * 1000) / 10,
                        onchange: e => {
                            stop.at = Math.min(Math.max(Number(e.target.value) || 0, 0), 100) / 100;
                            stops.sort((a, b) => a.at - b.at);
                            changed();
                            renderSpectrum();
                        }
                    }), ' %'),
                    h('td', { class: 'color' },
                        h('select', {
                            title: 'White uses the bulbs\' white light',
                            onchange: e => {
                                stop.white = e.target.value === 'white';
                                // Starting from the white nearest the colour
                                if (stop.white) stop.mireds = hexToMireds(stop.hex);
                                changed();
                                renderSpectrum();
                            }
                        }, option('white', 'White', stop.white ? 'white' : 'rgb'), option('rgb', 'Colour', stop.white ? 'white' : 'rgb')),
                        stop.white ? h('span', { class: 'brightness', title: 'Colour temperature: warm to cool' },
                            h('input', {
                                type: 'range', min: COOLEST, max: WARMEST, value: COOLEST + WARMEST - stop.mireds,
                                // Reversed, so the slider goes warm (left) to cool (right)
                                oninput: e => {
                                    stop.mireds = COOLEST + WARMEST - Number(e.target.value);
                                    tempValue.textContent = `${kelvin(stop.mireds)}K`;
                                    gradient();
                                    changed();
                                }
                            }),
                            tempValue
                        ) : h('input', {
                            type: 'color', value: stop.hex,
                            oninput: e => { stop.hex = e.target.value; gradient(); changed(); }
                        })
                    ),
                    h('td', { class: 'brightness' }, h('input', {
                        type: 'range', min: 1, max: 254, value: stop.brightness,
                        oninput: e => {
                            stop.brightness = Number(e.target.value);
                            brightness.textContent = `${Math.round(stop.brightness / 254 * 100)}%`;
                            changed();
                        }
                    }), brightness),
                    h('td', {}, h('button', {
                        type: 'button', class: 'icon', title: 'Remove',
                        onclick: () => { stops.splice(i, 1); changed(); renderSpectrum(); }
                    }, '×'))
                );
            }))
        ),
        h('div', { class: 'actions' },
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => {
                    // Halfway along the widest gap, in the colour already there
                    const points = [0, ...stops.map(s => s.at), 1];
                    let at = 0.5, widest = -1;
                    for (let i = 0; i < points.length - 1; i++) {
                        if (points[i + 1] - points[i] > widest) { widest = points[i + 1] - points[i]; at = (points[i] + points[i + 1]) / 2; }
                    }
                    const near = stops.reduce((best, s) => !best || Math.abs(s.at - at) < Math.abs(best.at - at) ? s : best, null);
                    stops.push({ at: Math.round(at * 1000) / 1000, hex: near?.hex ?? '#ffffff', brightness: near?.brightness ?? 254, white: near?.white ?? true, mireds: near?.mireds ?? 370 });
                    stops.sort((a, b) => a.at - b.at);
                    changed();
                    renderSpectrum();
                }
            }, '+ Add a colour'),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: async () => {
                    if (stops.length && !confirm('Replace these colours with the town square\'s sky?')) return;
                    try {
                        spectrum.stops = await api('/api/townsquare-spectrum');
                        changed();
                        renderSpectrum();
                    } catch (err) { toast(err.message); }
                }
            }, 'Use the town square\'s sky')
        ),

        h('div', { class: 'row', style: 'margin-top: 1rem' },
            h('label', {}, 'Move the lights along every',
                h('span', { class: 'row center' },
                    h('input', {
                        type: 'number', min: 1, max: 300, step: 1, value: spectrum.intervalSeconds,
                        oninput: e => { spectrum.intervalSeconds = Number(e.target.value) || 10; changed(); }
                    }),
                    'seconds'
                )
            ),
            h('label', { class: 'inline', style: 'padding-bottom: 0.5rem' },
                h('input', {
                    type: 'checkbox', checked: spectrum.holdInMorning,
                    onchange: e => { spectrum.holdInMorning = e.target.checked; changed(); renderPhases(); }
                }),
                'Show the first colour in the morning, as the town square does'
            )
        ),
        h('p', { class: 'hint small' }, 'The lights fade from one update to the next. Every few seconds is smooth without flooding the Zigbee network.'),

        h('div', { class: 'row center', style: 'margin-top: 1rem' },
            h('label', { class: 'inline' }, 'Preview at',
                h('input', {
                    type: 'range', min: 0, max: 100, value: previewProgress * 100,
                    oninput: e => { previewProgress = Number(e.target.value) / 100; progressLabel.textContent = `${e.target.value}%`; },
                    onchange: () => preview({ phase: 'day', progress: previewProgress })
                }),
                progressLabel
            ),
            h('button', { type: 'button', onclick: () => preview({ phase: 'day', progress: previewProgress }) }, 'Preview')
        )
    );
}

function renderBells() {
    fill('bells', ...BELLS.map(bell => {
        const effect = config.bells[bell.id];
        return h('div', { class: 'bell' },
            h('div', { class: 'row center' },
                h('div', {}, h('h3', {}, bell.label), h('span', { class: 'message' }, bell.hint)),
                h('span', { class: 'spacer' }),
                h('label', { class: 'inline' }, 'Hold for',
                    h('input', {
                        type: 'number', min: 0, max: 120, step: 0.5, value: effect.holdSeconds,
                        oninput: e => { effect.holdSeconds = Number(e.target.value) || 0; changed(); }
                    }),
                    's'
                ),
                h('button', { type: 'button', class: 'secondary', disabled: effect.entries.length === 0, onclick: () => preview({ bell: bell.id }) }, 'Test')
            ),
            sceneEditor(effect.entries, renderBells, { effects: true })
        );
    }));
}

function renderButtons() {
    const buttons = zigbee.devices.filter(d => d.actions !== null);
    const message = h('p', { class: learning ? 'listening' : 'message' }, learning ? 'Press the button now…' : learnMessage);

    const learn = async () => {
        learning = true;
        learnMessage = '';
        renderButtons();
        try {
            const press = await api('/api/learn', { method: 'POST' });
            if (!press) learnMessage = 'Nothing was pressed.';
            else if (config.buttons.some(b => b.device === press.device && b.action === press.action)) {
                learnMessage = `${press.device} (${press.action}) is already bound.`;
            } else {
                config.buttons.push({ device: press.device, action: press.action, command: 'day' });
                learnMessage = `Added ${press.device} (${press.action}): pick what it does.`;
                changed();
            }
        } catch (err) {
            learnMessage = err.message;
        }
        learning = false;
        renderButtons();
    };

    fill('buttons', 
        h('div', { class: 'entries' },
            config.buttons.length === 0 ? h('div', { class: 'empty' }, 'No buttons bound.') : null,
            config.buttons.map((binding, i) => {
                const device = zigbee.devices.find(d => d.name === binding.device);
                const actions = device?.actions ?? [];
                return h('div', { class: 'entry' },
                    h('select', { class: 'target', onchange: e => { binding.device = e.target.value; changed(); renderButtons(); } },
                        option('', 'Pick a button…', binding.device),
                        !device && binding.device ? option(binding.device, `${binding.device} (not found)`, binding.device) : null,
                        buttons.map(d => option(d.name, d.name, binding.device))
                    ),
                    actions.length
                        ? h('select', { onchange: e => { binding.action = e.target.value; changed(); } },
                            option('', 'Pick an action…', binding.action),
                            !actions.includes(binding.action) && binding.action ? option(binding.action, binding.action, binding.action) : null,
                            actions.map(a => option(a, a, binding.action)))
                        : h('input', {
                            type: 'text', placeholder: 'Action, e.g. single', value: binding.action,
                            oninput: e => { binding.action = e.target.value.trim(); changed(); }
                        }),
                    h('span', {}, '→'),
                    h('select', { onchange: e => { binding.command = e.target.value; changed(); } },
                        COMMANDS.map(([value, label]) => option(value, label, binding.command))),
                    h('span', { class: 'spacer' }),
                    h('button', {
                        type: 'button', class: 'icon', title: 'Remove',
                        onclick: () => { config.buttons.splice(i, 1); changed(); renderButtons(); }
                    }, '×')
                );
            })
        ),
        h('div', { class: 'actions' },
            h('button', { type: 'button', disabled: learning, onclick: learn }, 'Learn a button'),
            h('button', {
                type: 'button', class: 'secondary',
                onclick: () => { config.buttons.push({ device: '', action: '', command: 'day' }); changed(); renderButtons(); }
            }, '+ Add by hand')
        ),
        message,
        h('p', { class: 'hint small' }, 'While learning, the next press anywhere is taken as the button to bind, not acted on.')
    );
}

function renderStatus() {
    const chips = [];
    const chip = (state, text, title) => chips.push(h('span', { class: `chip ${state}`, title }, text));
    if (!status) {
        chip('bad', 'Lightscapes unreachable');
    } else {
        const cm = status.clockmaker;
        if (cm.connection === 'connected') chip('ok', 'Clockmaker');
        else if (cm.connection === 'unconfigured') chip('warn', 'Clockmaker: not set up');
        else if (cm.connection === 'connecting') chip('warn', 'Clockmaker: connecting', cm.error ?? undefined);
        else chip('bad', `Clockmaker: ${cm.error ?? 'error'}`, cm.error ?? undefined);
        chip(status.mqtt.connected ? 'ok' : 'bad', status.mqtt.connected ? 'MQTT' : 'MQTT: not connected', status.mqtt.url);
        const z = status.zigbee2mqtt.online;
        chip(z ? 'ok' : z === false ? 'bad' : 'warn', z ? 'Zigbee2MQTT' : z === false ? 'Zigbee2MQTT: offline' : 'Zigbee2MQTT: waiting');
        if (status.dryRun) chip('warn', 'Dry run');
        if (status.clock) {
            const c = status.clock;
            chip('plain', `Day ${c.day} · ${PHASE_LABELS[c.timeOfDay]}${c.timeOfDay === 'day' && c.running ? ` ${Math.round(c.progress * 100)}%` : ''}`);
        }
    }
    fill('status', ...chips);

    const banner = document.getElementById('preview-banner');
    banner.hidden = !status?.previewing;
    document.getElementById('preview-text').textContent = status?.previewing ? `Previewing ${status.previewing}. The lights go back to the game after a minute.` : '';

    const marker = document.getElementById('gradient-marker');
    const live = status?.clock?.timeOfDay === 'day' ? status.clock.progress : null;
    if ((marker === null) !== (live === null)) renderSpectrum();
    else if (marker) marker.style.left = `${live * 100}%`;

    fill('activity', ...(status?.activity ?? []).map(a =>
        h('li', {}, h('time', {}, new Date(a.at).toLocaleTimeString()), a.text)
    ));
    if (!status?.activity?.length) document.getElementById('activity').append(h('li', { class: 'empty' }, 'Nothing yet.'));
}

function renderAll() {
    renderClockmaker();
    renderPhases();
    renderSpectrum();
    renderBells();
    renderButtons();
    changed();
}

// --- Actions -------------------------------------------------------------------------------------------------------

async function preview(what) {
    try {
        await api('/api/preview', { method: 'POST', body: { ...what, config } });
        await refreshStatus();
    } catch (err) {
        toast(`Couldn't preview: ${err.message}`);
    }
}

async function save() {
    const button = document.getElementById('save');
    button.disabled = true;
    try {
        const result = await api('/api/config', { method: 'PUT', body: config });
        saved = JSON.stringify(result);
        config = JSON.parse(saved);
        renderAll();
    } catch (err) {
        document.getElementById('save-error').textContent = err.message;
    } finally {
        button.disabled = false;
    }
}

async function refreshStatus() {
    try {
        status = await api('/api/status');
    } catch {
        status = null;
    }
    renderStatus();
}

async function refreshZigbee() {
    try {
        const next = await api('/api/zigbee');
        const json = JSON.stringify(next);
        if (json === zigbeeJson) return;
        zigbee = next;
        zigbeeJson = json;
        // Only the lists change, so the sections are redrawn without losing any edits
        renderPhases();
        renderSpectrum();
        renderBells();
        if (!learning) renderButtons();
    } catch { /* shown by the status */ }
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('discard').addEventListener('click', () => {
    config = JSON.parse(saved);
    renderAll();
});
document.getElementById('end-preview').addEventListener('click', async () => {
    await api('/api/preview', { method: 'DELETE' }).catch(err => toast(err.message));
    await refreshStatus();
});
window.addEventListener('beforeunload', e => {
    if (config && JSON.stringify(config) !== saved) e.preventDefault();
});

const loaded = await api('/api/config');
saved = JSON.stringify(loaded);
config = JSON.parse(saved);
await refreshZigbee();
renderAll();
// Names for the games, if Clockmaker's set up (quietly: the status shows if it can't be reached)
if (config.clockmaker.url && config.clockmaker.tokenSet) {
    api('/api/clocks', { method: 'POST', body: {} }).then(found => { clocks = found; renderClockmaker(); }).catch(() => {});
}
await refreshStatus();
setInterval(refreshStatus, 2000);
setInterval(refreshZigbee, 10_000);
