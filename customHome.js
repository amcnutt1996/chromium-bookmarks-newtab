import weatherWidget from "./weather.js";
import { addBookmarksToPage } from "./bookmarks.js";
import { editIcon } from "./icons.js";
import { initSettings, getSettings, onSettingsChange } from "./settings.js";

const timeFormat = (use24h) =>
    new Intl.DateTimeFormat(undefined, {
        hour: use24h ? "2-digit" : "numeric",
        minute: "2-digit",
        hourCycle: use24h ? "h23" : "h12",
    });
const dateFormat = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
});

let clockTimer;

const renderClock = () => {
    const now = new Date();
    const parts = timeFormat(getSettings().clock24h).formatToParts(now);

    // Show the AM/PM marker (if the locale uses one) in its own, smaller span.
    const time = parts
        .filter((part) => part.type !== "dayPeriod")
        .map((part) => part.value)
        .join("")
        .trim();
    const period = parts.find((part) => part.type === "dayPeriod");

    document.getElementById("clock-time").textContent = time;
    document.getElementById("clock-period").textContent = period
        ? period.value
        : "";
    document.getElementById("clock").dateTime = now.toISOString();
    document.getElementById("date").textContent = dateFormat.format(now);
};

const updateClock = () => {
    clearTimeout(clockTimer);
    renderClock();

    // Re-render right after the next minute boundary.
    const msToNextMinute = 60000 - (Date.now() % 60000);
    clockTimer = setTimeout(updateClock, msToNextMinute + 50);
};

const startClock = () => {
    updateClock();

    // Timers are throttled in background tabs, so resync when shown again.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            updateClock();
        }
    });
};

const CustomHome = async () => {
    const settings = await initSettings();
    startClock();
    document.querySelector("#edit-toggle .edit-toggle-icon").innerHTML =
        editIcon;
    addBookmarksToPage();
    if (settings.showWeather) {
        weatherWidget(settings.tempUnit);
    }

    onSettingsChange((next, previous) => {
        if (next.clock24h !== previous.clock24h) {
            updateClock();
        }
        const weatherTurnedOn = next.showWeather && !previous.showWeather;
        const unitChanged = next.tempUnit !== previous.tempUnit;
        if (next.showWeather && (weatherTurnedOn || unitChanged)) {
            weatherWidget(next.tempUnit);
        }
    });
};

CustomHome();
