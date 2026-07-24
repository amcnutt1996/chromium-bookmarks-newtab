// Settings panel UI: renders a form from WEATHER_VARIABLES + the current
// settings, and reads that form back into a settings object. The form is
// rebuilt from scratch each time the panel opens, so it always reflects the
// variables currently declared in weather.js.

import { WEATHER_VARIABLES } from "./weather.js";

const SECTIONS = ["current", "hourly", "daily"];

// Allowed values for each unit <select>; first entry is just the listing order.
const UNIT_OPTIONS = {
	temperature_unit: ["fahrenheit", "celsius"],
	wind_speed_unit: ["mph", "kmh", "ms", "kn"],
	precipitation_unit: ["inch", "mm"],
};

// The container inside <form id="settings-form"> that we fill/clear. Keeping the
// form's action buttons outside this element means rebuilding never wipes them.
const fieldsEl = () => document.getElementById("settings-fields");

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
export const buildSettingsForm = (settings) => {
	const container = fieldsEl();
	container.replaceChildren();
	const weather = settings.weather;

	// Units + forecast range.
	const shared = document.createElement("fieldset");
	shared.className = "settings-section";
	const legend = document.createElement("legend");
	legend.textContent = "units & range";
	shared.append(legend);
	shared.append(
		labeled("temperature", buildUnitSelect("temperature_unit", weather.temperature_unit)),
		labeled("wind speed", buildUnitSelect("wind_speed_unit", weather.wind_speed_unit)),
		labeled("precipitation", buildUnitSelect("precipitation_unit", weather.precipitation_unit)),
		labeled("past days", buildNumberInput("past_days", weather.past_days, { min: 0, max: 92 })),
		labeled("forecast days", buildNumberInput("forecast_days", weather.forecast_days, { min: 1, max: 16 })),
	);
	container.append(shared);

	// One fieldset per weather section.
	for (const section of SECTIONS) {
		container.append(buildSectionFieldset(section, weather[section]));
	}
};

// Read #settings-fields back into a new settings object, preserving any
// non-weather keys (e.g. version) from `baseSettings`.
export const readSettingsForm = (baseSettings) => {
	const container = fieldsEl();
	const weather = { ...baseSettings.weather };

	for (const [key] of Object.entries(UNIT_OPTIONS)) {
		const select = container.querySelector(`select[data-unit="${key}"]`);
		if (select) weather[key] = select.value;
	}

	for (const key of ["past_days", "forecast_days"]) {
		const input = container.querySelector(`input[data-days="${key}"]`);
		if (input) {
			const num = Number(input.value);
			weather[key] = Number.isFinite(num) ? num : baseSettings.weather[key];
		}
	}

	for (const section of SECTIONS) {
		const enabled = container.querySelector(`input[data-section-enabled="${section}"]`);
		const variables = [
			...container.querySelectorAll(`input[data-section="${section}"]:checked`),
		].map((cb) => cb.dataset.variable);
		weather[section] = { enabled: Boolean(enabled?.checked), variables };
	}

	return { ...baseSettings, weather };
};
