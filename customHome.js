import weatherWidget from "./weather.js";
import { addBookmarksToPage } from "./bookmarks.js";

const updateClock = () => {
    setInterval(() => {
        let parts = new Date().toLocaleTimeString().split(" ")[0].split(":");
        document.getElementById("clock").textContent =
            parts[0] + ":" + parts[1];
    });
};

const CustomHome = async () => {
    updateClock();
    addBookmarksToPage();
    weatherWidget();
};

CustomHome();
