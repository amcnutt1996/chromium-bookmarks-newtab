import { gearIcon, closeIcon } from "./icons.js";

const STORAGE_KEY = "settings";
// Mirror of the computed theme, read synchronously by theme-boot.js so the
// page paints with the user's colors instead of flashing the defaults.
const THEME_CACHE_KEY = "newtab-theme";
const SAVE_DELAY_MS = 400;

const PRESETS = {
    midnight: {
        label: "Midnight",
        colors: {
            background: "#0b0e17",
            text: "#eef1f8",
            accent: "#8fb4ff",
            panel: "#ffffff",
            glow1: "#5865f2",
            glow2: "#20b2aa",
            glow3: "#b066d6",
            danger: "#ff7a7a",
        },
        glowIntensity: 100,
        panelOpacity: 5.5,
    },
    ocean: {
        label: "Ocean",
        colors: {
            background: "#06141b",
            text: "#e6f6fb",
            accent: "#5ed3f3",
            panel: "#ffffff",
            glow1: "#0077b6",
            glow2: "#00b4d8",
            glow3: "#48cae4",
            danger: "#ff7a7a",
        },
        glowIntensity: 110,
        panelOpacity: 5.5,
    },
    forest: {
        label: "Forest",
        colors: {
            background: "#0b140f",
            text: "#eef6ef",
            accent: "#8fd6a8",
            panel: "#ffffff",
            glow1: "#2d6a4f",
            glow2: "#95d5b2",
            glow3: "#52b788",
            danger: "#ff8a7a",
        },
        glowIntensity: 120,
        panelOpacity: 5.5,
    },
    ember: {
        label: "Ember",
        colors: {
            background: "#150c0a",
            text: "#fbefe8",
            accent: "#ffb38a",
            panel: "#ffffff",
            glow1: "#e85d04",
            glow2: "#9d0208",
            glow3: "#f48c06",
            danger: "#ff6b6b",
        },
        glowIntensity: 100,
        panelOpacity: 5.5,
    },
    rose: {
        label: "Rose",
        colors: {
            background: "#140b12",
            text: "#fbeef3",
            accent: "#ff9ebd",
            panel: "#ffffff",
            glow1: "#c9184a",
            glow2: "#7b2cbf",
            glow3: "#ff8fab",
            danger: "#ff7a7a",
        },
        glowIntensity: 100,
        panelOpacity: 5.5,
    },
    mono: {
        label: "Mono",
        colors: {
            background: "#0d0d0d",
            text: "#f2f2f2",
            accent: "#d9d9d9",
            panel: "#ffffff",
            glow1: "#5a5a5a",
            glow2: "#3a3a3a",
            glow3: "#707070",
            danger: "#ff7a7a",
        },
        glowIntensity: 100,
        panelOpacity: 5,
    },
    daylight: {
        label: "Daylight",
        colors: {
            background: "#e9edf5",
            text: "#1a1f2e",
            accent: "#3d63e0",
            panel: "#ffffff",
            glow1: "#8fa8ff",
            glow2: "#7fd8cf",
            glow3: "#d6a8f0",
            danger: "#d43c3c",
        },
        glowIntensity: 200,
        panelOpacity: 55,
    },
};

const DEFAULTS = {
    colors: { ...PRESETS.midnight.colors },
    glowIntensity: 100,
    panelOpacity: 5.5,
    blur: 22,
    tileSize: 100,
    roundness: 100,
    clock24h: false,
    showDate: true,
    showWeather: true,
    tempUnit: "fahrenheit",
};

const COLOR_FIELDS = [
    ["background", "Background"],
    ["text", "Text"],
    ["accent", "Accent"],
    ["panel", "Panels"],
    ["glow1", "Glow 1"],
    ["glow2", "Glow 2"],
    ["glow3", "Glow 3"],
    ["danger", "Delete / errors"],
];

