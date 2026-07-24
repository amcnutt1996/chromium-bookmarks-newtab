// Weather request "types" + Open-Meteo URL builder.
// Docs: https://open-meteo.com/en/docs

// ── Reference: variables Open-Meteo offers per section ──────────────
// Pull from these when building a settings UI. Note the daily section
// uses aggregated names (*_max / *_min / *_sum), not the raw hourly ones.
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

// ── The request "struct": location + shared settings + 3 sections ───
// Anything left `undefined` is simply omitted from the URL, so every
// setting is optional. Enable whichever section(s) the user wants shown
// (multi-select — current / hourly / daily can be on together).
export const createWeatherRequest = (overrides = {}) => ({
	// required
	latitude: undefined,
	longitude: undefined,

	// shared optional settings
	temperature_unit: "fahrenheit", // "celsius" | "fahrenheit"
	wind_speed_unit: undefined, // "kmh" | "ms" | "mph" | "kn"
	precipitation_unit: undefined, // "mm" | "inch"
	timezone: "auto", // needed for correct daily day-boundaries
	past_days: undefined, // applies to hourly/daily only
	forecast_days: undefined, // applies to hourly/daily only

	// the three sections — flip `enabled` to include one in the request
	current: { enabled: false, variables: [] },
	hourly: { enabled: false, variables: [] },
	daily: { enabled: false, variables: [] },

	...overrides,
});

// ── Builder: config object → Open-Meteo URL ─────────────────────────
export const buildWeatherURL = (req) => {
	const params = new URLSearchParams();
	params.set("latitude", req.latitude);
	params.set("longitude", req.longitude);

	// sections: only added when enabled AND they have variables selected
	for (const section of ["current", "hourly", "daily"]) {
		const cfg = req[section];
		if (cfg?.enabled && cfg.variables.length) {
			params.set(section, cfg.variables.join(","));
		}
	}

	// shared optional settings: only added when defined
	const optional = [
		"temperature_unit",
		"wind_speed_unit",
		"precipitation_unit",
		"timezone",
		"past_days",
		"forecast_days",
	];
	for (const key of optional) {
		if (req[key] !== undefined && req[key] !== null) {
			params.set(key, req[key]);
		}
	}

	return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
};
