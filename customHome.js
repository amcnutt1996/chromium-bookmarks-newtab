import { createWeatherRequest, buildWeatherURL } from "./weather.js";
import { loadSettings, saveSettings } from "./settings.js";
import { buildSettingsForm, readSettingsForm } from "./settingsPanel.js";

// Loaded once on startup and updated when the user saves the panel.
let currentSettings = null;
// IP geolocation is cached so saving settings doesn't re-hit the API each time.
let currentGeo = null;

const ExtractNumDays = (data, daysPast, daysForecast) => {
	// console.log(data, daysPast, daysForecast);
	// let time = data.time;
	// console.log(`TIME ${time}`);
	// let apparent_temp = data.apparent_temperature;
	// console.log(`APPARENT_TEMP_ALL ${apparent_temp}`);
	// let cloud_cover = data.cloud_cover;
	// console.log(`CLOUD_COVER_ALL ${cloud_cover}`);
	// let precip_current = data.precipitation;
	// console.log(`PRECIPITATION_CURRENT ${precip_current}`);
	// let precip_prob = data.precipitation_probability;
	// console.log(`PRECIPITATION_PROBABILITY ${precip_prob}`);
	// let temp = data.temperature_2m;
	// console.log(`TEMPERATURES ${temp}`);
	// let vis = data.visibility;
	// console.log(`VISIBILITY_ALL ${vis}`);
};

// geo.latitude, geo.longitude, geo.city, geo.region, geo.country
const getLocation = async () => {
	if (!currentGeo) {
		currentGeo = await (await fetch("https://ipwho.is/")).json();
	}
	return currentGeo;
};

// Render the enabled sections into #weather-output. Open-Meteo returns each
// section under its own key (data.current / data.hourly / data.daily) with a
// matching *_units object; hourly/daily values are arrays, current is scalar.
const renderWeather = (data, weather) => {
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
			if (v in data.current) addLine(`${v}: ${data.current[v]}${units[v] ?? ""}`);
		}
	}
	if (weather.daily.enabled && data.daily) {
		const units = data.daily_units ?? {};
		for (const v of weather.daily.variables) {
			const values = data.daily[v];
			if (Array.isArray(values)) addLine(`${v} (today): ${values[0]}${units[v] ?? ""}`);
		}
	}
	if (weather.hourly.enabled && data.hourly) {
		const units = data.hourly_units ?? {};
		for (const v of weather.hourly.variables) {
			const values = data.hourly[v];
			if (Array.isArray(values)) addLine(`${v} (now): ${values[0]}${units[v] ?? ""}`);
		}
	}
};

const updateWeather = async () => {
	const geo = await getLocation();
	const lat = geo.latitude.toFixed(4);
	const lon = geo.longitude.toFixed(4);

	document.getElementById("city").innerText = geo.city;
	document.getElementById("region").innerText = geo.region;

	const req = createWeatherRequest({
		latitude: lat,
		longitude: lon,
		...currentSettings.weather, // units, days, and the three sections
	});
	const url = buildWeatherURL(req);
	console.log(url);
	const data = await (await fetch(url)).json();
	console.log(data);
	renderWeather(data, currentSettings.weather);
};

// Wire the gear button, cancel button, and form submit to the settings panel.
const wireSettingsPanel = () => {
	const dialog = document.getElementById("settings-dialog");
	const form = document.getElementById("settings-form");

	document.getElementById("weather-menu").addEventListener("click", () => {
		buildSettingsForm(currentSettings);
		dialog.showModal();
	});
	document.getElementById("settings-cancel").addEventListener("click", () => {
		dialog.close();
	});
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		currentSettings = readSettingsForm(currentSettings);
		await saveSettings(currentSettings);
		dialog.close();
		await updateWeather();
	});
};

const updateClock = () => {
	const clock = document.getElementById("clock");
	setInterval(() => {
		let parts = new Date().toLocaleTimeString().split(" ")[0].split(":");
		document.getElementById("clock").textContent =
			parts[0] + ":" + parts[1] + ":" + parts[2];
	});
};

const CustomHome = async () => {
	currentSettings = await loadSettings();
	wireSettingsPanel();
	updateWeather();
	updateClock();
};

CustomHome();

// const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01&current=temperature_2m,weather_code&temperature_unit=fahrenheit");
// const data = await res.json();
// const temp = data.current.temperature_2m;
// const code = data.current.weather_code; // map this WMO number → text/emoji yourself