const RANGE_FIELDS = [
    { key: "glowIntensity", label: "Glow", min: 0, max: 200, step: 5, unit: "%" },
    { key: "panelOpacity", label: "Panel opacity", min: 0, max: 60, step: 0.5, unit: "%" },
    { key: "blur", label: "Panel blur", min: 0, max: 40, step: 1, unit: "px" },
    { key: "tileSize", label: "Bookmark size", min: 75, max: 150, step: 5, unit: "%" },
    { key: "roundness", label: "Roundness", min: 0, max: 150, step: 5, unit: "%" },
];

const TOGGLE_FIELDS = [
    ["clock24h", "24-hour clock"],
    ["showDate", "Show date"],
    ["showWeather", "Show weather"],
];

const TEMP_UNITS = [
    ["fahrenheit", "°F"],
    ["celsius", "°C"],
];

let settings = structuredClone(DEFAULTS);
const listeners = new Set();
const controls = {};
let saveTimer;

/* ------------------------------------------------------------------------
   Values
   ------------------------------------------------------------------------ */

const isHex = (value) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function clamp(value, { min, max }, fallback) {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.min(max, Math.max(min, number))
        : fallback;
}

// Merge stored settings over the defaults, dropping anything malformed.
function normalize(stored = {}) {
    const result = structuredClone(DEFAULTS);
    for (const [key] of COLOR_FIELDS) {
        if (isHex(stored.colors?.[key])) {
            result.colors[key] = stored.colors[key].toLowerCase();
        }
    }
    for (const field of RANGE_FIELDS) {
        result[field.key] = clamp(stored[field.key], field, DEFAULTS[field.key]);
    }
    for (const [key] of TOGGLE_FIELDS) {
        if (typeof stored[key] === "boolean") result[key] = stored[key];
    }
    if (TEMP_UNITS.some(([unit]) => unit === stored.tempUnit)) {
        result.tempUnit = stored.tempUnit;
    }
    return result;
}

function luminance(hex) {
    const channel = (offset) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const readableOn = (hex) => (luminance(hex) > 0.4 ? "#0b1020" : "#ffffff");

function buildTheme(s) {
    const { colors } = s;
    return {
        vars: {
            "--bg-base": colors.background,
            "--text": colors.text,
            "--accent": colors.accent,
            "--on-accent": readableOn(colors.accent),
            "--danger": colors.danger,
            "--on-danger": readableOn(colors.danger),
            "--panel-color": colors.panel,
            "--panel-opacity": `${s.panelOpacity}%`,
            "--glow-1-color": colors.glow1,
            "--glow-2-color": colors.glow2,
            "--glow-3-color": colors.glow3,
            "--glow-intensity": String(s.glowIntensity / 100),
            "--glass-blur": `${s.blur}px`,
            "--tile-scale": String(s.tileSize / 100),
            "--radius-scale": String(s.roundness / 100),
        },
        scheme: luminance(colors.background) > 0.4 ? "light" : "dark",
        classes: {
            "hide-date": !s.showDate,
            "hide-weather": !s.showWeather,
        },
    };
}

function applyTheme() {
    const theme = buildTheme(settings);
    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme.vars)) {
        root.style.setProperty(name, value);
    }
    root.style.colorScheme = theme.scheme;
    for (const [name, on] of Object.entries(theme.classes)) {
        root.classList.toggle(name, on);
    }
    try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
    } catch {
        // Cache is only a first-paint optimisation.
    }
}

/* ------------------------------------------------------------------------
   State
   ------------------------------------------------------------------------ */

function setSettings(next, { save = true } = {}) {
    const previous = settings;
    settings = normalize(next);
    applyTheme();
    syncControls();
    for (const listener of listeners) listener(settings, previous);
    if (save) scheduleSave();
}

function update(patch) {
    setSettings({
        ...settings,
        ...patch,
        colors: { ...settings.colors, ...patch.colors },
    });
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        chrome.storage.sync
            .set({ [STORAGE_KEY]: settings })
            .catch((error) => console.warn("Saving settings failed:", error));
    }, SAVE_DELAY_MS);
}

