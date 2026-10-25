// Inline SVG icons. Each export is a markup string that uses currentColor
// and has no width/height, so CSS controls color and size.

const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

// Shared shapes
const cloudPath =
    "M7 18.5h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z";
const moonPath = "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z";
const raisedCloud = `<path d="${cloudPath}" transform="translate(0 -2.5)"/>`;
// Strokes are divided by the scale factor so they match the 1.75 base stroke.
const smallCloud = (extra = ' stroke-width="2.33"') =>
    `<path d="${cloudPath}" transform="translate(6 5.5) scale(0.75)"${extra}/>`;

// UI icons
export const folderIcon = svg(
    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.88a2 2 0 0 1 1.41.59L12.2 7h6.3A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z" fill="currentColor" fill-opacity="0.18"/>',
);
export const plusIcon = svg('<path d="M12 5v14M5 12h14"/>');
export const closeIcon = svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>');
export const editIcon = svg(
    '<path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z"/><path d="M13.5 8.5l2 2"/>',
);
export const chevronIcon = svg('<path d="M9 6l6 6-6 6"/>');

// Weather icons
export const sunIcon = svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2.5 12h2M19.5 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
);
export const moonIcon = svg(`<path d="${moonPath}"/>`);
export const cloudIcon = svg(`<path d="${cloudPath}"/>`);

// The mask cuts the sun/moon away wherever the cloud sits in front of it.
const behindCloud = (id, body) =>
    `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${smallCloud(' fill="#000" stroke="#000" stroke-width="4"')}</mask></defs><g mask="url(#${id})">${body}</g>${smallCloud()}`;

export const partlyCloudyDayIcon = svg(
    behindCloud(
        "wx-mask-day",
        '<circle cx="9" cy="8.5" r="3.2"/><path d="M9 3.5V2M9 13.5V15M4 8.5H2.5M14 8.5h1.5M5.46 4.96L4.4 3.9M12.54 4.96l1.06-1.06M5.46 12.04L4.4 13.1M12.54 12.04l1.06 1.06"/>',
    ),
);
export const partlyCloudyNightIcon = svg(
    behindCloud(
        "wx-mask-night",
        `<path d="${moonPath}" transform="translate(0.5 0) scale(0.62)" stroke-width="2.82"/>`,
    ),
);
export const fogIcon = svg(`${raisedCloud}<path d="M5 19h14M8 22h8"/>`);
export const drizzleIcon = svg(
    `${raisedCloud}<path d="M8 18.5v.01M12 18.5v.01M16 18.5v.01M10 21.5v.01M14 21.5v.01" stroke-width="2.25"/>`,
);
export const rainIcon = svg(
    `${raisedCloud}<path d="M8 17.5l-1 3.5M12.5 17.5l-1 3.5M17 17.5l-1 3.5"/>`,
);
export const snowIcon = svg(
    `${raisedCloud}<path d="M8 18.5v.01M12 19.5v.01M16 18.5v.01M10 22v.01M14 22v.01" stroke-width="2.75"/>`,
);
export const thunderIcon = svg(
    `${raisedCloud}<path d="M12.5 15.5l-2.5 3.5h3.5l-2.5 3.5"/>`,
);
