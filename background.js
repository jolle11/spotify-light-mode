// Background (service worker en Chrome, script de fondo en Firefox):
// valores por defecto, iconos, atajos de teclado y menú contextual.

if (typeof ThemeCore === "undefined" && typeof importScripts === "function") {
	importScripts("shared.js");
}

const { THEMES, SETTINGS_KEYS, DEFAULTS, withDefaults, resolveTheme, manualThemeChange } =
	ThemeCore;

const SPOTIFY_URL = "https://open.spotify.com/*";
const MENU_PARENT = "spotify-theme";

async function getSettings() {
	return withDefaults(await chrome.storage.sync.get(SETTINGS_KEYS));
}

function iconPath(theme) {
	const suffix = theme === "dark" ? "-disabled" : "";
	return {
		16: `icons/icon16${suffix}.png`,
		48: `icons/icon48${suffix}.png`,
		128: `icons/icon128${suffix}.png`,
	};
}

// Icono global (si el tema depende del sistema no se conoce aquí: icono activo)
async function updateGlobalIcon() {
	const theme = resolveTheme(await getSettings(), null) || "light";
	chrome.action.setIcon({ path: iconPath(theme) }).catch(() => {});
}

// --- Menú contextual ---
function themeLabel(theme) {
	const key = `theme${theme[0].toUpperCase()}${theme.slice(1)}Label`;
	return chrome.i18n.getMessage(key) || theme;
}

async function createContextMenus() {
	await chrome.contextMenus.removeAll();
	const settings = await getSettings();
	const manual = !settings.useSystemTheme && !settings.scheduleEnabled;
	chrome.contextMenus.create({
		id: MENU_PARENT,
		title: chrome.i18n.getMessage("contextMenuTitle") || "Spotify theme",
		contexts: ["page", "frame", "selection", "link", "image"],
		documentUrlPatterns: [SPOTIFY_URL],
	});
	for (const theme of THEMES) {
		chrome.contextMenus.create({
			id: `theme:${theme}`,
			parentId: MENU_PARENT,
			type: "radio",
			title: themeLabel(theme),
			checked: manual && settings.selectedTheme === theme,
			contexts: ["all"],
			documentUrlPatterns: [SPOTIFY_URL],
		});
	}
}

async function updateContextMenuChecks() {
	const settings = await getSettings();
	const manual = !settings.useSystemTheme && !settings.scheduleEnabled;
	for (const theme of THEMES) {
		chrome.contextMenus
			.update(`theme:${theme}`, { checked: manual && settings.selectedTheme === theme })
			.catch(() => {});
	}
}

chrome.contextMenus.onClicked.addListener((info) => {
	const id = String(info.menuItemId);
	if (!id.startsWith("theme:")) return;
	chrome.storage.sync.set(manualThemeChange(id.slice("theme:".length)));
});

// --- Atajos de teclado ---
chrome.commands.onCommand.addListener(async (command) => {
	const settings = await getSettings();
	let next;
	if (command === "toggle-theme") {
		next = settings.selectedTheme === "dark" ? settings.lastLightTheme : "dark";
	} else if (command === "cycle-theme") {
		next = THEMES[(THEMES.indexOf(settings.selectedTheme) + 1) % THEMES.length];
	} else {
		return;
	}
	chrome.storage.sync.set(manualThemeChange(next));
});

// --- Instalación / arranque ---
chrome.runtime.onInstalled.addListener(async (details) => {
	// Solo rellenar valores que falten: no pisar preferencias al actualizar
	const stored = await chrome.storage.sync.get(SETTINGS_KEYS);
	const missing = {};
	for (const [k, v] of Object.entries(DEFAULTS)) if (!(k in stored)) missing[k] = v;
	if (Object.keys(missing).length) await chrome.storage.sync.set(missing);

	await createContextMenus();
	await updateGlobalIcon();

	if (details.reason === "install" || details.reason === "update") {
		await injectIntoExistingTabs();
	}
});

chrome.runtime.onStartup.addListener(() => {
	createContextMenus();
	updateGlobalIcon();
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "sync" || !SETTINGS_KEYS.some((k) => k in changes)) return;
	updateGlobalIcon();
	updateContextMenuChecks();
});

// El content script informa del tema real de su pestaña (incluye modo sistema/horario)
chrome.runtime.onMessage.addListener((message, sender) => {
	if (message?.action === "effectiveTheme" && sender.tab?.id !== undefined) {
		chrome.action
			.setIcon({ tabId: sender.tab.id, path: iconPath(message.theme) })
			.catch(() => {});
	}
	// Sin respuesta asíncrona: no devolver true
});

async function injectIntoExistingTabs() {
	const tabs = await chrome.tabs.query({ url: SPOTIFY_URL });
	for (const tab of tabs) {
		try {
			await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: ["shared.js", "content.js"],
			});
		} catch (error) {
			console.warn(`Failed to inject into tab ${tab.id}:`, error);
		}
	}
}
