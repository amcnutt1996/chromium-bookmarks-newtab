// Settings panel UI: renders a form from WEATHER_VARIABLES + the current
// settings, and reads that form back into a settings object. The form is
// rebuilt from scratch each time the panel opens, so it always reflects the
// variables currently declared in weather.js.

export const WEATHER_VARIABLES = {
	current: [
		"temperature_2m",
		"apparent_temperature",
		"precipitation",
		"weather_code",
		"wind_speed_10m",
		"relative_humidity_2m",
		"cloud_cover",
		"is_day",
	],
	hourly: [
		"temperature_2m",
		"apparent_temperature",
		"precipitation",
		"precipitation_probability",
		"weather_code",
		"visibility",
		"cloud_cover",
		"wind_speed_10m",
		"relative_humidity_2m",
	],
	daily: [
		"temperature_2m_max",
		"temperature_2m_min",
		"apparent_temperature_max",
		"apparent_temperature_min",
		"precipitation_sum",
		"rain_sum",
		"precipitation_probability_max",
		"weather_code",
		"wind_speed_10m_max",
		"wind_gusts_10m_max",
		"wind_direction_10m_dominant",
		"uv_index_max",
		"sunrise",
		"sunset",
		"daylight_duration",
		"sunshine_duration",
	],
};

// Persistent user settings, backed by chrome.storage.sync so choices roam
// across the user's signed-in browsers and survive between sessions.
//
// DEFAULT_SETTINGS is the single source of truth for the settings *shape*.
// Storage holds the full current settings object; on load we merge it over
// the defaults (see mergeDefaults) so the result always matches the current
// schema — newly added settings get defaults, removed ones are dropped.

export const STORAGE_KEY = "settings";

export const DEFAULT_SETTINGS = {
	version: 1,
	weather: {
		temperature_unit: "fahrenheit", // "celsius" | "fahrenheit"
		wind_speed_unit: "mph", // "kmh" | "ms" | "mph" | "kn"
		precipitation_unit: "inch", // "mm" | "inch"
		past_days: 0,
		forecast_days: 3,
		current: {
			enabled: true,
			variables: [
				"temperature_2m",
				"weather_code",
				"apparent_temperature",
			],
		},
		hourly: {
			enabled: false,
			variables: [
				"temperature_2m",
				"precipitation_probability",
				"weather_code",
			],
		},
		daily: {
			enabled: true,
			variables: [
				"temperature_2m_max",
				"temperature_2m_min",
				"weather_code",
			],
		},
	},
};

const SECTIONS = ["current", "hourly", "daily"];

// Allowed values for each unit <select>; first entry is just the listing order.
const UNIT_OPTIONS = {
	temperature_unit: ["fahrenheit", "celsius"],
	wind_speed_unit: ["mph", "kmh", "ms", "kn"],
	precipitation_unit: ["inch", "mm"],
};

const labeled = (labelText, control) => {
	const label = document.createElement("label");
	label.className = "settings-field";
	label.append(control, document.createTextNode(` ${labelText}`));
	return label;
};

const buildUnitSelect = (key, value) => {
	const select = document.createElement("select");
	select.dataset.unit = key;
	for (const option of UNIT_OPTIONS[key]) {
		const opt = document.createElement("option");
		opt.value = option;
		opt.textContent = option;
		if (option === value) opt.selected = true;
		select.append(opt);
	}
	return select;
};

const buildNumberInput = (key, value, { min, max }) => {
	const input = document.createElement("input");
	input.type = "number";
	input.dataset.days = key;
	input.min = String(min);
	input.max = String(max);
	input.value = String(value);
	return input;
};

const buildSectionFieldset = (section, sectionSettings) => {
	const fieldset = document.createElement("fieldset");
	fieldset.className = "settings-section";

	// Legend carries the section on/off toggle.
	const legend = document.createElement("legend");
	const enabled = document.createElement("input");
	enabled.type = "checkbox";
	enabled.dataset.sectionEnabled = section;
	enabled.checked = Boolean(sectionSettings.enabled);
	legend.append(enabled, document.createTextNode(` ${section}`));
	fieldset.append(legend);

	// One checkbox per variable Open-Meteo offers for this section.
	const selected = new Set(sectionSettings.variables ?? []);
	for (const variable of WEATHER_VARIABLES[section]) {
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.dataset.section = section;
		checkbox.dataset.variable = variable;
		checkbox.checked = selected.has(variable);
		fieldset.append(labeled(variable, checkbox));
	}
	return fieldset;
};

