import {
	buildWeatherSettingsForm,
	readWeatherSettings,
	loadWeatherSettings,
	saveWeatherSettings,
} from "./_weatherSettingsPanel.js";
// import { buildWeatherSettingsForm } from "./weatherSettingsPanel";
// Weather request "types" + Open-Meteo URL builder.
// Docs: https://open-meteo.com/en/docs

// ── Reference: variables Open-Meteo offers per section ──────────────
// Pull from these when building a settings UI. Note the daily section
// uses aggregated names (*_max / *_min / *_sum), not the raw hourly ones.

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

// Weather logic
// geo.latitude, geo.longitude, geo.city, geo.region, geo.country
const getLocation = async () => {
	if (!currentGeo) {
		currentGeo = await (await fetch("https://ipwho.is/")).json();
	}
	return currentGeo;
};

// Loaded once on startup and updated when the user saves the panel.
let currentWeatherSettings = null;
// IP geolocation is cached so saving settings doesn't re-hit the API each time.
let currentGeo = null;

// Render the enabled sections into #weather-output. Open-Meteo returns each
// section under its own key (data.current / data.hourly / data.daily) with a
// matching *_units object; hourly/daily values are arrays, current is scalar.
export const renderWeather = (data, weather) => {
	const out = document.getElementById("weather-output");
	if (!out) return;
	out.replaceChildren();

	const addLine = (text) => {
		const line = document.createElement("p");
		line.className = "weather-line";
		line.textContent = text;
		out.append(line);
	};

	if (weather.current.enabled && data.current) {
		const units = data.current_units ?? {};
		for (const v of weather.current.variables) {
			if (v in data.current)
				addLine(`${v}: ${data.current[v]}${units[v] ?? ""}`);
		}
	}
	if (weather.daily.enabled && data.daily) {
		const units = data.daily_units ?? {};
		for (const v of weather.daily.variables) {
			const values = data.daily[v];
			if (Array.isArray(values))
				addLine(`${v} (today): ${values[0]}${units[v] ?? ""}`);
		}
	}
	if (weather.hourly.enabled && data.hourly) {
		const units = data.hourly_units ?? {};
		for (const v of weather.hourly.variables) {
			const values = data.hourly[v];
			if (Array.isArray(values))
				addLine(`${v} (now): ${values[0]}${units[v] ?? ""}`);
		}
	}
};

export const updateWeather = async () => {
	currentWeatherSettings = await loadWeatherSettings();

	//TODO: need to add 'ghost' elements before data loads so it doesn't look empty then full of data.
	const geo = await getLocation();
	const lat = geo.latitude.toFixed(4);
	const lon = geo.longitude.toFixed(4);

	document.getElementById("city").innerText = geo.city;
	document.getElementById("region").innerText = geo.region;

	const req = createWeatherRequest({
		latitude: lat,
		longitude: lon,
		...currentWeatherSettings.weather, // units, days, and the three sections
	});
	const url = buildWeatherURL(req);
	console.log(url);
	const data = await (await fetch(url)).json();
	console.log(data);
	renderWeather(data, currentWeatherSettings.weather);
};

// export const weatherPanel = () => {
// 	const dialog = document.getElementById("settings-dialog");
// 	const form = document.getElementById("settings-form");

// 	document.getElementById("weather-menu").addEventListener("click", () => {
// 		buildWeatherSettingsForm(currentSettings);
// 		dialog.showModal();
// 	});
// 	document.getElementById("settings-cancel").addEventListener("click", () => {
// 		dialog.close();
// 	});
// 	form.addEventListener("submit", async (event) => {
// 		event.preventDefault();
// 		currentSettings = readWeatherSettings(currentSettings);
// 		await saveWeatherSettings(currentSettings);
// 		dialog.close();
// 		await updateWeather();
// 	});
// };
