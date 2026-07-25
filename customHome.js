// Wire the gear button, cancel button, and form submit to the settings panel.
// const pageSettingsPanel = () => {
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

const updateClock = () => {
	const clock = document.getElementById("clock");
	setInterval(() => {
		let parts = new Date().toLocaleTimeString().split(" ")[0].split(":");
		document.getElementById("clock").textContent =
			parts[0] + ":" + parts[1];
		//  + ":" + parts[2];
	});
};

const CustomHome = async () => {
	updateClock();
};

CustomHome();
