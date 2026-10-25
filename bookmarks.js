import { folderIcon, plusIcon, closeIcon, chevronIcon } from "./icons.js";

const DRAG_TYPE = "application/x-newtab-bookmark-id";
const RENDER_DEBOUNCE_MS = 60;
const MENU_MARGIN = 8;
const DROP_CLASSES = ["drop-before", "drop-after", "drop-into"];

const state = {
    rootId: null,
    path: [],
    nodes: new Map(),
    isEditing: false,
    draggedId: null,
    dropTarget: null,
    pendingRender: false,
};

const dom = {};
let renderTimer = null;
let renderSeq = 0;
let dialogEl = null;
let contextMenu = null;

// ---------- helpers ----------

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createButton(className, text) {
    const button = createElement("button", className, text);
    button.type = "button";
    return button;
}

function createIcon(svg) {
    const icon = createElement("span", "tile-icon");
    icon.innerHTML = svg;
    return icon;
}

function getFavicon(pageUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", "64");
    return url.toString();
}

function isFolder(node) {
    return !node.url;
}

function displayTitle(node) {
    return node.title || node.url || "Untitled folder";
}

function pluralize(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function fieldError(field, message) {
    return Object.assign(new Error(message), { field });
}

function requireName(value) {
    const name = value.trim();
    if (!name) throw fieldError("title", "Enter a name.");
    return name;
}

function normalizeUrl(value) {
    const raw = value.trim();
    if (!raw) throw fieldError("url", "Enter a URL.");
    // "localhost:3000" parses as a URL with scheme "localhost:", so only accept
    // "scheme://" or a few well-known scheme-only forms as already having a scheme.
    const hasScheme =
        /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ||
        /^(mailto|tel|javascript|data|about):/i.test(raw);
    try {
        return new URL(hasScheme ? raw : `https://${raw}`).href;
    } catch {
        throw fieldError("url", "Enter a valid URL, like example.com.");
    }
}

// chrome.bookmarks.move() reads `index` as a slot in the parent's children *before*
// the node is taken out (Chrome subtracts one itself when moving forward). So the gap
// index works as-is in both directions: moving the item at 0 to after the item at 2
// is index 3. The gaps directly before and after the item leave it where it is.
function getDropIndex(targetIndex, position) {
    return position === "before" ? targetIndex : targetIndex + 1;
}

function isNoopMove(fromIndex, dropIndex) {
    return dropIndex === fromIndex || dropIndex === fromIndex + 1;
}

// ---------- bookmark tree ----------

async function getNode(id) {
    try {
        const [node] = await chrome.bookmarks.get(id);
        return node ?? null;
    } catch {
        return null;
    }
}

// Returns [root, ..., node] or null if the node is gone or no longer under the root.
async function getAncestry(id) {
    const chain = [];
    let node = await getNode(id);
    while (node) {
        chain.unshift(node);
        if (node.id === state.rootId) return chain;
        node = node.parentId ? await getNode(node.parentId) : null;
    }
    return null;
}

// Rebuilds the path from the deepest folder that still exists under the root.
async function resolvePath(ids) {
    for (let i = ids.length - 1; i >= 0; i--) {
        const chain = await getAncestry(ids[i]);
        if (chain) return chain;
    }
    return [await getNode(state.rootId)];
}

async function canMoveInto(id, parentId) {
    const chain = await getAncestry(parentId);
    return (
        Boolean(chain) &&
        !chain.at(-1).unmodifiable &&
        !chain.some((node) => node.id === id)
    );
}

async function countDescendants(id) {
    const [folder] = await chrome.bookmarks.getSubTree(id);
    const count = (node) =>
        (node.children ?? []).reduce(
            (sum, child) => sum + 1 + count(child),
            0,
        );
    return count(folder);
}

async function moveBookmark(id, destination) {
    if (!(await canMoveInto(id, destination.parentId))) return;
    try {
        await chrome.bookmarks.move(id, destination);
    } catch (error) {
        console.error("Couldn't move bookmark", error);
    }
}

// ---------- rendering ----------

function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, RENDER_DEBOUNCE_MS);
}

