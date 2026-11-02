// Popup: lee/escribe la configuración en chrome.storage.sync.
// Las pestañas de Spotify reaccionan solas vía storage.onChanged.

const { SETTINGS_KEYS, withDefaults, resolveTheme, manualThemeChange } = ThemeCore;
const t = (key) => chrome.i18n.getMessage(key) || key;
const $ = (id) => document.getElementById(id);

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const themeOptions = document.querySelectorAll(".theme-option");
const statusDiv = $("status");
let settings = withDefaults({});

// --- Textos traducidos ---
for (const id of [
	"popupTitle",
	"useSystemThemeLabel",
	"themeLightLabel",
	"themeDarkLabel",
	"themeSepiaLabel",
	"themeHighContrastLabel",
	"themeVintageLabel",
	"scheduleLabel",
	"scheduleLightStartLabel",
	"scheduleDarkStartLabel",
	"brightnessLabel",
	"keepPlayerDarkLabel",
]) {
	$(id).textContent = t(id);
}
$("keepPlayerDarkSwitch").closest(".toggle-container").title = t("keepPlayerDarkHint");
statusDiv.textContent = t("statusLoading");

// --- Render ---
function render() {
	document.body.classList.toggle("dark-mode", darkQuery.matches);

	const auto = settings.useSystemTheme || settings.scheduleEnabled;
	$("useSystemThemeSwitch").checked = settings.useSystemTheme;
	$("scheduleSwitch").checked = settings.scheduleEnabled;
	$("scheduleTimes").classList.toggle("visible", settings.scheduleEnabled);
	$("scheduleLightStart").value = settings.scheduleLightStart;
	$("scheduleDarkStart").value = settings.scheduleDarkStart;
	$("brightness").value = settings.brightness;
	$("brightnessValue").textContent = `${settings.brightness}%`;
	$("keepPlayerDarkSwitch").checked = settings.keepPlayerDark;

	themeOptions.forEach((option) => {
		const theme = option.dataset.theme;
		option.classList.toggle("active", !auto && theme === settings.selectedTheme);
		option.classList.toggle("disabled", auto);
	});

	const effective = resolveTheme(settings, darkQuery.matches);
	const indicator = $("systemThemeIndicator");
	if (auto) {
		const icon = effective === "dark" ? "🌙" : "☀️";
		const prefix = settings.useSystemTheme ? t("statusSystemThemeActive") : t("statusScheduleActive");
		$("systemThemeText").textContent = `${icon} ${prefix}: ${themeName(effective)}`;
		indicator.classList.add("visible");
	} else {
		indicator.classList.remove("visible");
	}

	setStatus(auto ? t(settings.useSystemTheme ? "statusSystemTheme" : "statusSchedule") : statusFor(effective));
}

function themeName(theme) {
	return t(`theme${theme[0].toUpperCase()}${theme.slice(1)}Label`);
}

function statusFor(theme) {
	return t(`statusTheme${theme[0].toUpperCase()}${theme.slice(1)}`);
}

function setStatus(text, isError = false) {
	statusDiv.textContent = text;
	statusDiv.style.color = isError ? "#e22134" : "#1db954";
}

// Guarda cambios; el render llega por storage.onChanged
async function save(changes) {
	try {
		await chrome.storage.sync.set(changes);
	} catch (error) {
		console.error("Error saving settings:", error);
		setStatus(t("statusError"), true);
		render(); // revertir la UI al estado guardado
	}
}

// --- Eventos ---
$("useSystemThemeSwitch").addEventListener("change", (e) => {
	save({ useSystemTheme: e.target.checked, ...(e.target.checked && { scheduleEnabled: false }) });
});

$("scheduleSwitch").addEventListener("change", (e) => {
	save({ scheduleEnabled: e.target.checked, ...(e.target.checked && { useSystemTheme: false }) });
});

for (const id of ["scheduleLightStart", "scheduleDarkStart"]) {
	$(id).addEventListener("change", (e) => {
		if (e.target.value) save({ [id]: e.target.value });
	});
}

$("brightness").addEventListener("input", (e) => {
	$("brightnessValue").textContent = `${e.target.value}%`;
});
$("brightness").addEventListener("change", (e) => {
	save({ brightness: Number(e.target.value) });
});

$("keepPlayerDarkSwitch").addEventListener("change", (e) => {
	save({ keepPlayerDark: e.target.checked });
});

themeOptions.forEach((option) => {
	option.addEventListener("click", () => {
		if (option.classList.contains("disabled")) return;
		endPreview();
		save(manualThemeChange(option.dataset.theme));
	});
	option.addEventListener("mouseenter", () => {
		if (!option.classList.contains("disabled")) startPreview(option.dataset.theme);
	});
	option.addEventListener("mouseleave", endPreview);
});

// --- Vista previa al pasar el ratón ---
// Un puerto por pestaña activa de Spotify; al cerrarse el popup se desconecta
// y el content script restaura el tema guardado automáticamente.
let previewPorts = null;

async function getPreviewPorts() {
	if (!previewPorts) {
		previewPorts = chrome.tabs
			.query({ url: "https://open.spotify.com/*", active: true })
			.then((tabs) =>
				tabs.map((tab) => {
					const port = chrome.tabs.connect(tab.id, { name: "theme-preview" });
					port.onDisconnect.addListener(() => void chrome.runtime.lastError);
					return port;
				}),
			)
			.catch(() => []);
	}
	return previewPorts;
}

async function startPreview(theme) {
	for (const port of await getPreviewPorts()) {
		try {
			port.postMessage({ theme });
		} catch (_) {
			/* pestaña sin content script */
		}
	}
}

async function endPreview() {
	if (!previewPorts) return;
	for (const port of await previewPorts) {
		try {
			port.postMessage({ theme: null });
		} catch (_) {
			/* ignorar */
		}
	}
}

// --- Indicación de atajos ---
chrome.commands.getAll((commands) => {
	const keys = commands
		.filter((c) => c.shortcut && (c.name === "toggle-theme" || c.name === "cycle-theme"))
		.map((c) => `${c.shortcut} ${c.name === "toggle-theme" ? t("shortcutToggle") : t("shortcutCycle")}`);
	const hint = $("shortcutHint");
	if (keys.length) hint.textContent = keys.join(" · ");
	if (!navigator.userAgent.includes("Firefox")) {
		const link = document.createElement("a");
		link.textContent = t("shortcutConfigure");
		link.addEventListener("click", () => chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
		if (keys.length) hint.append(" · ");
		hint.append(link);
	}
});

// --- Carga inicial y sincronización ---
darkQuery.addEventListener("change", render);

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "sync" || !SETTINGS_KEYS.some((k) => k in changes)) return;
	const next = { ...settings };
	for (const k of SETTINGS_KEYS) if (k in changes) next[k] = changes[k].newValue;
	settings = withDefaults(next);
	render();
});

chrome.storage.sync.get(SETTINGS_KEYS, (result) => {
	if (chrome.runtime.lastError) {
		console.error("Error loading state:", chrome.runtime.lastError);
		setStatus(t("statusError"), true);
		return;
	}
	settings = withDefaults(result);
	render();
});
