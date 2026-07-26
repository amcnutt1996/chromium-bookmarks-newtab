export const DEFAULT_SETTINGS = {
	//chill defaults
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

//build the dialog items based on the toggleable settings
const buildWeatherSettingsWidget = (settings) => {
	const dialog = document.getElementById("weather-settings-dialog");
	const form = document.getElementById("weather-settings-form");
	const settingsFields = document.getElementById("weather-settings-fields");
	settingsFields.appendChild(
		document.createElement("option").setAttribute("text", "asdf"),
	);

	dialog.showModal();
};

export const weatherSettingsButton = (settings) => {
	const btn = document
		.getElementById("weather-settings")
		.addEventListener("click", () => {
			buildWeatherSettingsWidget(settings);
		});
};