async function render({ focusFirst = false } = {}) {
    // Re-rendering mid-drag would detach the drag source and swallow its dragend.
    if (state.draggedId) {
        state.pendingRender = true;
        return;
    }
    const seq = ++renderSeq;
    let path;
    let children;
    try {
        path = await resolvePath(state.path.map((node) => node.id));
        children = await chrome.bookmarks.getChildren(path.at(-1).id);
    } catch {
        scheduleRender();
        return;
    }
    if (seq !== renderSeq) return;

    state.path = path;
    state.nodes = new Map(children.map((node) => [node.id, node]));
    renderBreadcrumbs();
    renderTiles(children, path.at(-1), focusFirst);
}

function navigateTo(path) {
    const panel = dom.panel ?? dom.container;
    state.path = path;
    render({ focusFirst: panel.contains(document.activeElement) });
}

function renderBreadcrumbs() {
    const nav = dom.breadcrumbs;
    if (!nav) return;
    const focusedId = nav.contains(document.activeElement)
        ? document.activeElement.dataset.id
        : null;

    const items = state.path.flatMap((node, i) => {
        const isCurrent = i === state.path.length - 1;
        const crumb = createButton(
            isCurrent ? "crumb current" : "crumb",
            node.title || "Untitled folder",
        );
        crumb.dataset.id = node.id;
        if (isCurrent) crumb.setAttribute("aria-current", "page");
        if (i === 0) return [crumb];
        const separator = createElement("span", "crumb-sep");
        separator.setAttribute("aria-hidden", "true");
        separator.innerHTML = chevronIcon;
        return [separator, crumb];
    });
    nav.replaceChildren(...items);

    if (focusedId) {
        nav.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
    }
}

function renderTiles(children, folder, focusFirst) {
    const focus = focusFirst ? { index: 0 } : captureTileFocus();
    const content = children.map(createTile);
    if (!children.length) {
        content.unshift(
            createElement("p", "bookmarks-empty", "This folder is empty"),
        );
    }
    if (!folder.unmodifiable) content.push(createAddTile());
    dom.container.replaceChildren(...content);
    restoreTileFocus(focus);
}

function captureTileFocus() {
    const tile = document.activeElement?.closest?.(".tile");
    if (!tile || !dom.container.contains(tile)) return null;
    const tiles = [...dom.container.querySelectorAll(".tile")];
    return { id: tile.dataset.id, index: tiles.indexOf(tile) };
}

function restoreTileFocus(snapshot) {
    if (!snapshot) return;
    const tiles = [...dom.container.querySelectorAll(".tile")];
    const match = snapshot.id
        ? tiles.find((tile) => tile.dataset.id === snapshot.id)
        : null;
    const tile = match ?? tiles[Math.min(snapshot.index, tiles.length - 1)];
    tile?.querySelector(".tile-main")?.focus();
    // Focus fails on hidden tiles (e.g. the add tile outside edit mode).
    if (!dom.container.contains(document.activeElement)) {
        dom.breadcrumbs?.querySelector(".crumb.current")?.focus();
    }
}

function createTile(node) {
    const type = isFolder(node) ? "folder" : "link";
    const tile = createElement("div", `tile tile--${type}`);
    tile.dataset.id = node.id;
    tile.dataset.type = type;
    tile.draggable = !node.unmodifiable;
    tile.append(
        type === "folder" ? createFolderMain(node) : createLinkMain(node),
    );
    if (!node.unmodifiable) tile.append(createRemoveButton(node));
    return tile;
}

function createLinkMain(node) {
    const link = createElement("a", "tile-main");
    link.href = node.url;
    link.title = displayTitle(node);
    // Let the whole tile be the drag source rather than the link/image.
    link.draggable = false;

    const favicon = document.createElement("img");
    favicon.src = getFavicon(node.url);
    favicon.alt = "";
    favicon.draggable = false;
    const icon = createElement("span", "tile-icon");
    icon.append(favicon);

    link.append(icon, createElement("span", "tile-label", displayTitle(node)));
    return link;
}

function createFolderMain(node) {
    const button = createButton("tile-main");
    button.title = displayTitle(node);
    button.append(
        createIcon(folderIcon),
        createElement("span", "tile-label", displayTitle(node)),
    );
    return button;
}

