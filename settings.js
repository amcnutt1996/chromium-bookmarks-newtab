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
			variables: ["temperature_2m", "weather_code", "apparent_temperature"],
		},
		hourly: {
			enabled: false,
			variables: ["temperature_2m", "precipitation_probability", "weather_code"],
		},
		daily: {
			enabled: true,
			variables: ["temperature_2m_max", "temperature_2m_min", "weather_code"],
		},
	},
};

const isPlainObject = (value) =>
	value !== null && typeof value === "object" && !Array.isArray(value);

// Recursively merge `saved` over `defaults`, iterating the DEFAULTS keys so the
// result always conforms to the current schema. Plain objects recurse; arrays
// and primitives take the saved value when present (so an intentionally empty
// `variables: []` is preserved rather than falling back to the default list).
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
export const loadSettings = async () => {
	const stored = await chrome.storage.sync.get(STORAGE_KEY);
	return mergeDefaults(DEFAULT_SETTINGS, stored[STORAGE_KEY] ?? {});
};

// Persist the full settings object.
export const saveSettings = async (settings) => {
	await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
};
