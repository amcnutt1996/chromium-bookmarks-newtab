// Classic (non-module) script loaded in <head>: applies the cached theme
// synchronously so the page doesn't flash default colors before settings.js
// has read chrome.storage.
(function () {
    try {
        const theme = JSON.parse(localStorage.getItem("newtab-theme"));
        if (!theme) return;
        const root = document.documentElement;
        for (const [name, value] of Object.entries(theme.vars)) {
            root.style.setProperty(name, value);
        }
        root.style.colorScheme = theme.scheme;
        for (const [name, on] of Object.entries(theme.classes)) {
            root.classList.toggle(name, on);
        }
    } catch {
        // No cache yet (or it's unreadable): fall back to CSS defaults.
    }
})();