function createRemoveButton(node) {
    const button = createButton("tile-remove");
    button.setAttribute("aria-label", `Remove ${displayTitle(node)}`);
    button.innerHTML = closeIcon;
    return button;
}

function createAddTile() {
    const tile = createElement("div", "tile tile--add");
    const button = createButton("tile-main");
    button.append(
        createIcon(plusIcon),
        createElement("span", "tile-label", "Add"),
    );
    tile.append(button);
    return tile;
}

// ---------- edit mode ----------

function setEditing(isEditing) {
    state.isEditing = isEditing;
    dom.panel?.classList.toggle("is-editing", isEditing);
    if (!isEditing) {
        // The remove buttons get hidden, so don't leave focus on one.
        const focusedRemove = document.activeElement?.closest?.(".tile-remove");
        focusedRemove?.parentElement.querySelector(".tile-main")?.focus();
    }
    if (!dom.editToggle) return;
    dom.editToggle.setAttribute("aria-pressed", String(isEditing));
    const label = dom.editToggle.querySelector(".edit-toggle-label");
    if (label) label.textContent = isEditing ? "Done" : "Edit";
}

// ---------- dialog ----------

function getDialog() {
    if (!dialogEl) {
        dialogEl = createElement("dialog", "bm-dialog");
        document.body.append(dialogEl);
    }
    return dialogEl;
}

function createField({ label, value = "", type = "text" }) {
    const field = createElement("label", "bm-field");
    const input = createElement("input", "bm-input");
    input.type = type;
    input.value = value;
    input.autocomplete = "off";
    input.addEventListener("input", () =>
        input.removeAttribute("aria-invalid"),
    );
    field.append(createElement("span", "bm-field-label", label), input);
    return { field, input };
}

// `onSubmit(values, tabIndex)` may throw (or reject) with a user-facing message,
// which keeps the dialog open and shows the error.
function openDialog({
    title,
    message,
    fields = [],
    tabs,
    submitLabel = "Save",
    danger = false,
    onSubmit,
}) {
    closeContextMenu();
    const dialog = getDialog();
    if (dialog.open) dialog.close();

    const form = createElement("form", "bm-dialog-form");
    form.method = "dialog";
    // We validate ourselves; native validation would reject "example.com" in type=url.
    form.noValidate = true;
    form.append(createElement("h2", "bm-dialog-title", title));

    const tabButtons = (tabs ?? []).map((tab, index) => {
        const button = createButton("bm-dialog-tab", tab.label);
        button.setAttribute("role", "tab");
        button.addEventListener("click", () => showTab(index));
        return button;
    });
    if (tabButtons.length) {
        const tabList = createElement("div", "bm-dialog-tabs");
        tabList.setAttribute("role", "tablist");
        tabList.append(...tabButtons);
        form.append(tabList);
    }

    if (message) form.append(createElement("p", "bm-dialog-message", message));

    const error = createElement("p", "bm-dialog-error");
    error.hidden = true;
    form.append(error);

    const fieldMap = new Map(
        fields.map((field) => [field.key, createField(field)]),
    );
    let activeTab = 0;

    const visibleKeys = () =>
        tabs?.[activeTab].fields ?? [...fieldMap.keys()];
    const focusFirstInput = () => {
        const input = fieldMap.get(visibleKeys()[0])?.input;
        input?.focus();
        input?.select();
    };
    const setError = (text, fieldKey) => {
        error.textContent = text;
        error.hidden = !text;
        for (const [key, { input }] of fieldMap) {
            if (key === fieldKey) input.setAttribute("aria-invalid", "true");
            else input.removeAttribute("aria-invalid");
        }
        fieldMap.get(fieldKey)?.input.focus();
    };
    function showTab(index) {
        activeTab = index;
        tabButtons.forEach((button, i) =>
            button.setAttribute("aria-selected", String(i === index)),
        );
        // Only the active tab's fields are in the DOM.
        for (const { field } of fieldMap.values()) field.remove();
        error.before(...visibleKeys().map((key) => fieldMap.get(key).field));
        setError("");
        focusFirstInput();
    }

    const actions = createElement("div", "bm-dialog-actions");
    // type="button" so Enter in an input submits via the primary button, not Cancel.
    const cancel = createButton("btn btn--ghost", "Cancel");
    cancel.value = "cancel";
    cancel.addEventListener("click", () => dialog.close());
    const submit = createElement(
        "button",
        `btn ${danger ? "btn--danger" : "btn--primary"}`,
        submitLabel,
    );
    submit.type = "submit";
    submit.value = "ok";
    actions.append(cancel, submit);
    form.append(actions);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        const values = Object.fromEntries(
            visibleKeys().map((key) => [key, fieldMap.get(key).input.value]),
        );
        submit.disabled = true;
        try {
            await onSubmit(values, activeTab);
            dialog.close();
        } catch (submitError) {
            setError(
                submitError.message || "Something went wrong.",
                submitError.field,
            );
        } finally {
            submit.disabled = false;
        }
    });

    dialog.replaceChildren(form);
    showTab(0);
    dialog.showModal();
    focusFirstInput();
}

