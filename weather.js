import {
    sunIcon,
    moonIcon,
    cloudIcon,
    partlyCloudyDayIcon,
    partlyCloudyNightIcon,
    fogIcon,
    drizzleIcon,
    rainIcon,
    snowIcon,
    thunderIcon,
} from "./icons.js";

// Open-Meteo WMO weather codes -> [label, icon kind]
const WEATHER_CODES = {
    0: ["Clear", "clear"],
    1: ["Mainly clear", "clear"],
    2: ["Partly cloudy", "partly"],
    3: ["Overcast", "cloud"],
    45: ["Fog", "fog"],
    48: ["Freezing fog", "fog"],
    51: ["Light drizzle", "drizzle"],
    53: ["Drizzle", "drizzle"],
    55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "drizzle"],
    57: ["Freezing drizzle", "drizzle"],
    61: ["Light rain", "rain"],
    63: ["Rain", "rain"],
    65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"],
    67: ["Freezing rain", "rain"],
    71: ["Light snow", "snow"],
    73: ["Snow", "snow"],
    75: ["Heavy snow", "snow"],
    77: ["Snow grains", "snow"],
    80: ["Light showers", "rain"],
    81: ["Showers", "rain"],
    82: ["Heavy showers", "rain"],
    85: ["Snow showers", "snow"],
    86: ["Heavy snow showers", "snow"],
    95: ["Thunderstorm", "thunder"],
    96: ["Thunderstorm with hail", "thunder"],
    99: ["Thunderstorm with hail", "thunder"],
};

const ICONS = {
    cloud: cloudIcon,
    fog: fogIcon,
    drizzle: drizzleIcon,
    rain: rainIcon,
    snow: snowIcon,
    thunder: thunderIcon,
};

function describeWeather(code, isDay) {
    const [label, kind] = WEATHER_CODES[code] || ["Unknown", "cloud"];
    let icon = ICONS[kind];
    if (kind === "clear") {
        icon = isDay ? sunIcon : moonIcon;
    } else if (kind === "partly") {
        icon = isDay ? partlyCloudyDayIcon : partlyCloudyNightIcon;
    }
    return { label, icon };
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`);
    }
    return response.json();
}

async function getLocation() {
    const geoData = await fetchJson("http://ip-api.com/json/");
    if (typeof geoData.lat !== "number" || typeof geoData.lon !== "number") {
        throw new Error("Location lookup failed");
    }
    return geoData;
}

async function getWeather(lat, lon) {
    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current:
            "temperature_2m,apparent_temperature,precipitation,weather_code,is_day",
        timezone: "auto",
        temperature_unit: "fahrenheit",
        precipitation_unit: "inch",
    });
    const weatherData = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?${params}`,
    );
    if (!weatherData.current) {
        throw new Error("Weather response missing current conditions");
    }
    return weatherData;
}

function formatTemp(value) {
    return typeof value === "number" ? `${Math.round(value)}°` : "--";
}

function formatPrecip(value, unit) {
    if (typeof value !== "number") {
        return "--";
    }
    const shortUnit = unit === "inch" ? "in" : unit || "";
    return `${value} ${shortUnit}`.trim();
}

function setState(card, state) {
    card.classList.remove("is-loading", "is-error", "is-ready");
    card.classList.add(state);
    card.setAttribute("aria-busy", state === "is-loading" ? "true" : "false");
}

export default async function weatherWidget() {
    const card = document.getElementById("weather-container");
    const condition = document.getElementById("weather-condition");

    try {
        const locationData = await getLocation();
        const weatherData = await getWeather(
            locationData.lat,
            locationData.lon,
        );
        const current = weatherData.current;
        const units = weatherData.current_units || {};
        const { label, icon } = describeWeather(
            current.weather_code,
            current.is_day === 1,
        );

        document.getElementById("weather-icon").innerHTML = icon;
        document.getElementById("weather-temp").textContent = formatTemp(
            current.temperature_2m,
        );
        document.getElementById("weather-feels").textContent = formatTemp(
            current.apparent_temperature,
        );
        document.getElementById("weather-precip").textContent = formatPrecip(
            current.precipitation,
            units.precipitation,
        );
        condition.textContent = label;
        setState(card, "is-ready");
    } catch (error) {
        console.warn("Weather unavailable:", error);
        document.getElementById("weather-icon").innerHTML = cloudIcon;
        condition.textContent = "Weather unavailable";
        setState(card, "is-error");
    }
}