function activePresetKey() {
    return Object.keys(PRESETS).find((key) => {
        const preset = PRESETS[key];
        return (
            COLOR_FIELDS.every(
                ([field]) => preset.colors[field] === settings.colors[field],
            ) &&
            preset.glowIntensity === settings.glowIntensity &&
            preset.panelOpacity === settings.panelOpacity
        );
    });
}

/* ------------------------------------------------------------------------
   Panel UI
   ------------------------------------------------------------------------ */

function el(tag, className, props = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return Object.assign(node, props);
}

function section(title, ...children) {
    const wrapper = el("section", "settings-section");
    wrapper.append(el("h3", "settings-heading", { textContent: title }), ...children);
    return wrapper;
}

function buildPresets() {
    const list = el("div", "settings-presets");
    controls.presets = {};
    for (const [key, preset] of Object.entries(PRESETS)) {
        const button = el("button", "settings-preset", { type: "button" });
        const { background, glow1, glow2, accent } = preset.colors;
        const swatch = el("span", "settings-preset-swatch");
        swatch.style.background = `radial-gradient(circle at 30% 30%, ${glow1}, transparent 70%), radial-gradient(circle at 75% 75%, ${glow2}, transparent 65%), ${background}`;
        swatch.style.boxShadow = `inset 0 0 0 2px ${accent}55`;
        button.append(swatch, el("span", "settings-preset-label", { textContent: preset.label }));
        button.addEventListener("click", () =>
            update({
                colors: preset.colors,
                glowIntensity: preset.glowIntensity,
                panelOpacity: preset.panelOpacity,
            }),
        );
        controls.presets[key] = button;
        list.append(button);
    }
    return list;
}

function buildColors() {
    const grid = el("div", "settings-colors");
    controls.colors = {};
    for (const [key, label] of COLOR_FIELDS) {
        const row = el("label", "settings-color");
        const input = el("input", "settings-color-input", { type: "color" });
        input.addEventListener("input", () =>
            update({ colors: { [key]: input.value } }),
        );
        row.append(input, el("span", "settings-color-label", { textContent: label }));
        controls.colors[key] = input;
        grid.append(row);
    }
    return grid;
}

function buildRanges() {
    const list = el("div", "settings-list");
    controls.ranges = {};
    for (const field of RANGE_FIELDS) {
        const row = el("label", "settings-row");
        const value = el("output", "settings-value");
        const input = el("input", "settings-range", {
            type: "range",
            min: field.min,
            max: field.max,
            step: field.step,
        });
        input.addEventListener("input", () =>
            update({ [field.key]: Number(input.value) }),
        );
        const head = el("span", "settings-row-head");
        head.append(el("span", "settings-row-label", { textContent: field.label }), value);
        row.append(head, input);
        controls.ranges[field.key] = { input, value, unit: field.unit };
        list.append(row);
    }
    return list;
}

function buildToggles() {
    const list = el("div", "settings-list");
    controls.toggles = {};
    for (const [key, label] of TOGGLE_FIELDS) {
        const row = el("label", "settings-row settings-row--inline");
        const input = el("input", "settings-switch", {
            type: "checkbox",
            role: "switch",
        });
        input.addEventListener("change", () => update({ [key]: input.checked }));
        row.append(el("span", "settings-row-label", { textContent: label }), input);
        controls.toggles[key] = input;
        list.append(row);
    }

    const unitRow = el("div", "settings-row settings-row--inline");
    const segmented = el("div", "settings-segmented", { role: "group" });
    segmented.setAttribute("aria-label", "Temperature unit");
    controls.units = {};
    for (const [unit, label] of TEMP_UNITS) {
        const button = el("button", "settings-segment", { type: "button", textContent: label });
        button.addEventListener("click", () => update({ tempUnit: unit }));
        controls.units[unit] = button;
        segmented.append(button);
    }
    unitRow.append(el("span", "settings-row-label", { textContent: "Temperature" }), segmented);
    controls.unitRow = unitRow;
    list.append(unitRow);
    return list;
}