function openAddDialog() {
    const folder = state.path.at(-1);
    if (!folder || folder.unmodifiable) return;
    openDialog({
        title: `Add to ${folder.title || "Untitled folder"}`,
        tabs: [
            { label: "Bookmark", fields: ["title", "url"] },
            { label: "Folder", fields: ["title"] },
        ],
        fields: [
            { key: "title", label: "Name" },
            { key: "url", label: "URL", type: "url" },
        ],
        submitLabel: "Add",
        onSubmit: ({ title, url }, tabIndex) => {
            const details = { parentId: folder.id, title: requireName(title) };
            if (tabIndex === 0) details.url = normalizeUrl(url);
            return chrome.bookmarks.create(details);
        },
    });
}

function openRenameDialog(node) {
    openDialog({
        title: isFolder(node) ? "Rename folder" : "Rename bookmark",
        fields: [{ key: "title", label: "Name", value: node.title }],
        onSubmit: ({ title }) =>
            chrome.bookmarks.update(node.id, { title: requireName(title) }),
    });
}

function openEditUrlDialog(node) {
    openDialog({
        title: "Edit URL",
        fields: [{ key: "url", label: "URL", type: "url", value: node.url }],
        onSubmit: ({ url }) =>
            chrome.bookmarks.update(node.id, { url: normalizeUrl(url) }),
    });
}

function describeRemoval(node, count) {
    const name = displayTitle(node);
    if (!isFolder(node)) {
        return `"${name}" will be deleted from your bookmarks.`;
    }
    if (!count) return `The empty folder "${name}" will be deleted.`;
    const items = pluralize(count, "item");
    return `"${name}" and the ${items} inside it will be deleted.`;
}

async function confirmRemove(node) {
    if (node.unmodifiable) return;
    const folder = isFolder(node);
    const count = folder ? await countDescendants(node.id).catch(() => 0) : 0;
    openDialog({
        title: folder ? "Delete folder?" : "Delete bookmark?",
        message: `${describeRemoval(node, count)} This can't be undone.`,
        submitLabel: "Delete",
        danger: true,
        onSubmit: () =>
            folder
                ? chrome.bookmarks.removeTree(node.id)
                : chrome.bookmarks.remove(node.id),
    });
}

// ---------- context menu ----------

function openContextMenu(node, x, y, returnFocus) {
    closeContextMenu();
    const menu = createElement("div", "context-menu");
    menu.setAttribute("role", "menu");

    const items = [
        { label: "Rename", action: () => openRenameDialog(node) },
        node.url && {
            label: "Edit URL",
            action: () => openEditUrlDialog(node),
        },
        { label: "Delete", action: () => confirmRemove(node), danger: true },
    ].filter(Boolean);

    for (const { label, action, danger } of items) {
        const item = createButton(
            danger
                ? "context-menu-item context-menu-item--danger"
                : "context-menu-item",
            label,
        );
        item.setAttribute("role", "menuitem");
        item.addEventListener("click", () => {
            // Restore focus first so the dialog hands it back to the tile on close.
            closeContextMenu({ restoreFocus: true });
            action();
        });
        menu.append(item);
    }

    menu.addEventListener("keydown", onMenuKeydown);
    menu.addEventListener("focusout", (event) => {
        if (!menu.contains(event.relatedTarget)) closeContextMenu();
    });

    document.body.append(menu);
    contextMenu = { element: menu, returnFocus };
    positionMenu(menu, x, y);
    menu.querySelector(".context-menu-item").focus({ preventScroll: true });
}