// Populate #settings-fields to reflect `settings`.
export const buildWeatherSettingsForm = (settings) => {
	const container = document.getElementById("weather-settings-form");
	container.replaceChildren();
	const weather = settings.weather;

	// Units + forecast range.
	const shared = document.createElement("fieldset");
	shared.className = "settings-section";
	const legend = document.createElement("legend");
	legend.textContent = "units & range";
	shared.append(legend);
	shared.append(
		labeled(
			"temperature",
			buildUnitSelect("temperature_unit", weather.temperature_unit),
		),
		labeled(
			"wind speed",
			buildUnitSelect("wind_speed_unit", weather.wind_speed_unit),
		),
		labeled(
			"precipitation",
			buildUnitSelect("precipitation_unit", weather.precipitation_unit),
		),
		labeled(
			"past days",
			buildNumberInput("past_days", weather.past_days, {
				min: 0,
				max: 92,
			}),
		),
		labeled(
			"forecast days",
			buildNumberInput("forecast_days", weather.forecast_days, {
				min: 1,
				max: 16,
			}),
		),
	);
	container.append(shared);

	// One fieldset per weather section.
	for (const section of SECTIONS) {
		container.append(buildSectionFieldset(section, weather[section]));
	}
};

// Read #settings-fields back into a new settings object, preserving any
// non-weather keys (e.g. version) from `baseSettings`.
export const readWeatherSettings = (baseSettings) => {
	const container = document.getElementById("weather-settings-fields");
	const weather = { ...baseSettings.weather };

	for (const [key] of Object.entries(UNIT_OPTIONS)) {
		const select = container.querySelector(`select[data-unit="${key}"]`);
		if (select) weather[key] = select.value;
	}

	for (const key of ["past_days", "forecast_days"]) {
		const input = container.querySelector(`input[data-days="${key}"]`);
		if (input) {
			const num = Number(input.value);
			weather[key] =
				Number.isFinite(num) ? num : baseSettings.weather[key];
		}
	}

	for (const section of SECTIONS) {
		const enabled = container.querySelector(
			`input[data-section-enabled="${section}"]`,
		);
		const variables = [
			...container.querySelectorAll(
				`input[data-section="${section}"]:checked`,
			),
		].map((cb) => cb.dataset.variable);
		weather[section] = { enabled: Boolean(enabled?.checked), variables };
	}

	return { ...baseSettings, weather };
};

const isPlainObject = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value);

// Recursively merge `saved` over `defaults`, iterating the DEFAULTS keys so the
// result always conforms to the current schema. Plain objects recurse; arrays
// and primitives take the saved value when present (so an intentionally empty
// `variables: []` is preserved rather than falling back to the default list).
let defaults = DEFAULT_SETTINGS;
export const mergeDefaults = (defaults, saved) => {
	if (!isPlainObject(defaults)) {
		return saved === undefined ? defaults : saved;
	}
	if (!isPlainObject(saved)) {
		return defaults;
	}
	const merged = {};
	for (const key of Object.keys(defaults)) {
		merged[key] = mergeDefaults(defaults[key], saved[key]);
	}
	return merged;
};

// Read the saved settings and merge them over the defaults.
export const loadWeatherSettings = async () => {
	const stored = await chrome.storage.sync.get(STORAGE_KEY);
	return mergeDefaults(DEFAULT_SETTINGS, stored[STORAGE_KEY] ?? {});
};

// Persist the full settings object.
export const saveWeatherSettings = async (settings) => {
	await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
};

export const showWeatherSettingsDialog = () => {
	// let currentSettings = loadWeatherSettings();

	// The container inside <form id="settings-form"> that we fill/clear. Keeping the
	// form's action buttons outside this element means rebuilding never wipes them.
	const fieldsEl = () => document.getElementById("weather-settings-fields");

	let currentSettings = readWeatherSettings(fieldsEl);

	const weatherSettingsButton = document.getElementById("weather-menu");
	const weatherSettingsDialog = document.getElementById(
		"weather-settings-dialog",
	);
	const weatherSettingsForm = document.getElementById(
		"weather-settings-form",
	);

	weatherSettingsButton.addEventListener("click", () => {
		buildWeatherSettingsForm(fieldsEl);
		weatherSettingsDialog.showModal();
	});
};
