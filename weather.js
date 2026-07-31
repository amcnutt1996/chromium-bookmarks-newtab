async function getLocation() {
    const endpoint = "http://ip-api.com/json/";

    const response = await fetch(endpoint);
    const geoData = await response.json();
    return geoData;
}

async function getWeather(lat, lon) {
    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,rain,showers,snowfall,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,surface_pressure&timezone=auto&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch`,
    );
    const weatherData = await response.json();
    return weatherData;
}

export default async function weatherWidget() {
    const locationData = await getLocation();
    const weatherData = await getWeather(locationData.lat, locationData.lon);

    // const zip = locationData.zip;
    // const city = locationData.city;
    const currentTemp = [
        weatherData.current.apparent_temperature,
        weatherData.current_units.apparent_temperature,
    ];
    const currentPrecip = [
        weatherData.current.precipitation,
        weatherData.current_units.precipitation,
    ];
    const elevation = [weatherData.elevation];

    //might add this back later, idk if its worth with non-super accurate location
    // const zipField = document.getElementById("zip-value");
    // zipField.innerText = zip;
    // const cityField = document.getElementById("city-value");
    // cityField.innerText = city;
    const currTempField = document.getElementById("curr-temp-value");
    currTempField.innerText = `${currentTemp[0]} ${currentTemp[1]}`;
    const currPrecipField = document.getElementById("curr-precip-value");
    currPrecipField.innerText = `${currentPrecip[0]} ${currentPrecip[1]}`;
    const elevationField = document.getElementById("elevation-value");
    elevationField.innerText = `${elevation} ft`;
}