function buildResetButton() {
    const button = el("button", "btn btn--ghost settings-reset", {
        type: "button",
        textContent: "Reset to defaults",
    });
    let armedTimer;
    // Two-step confirm: first click arms, second click (within 3s) resets.
    button.addEventListener("click", () => {
        if (button.classList.contains("is-armed")) {
            clearTimeout(armedTimer);
            button.classList.remove("is-armed");
            button.textContent = "Reset to defaults";
            setSettings(DEFAULTS);
            return;
        }
        button.classList.add("is-armed");
        button.textContent = "Click again to reset";
        armedTimer = setTimeout(() => {
            button.classList.remove("is-armed");
            button.textContent = "Reset to defaults";
        }, 3000);
    });
    return button;
}

function syncControls() {
    if (!controls.colors) return;
    const presetKey = activePresetKey();
    for (const [key, button] of Object.entries(controls.presets)) {
        button.setAttribute("aria-pressed", String(key === presetKey));
    }
    for (const [key, input] of Object.entries(controls.colors)) {
        input.value = settings.colors[key];
    }
    for (const [key, { input, value, unit }] of Object.entries(controls.ranges)) {
        input.value = settings[key];
        value.textContent = `${settings[key]}${unit}`;
    }
    for (const [key, input] of Object.entries(controls.toggles)) {
        input.checked = settings[key];
    }
    for (const [unit, button] of Object.entries(controls.units)) {
        button.setAttribute("aria-pressed", String(unit === settings.tempUnit));
    }
    controls.unitRow.hidden = !settings.showWeather;
}

function setupPanel() {
    const toggle = document.getElementById("settings-toggle");
    const panel = document.getElementById("settings-panel");
    toggle.innerHTML = gearIcon;

    const header = el("header", "settings-header");
    const close = el("button", "settings-close", { type: "button", innerHTML: closeIcon });
    close.setAttribute("aria-label", "Close settings");
    header.append(el("h2", "settings-title", { textContent: "Customize" }), close);

    const body = el("div", "settings-body");
    body.append(
        section("Theme", buildPresets()),
        section("Colors", buildColors()),
        section("Appearance", buildRanges()),
        section("Clock & weather", buildToggles()),
    );

    const footer = el("footer", "settings-footer");
    footer.append(buildResetButton());
    panel.append(header, body, footer);
    syncControls();

    const setOpen = (open) => {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (open) {
            panel.querySelector("button, input")?.focus();
        }
    };

    toggle.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => {
        setOpen(false);
        toggle.focus();
    });

    document.addEventListener(
        "pointerdown",
        (event) => {
            if (panel.hidden) return;
            if (panel.contains(event.target) || toggle.contains(event.target)) return;
            setOpen(false);
        },
        true,
    );

    // Capture phase so Esc closes the panel without also leaving bookmark edit mode.
    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key !== "Escape" || panel.hidden) return;
            event.stopPropagation();
            setOpen(false);
            toggle.focus();
        },
        true,
    );
}

/* ------------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------------ */

export function onSettingsChange(listener) {
    listeners.add(listener);
}

export function getSettings() {
    return settings;
}

export async function initSettings() {
    try {
        const stored = await chrome.storage.sync.get(STORAGE_KEY);
        settings = normalize(stored[STORAGE_KEY]);
    } catch (error) {
        console.warn("Loading settings failed:", error);
    }
    applyTheme();
    setupPanel();

    // Keep other open new-tab pages in sync.
    chrome.storage.onChanged.addListener((changes, area) => {
        const change = changes[STORAGE_KEY];
        if (area !== "sync" || !change) return;
        const incoming = normalize(change.newValue);
        if (JSON.stringify(incoming) !== JSON.stringify(settings)) {
            setSettings(incoming, { save: false });
        }
    });

    return settings;
}