function positionMenu(menu, x, y) {
    const { width, height } = menu.getBoundingClientRect();
    const maxLeft = window.innerWidth - width - MENU_MARGIN;
    const maxTop = window.innerHeight - height - MENU_MARGIN;
    menu.style.left = `${Math.max(MENU_MARGIN, Math.min(x, maxLeft))}px`;
    menu.style.top = `${Math.max(MENU_MARGIN, Math.min(y, maxTop))}px`;
}

function closeContextMenu({ restoreFocus = false } = {}) {
    if (!contextMenu) return;
    const { element, returnFocus } = contextMenu;
    contextMenu = null;
    if (restoreFocus && returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
    }
    element.remove();
}

function onMenuKeydown(event) {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const items = [
        ...event.currentTarget.querySelectorAll(".context-menu-item"),
    ];
    const index = items.indexOf(document.activeElement);
    items[(index + step + items.length) % items.length].focus();
}

// ---------- drag and drop ----------

function getTileDropTarget(event) {
    const tile = event.target.closest(".tile[data-id]");
    const node = state.nodes.get(tile?.dataset.id);
    const dragged = state.nodes.get(state.draggedId);
    if (!node || !dragged || node.id === dragged.id) return null;

    const rect = tile.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    if (isFolder(node) && !node.unmodifiable && ratio > 0.25 && ratio < 0.75) {
        return {
            element: tile,
            className: "drop-into",
            destination: { parentId: node.id },
        };
    }

    // Before/after by the tile's own midpoint, so at a row wrap "after the last tile
    // of a row" and "before the first tile of the next row" are the same slot.
    const position = ratio < 0.5 ? "before" : "after";
    const index = getDropIndex(node.index, position);
    if (isNoopMove(dragged.index, index)) return null;
    return {
        element: tile,
        className: `drop-${position}`,
        destination: { parentId: node.parentId, index },
    };
}

function getCrumbDropTarget(event) {
    const crumb = event.target.closest(".crumb");
    if (!crumb || crumb.classList.contains("current")) return null;
    const folder = state.path.find((node) => node.id === crumb.dataset.id);
    if (!folder || folder.unmodifiable) return null;
    return {
        element: crumb,
        className: "drop-into",
        destination: { parentId: folder.id },
    };
}

function showDropTarget(target) {
    clearDropTarget();
    state.dropTarget = target;
    target?.element.classList.add(target.className);
}

function clearDropTarget() {
    state.dropTarget = null;
    const marked = document.querySelectorAll(
        DROP_CLASSES.map((name) => `.${name}`).join(", "),
    );
    for (const element of marked) element.classList.remove(...DROP_CLASSES);
}

function addDropZone(element, getTarget) {
    element.addEventListener("dragover", (event) => {
        if (!state.draggedId) return;
        const target = getTarget(event);
        showDropTarget(target);
        if (!target) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    });
    element.addEventListener("dragleave", (event) => {
        if (!element.contains(event.relatedTarget)) clearDropTarget();
    });
    element.addEventListener("drop", (event) => {
        const { draggedId, dropTarget } = state;
        clearDropTarget();
        if (!draggedId || !dropTarget) return;
        event.preventDefault();
        moveBookmark(draggedId, dropTarget.destination);
    });
}

function onDragStart(event) {
    const tile = event.target.closest?.(".tile[data-id]");
    const node = state.nodes.get(tile?.dataset.id);
    if (!node || node.unmodifiable) {
        event.preventDefault();
        return;
    }
    closeContextMenu();
    state.draggedId = node.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, node.id);
    // Delay the class so it doesn't affect the drag image snapshot.
    requestAnimationFrame(() => {
        if (state.draggedId === node.id) tile.classList.add("is-dragging");
    });
}

function onDragEnd() {
    for (const tile of dom.container.querySelectorAll(".is-dragging")) {
        tile.classList.remove("is-dragging");
    }
    clearDropTarget();
    state.draggedId = null;
    if (state.pendingRender) {
        state.pendingRender = false;
        render();
    }
}

// ---------- event handlers ----------

function getTileNode(target) {
    return state.nodes.get(target.closest(".tile")?.dataset.id);
}

function onContainerClick(event) {
    if (event.target.closest(".tile--add .tile-main")) {
        openAddDialog();
        return;
    }
    const node = getTileNode(event.target);
    if (!node) return;
    if (event.target.closest(".tile-remove")) {
        confirmRemove(node);
    } else if (event.target.closest(".tile-main")) {
        if (isFolder(node)) navigateTo([...state.path, node]);
        else if (state.isEditing) event.preventDefault();
    }
}

function onContainerAuxClick(event) {
    if (state.isEditing && event.target.closest(".tile--link .tile-main")) {
        event.preventDefault();
    }
}

function onContainerKeydown(event) {
    if (!state.isEditing) return;
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const node = getTileNode(event.target);
    if (!node || node.unmodifiable) return;
    event.preventDefault();
    confirmRemove(node);
}

function onContainerContextMenu(event) {
    const tile = event.target.closest(".tile");
    const node = getTileNode(event.target);
    if (!node || node.unmodifiable) return;
    event.preventDefault();
    let { clientX: x, clientY: y } = event;
    // Keyboard-invoked context menus may report no pointer position.
    if (x === 0 && y === 0) {
        const rect = tile.getBoundingClientRect();
        x = rect.left;
        y = rect.bottom;
    }
    openContextMenu(node, x, y, tile.querySelector(".tile-main"));
}

function onCrumbClick(event) {
    const crumb = event.target.closest(".crumb");
    if (!crumb || crumb.classList.contains("current")) return;
    const index = state.path.findIndex((node) => node.id === crumb.dataset.id);
    if (index >= 0) navigateTo(state.path.slice(0, index + 1));
}

function onDocumentKeydown(event) {
    if (event.key !== "Escape") return;
    if (contextMenu) {
        event.preventDefault();
        closeContextMenu({ restoreFocus: true });
        return;
    }
    if (dialogEl?.open || !state.isEditing) return;
    setEditing(false);
}

function onDocumentPointerDown(event) {
    if (contextMenu && !contextMenu.element.contains(event.target)) {
        closeContextMenu();
    }
}

function bindEvents() {
    const { container, breadcrumbs, editToggle } = dom;
    container.addEventListener("click", onContainerClick);
    container.addEventListener("auxclick", onContainerAuxClick);
    container.addEventListener("keydown", onContainerKeydown);
    container.addEventListener("contextmenu", onContainerContextMenu);
    container.addEventListener("dragstart", onDragStart);
    container.addEventListener("dragend", onDragEnd);
    addDropZone(container, getTileDropTarget);

    if (breadcrumbs) {
        breadcrumbs.addEventListener("click", onCrumbClick);
        addDropZone(breadcrumbs, getCrumbDropTarget);
    }
    editToggle?.addEventListener("click", () => setEditing(!state.isEditing));

    const dismissMenu = () => closeContextMenu();
    document.addEventListener("keydown", onDocumentKeydown);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.addEventListener("scroll", dismissMenu, {
        capture: true,
        passive: true,
    });
    window.addEventListener("resize", dismissMenu);
    window.addEventListener("blur", dismissMenu);

    const { bookmarks } = chrome;
    for (const event of [
        bookmarks.onCreated,
        bookmarks.onRemoved,
        bookmarks.onChanged,
        bookmarks.onMoved,
        bookmarks.onChildrenReordered,
    ]) {
        event.addListener(scheduleRender);
    }
}

export const addBookmarksToPage = async () => {
    const container = document.getElementById("bookmarks-container");
    if (!container || dom.container) return;
    dom.container = container;
    dom.panel = document.getElementById("bookmarks-panel");
    dom.breadcrumbs = document.getElementById("breadcrumbs");
    dom.editToggle = document.getElementById("edit-toggle");

    const [tree] = await chrome.bookmarks.getTree();
    const root =
        tree.children.find((node) => node.folderType === "bookmarks-bar") ??
        tree.children[0];
    state.rootId = root.id;
    state.path = [root];

    bindEvents();
    await render();
};
