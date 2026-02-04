// Popup script para controlar la selección de temas de Spotify

// Función para aplicar tema del sistema al popup
function applySystemThemeToPopup() {
	const isDarkMode =
		window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches;
	if (isDarkMode) {
		document.body.classList.add("dark-mode");
	} else {
		document.body.classList.remove("dark-mode");
	}
}

// Aplicar tema del sistema al cargar
applySystemThemeToPopup();

// Escuchar cambios en el tema del sistema
if (window.matchMedia) {
	const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
	darkModeQuery.addEventListener("change", (e) => {
		applySystemThemeToPopup();
	});
}

const useSystemThemeSwitch = document.getElementById("useSystemThemeSwitch");
const themeSelector = document.getElementById("themeSelector");
const themeOptions = document.querySelectorAll(".theme-option");
const statusDiv = document.getElementById("status");
const systemThemeIndicator = document.getElementById("systemThemeIndicator");
const systemThemeText = document.getElementById("systemThemeText");

// Función para obtener el tema actual del sistema
function getSystemTheme() {
	return window.matchMedia &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

// Función para actualizar el indicador del tema del sistema
function updateSystemThemeIndicator(show) {
	if (show) {
		const currentSystemTheme = getSystemTheme();
		const themeIcon = currentSystemTheme === "dark" ? "🌙" : "☀️";
		const themeName =
			currentSystemTheme === "dark"
				? chrome.i18n.getMessage("themeDarkLabel")
				: chrome.i18n.getMessage("themeLightLabel");
		systemThemeText.textContent = `${themeIcon} ${chrome.i18n.getMessage("statusSystemThemeActive") || "Using"}: ${themeName}`;
		systemThemeIndicator.classList.add("visible");
	} else {
		systemThemeIndicator.classList.remove("visible");
	}
}

// Función para enviar mensaje a una pestaña con reintentos
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await chrome.tabs.sendMessage(tabId, message);
			return response;
		} catch (error) {
			if (attempt === maxRetries) {
				console.warn(
					`Failed to send message to tab ${tabId} after ${maxRetries} attempts:`,
					error,
				);
				return null;
			}
			// Esperar antes de reintentar (100ms, 200ms, 400ms...)
			await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
		}
	}
	return null;
}

// Cargar textos traducidos
document.getElementById("popupTitle").textContent =
	chrome.i18n.getMessage("popupTitle");
document.getElementById("useSystemThemeLabel").textContent =
	chrome.i18n.getMessage("useSystemThemeLabel");
document.getElementById("themeLightLabel").textContent =
	chrome.i18n.getMessage("themeLightLabel");
document.getElementById("themeDarkLabel").textContent =
	chrome.i18n.getMessage("themeDarkLabel");
document.getElementById("themeSepiaLabel").textContent =
	chrome.i18n.getMessage("themeSepiaLabel");
document.getElementById("themeHighContrastLabel").textContent =
	chrome.i18n.getMessage("themeHighContrastLabel");
document.getElementById("themeVintageLabel").textContent =
	chrome.i18n.getMessage("themeVintageLabel");
statusDiv.textContent = chrome.i18n.getMessage("statusLoading");

// Cargar el estado actual al abrir el popup
chrome.storage.sync.get(["selectedTheme", "useSystemTheme"], (result) => {
	if (chrome.runtime.lastError) {
		console.error("Error loading state:", chrome.runtime.lastError);
		updateStatus("light", true);
		return;
	}

	const useSystemTheme = result.useSystemTheme === true; // Por defecto desactivado
	const theme = result.selectedTheme || "light"; // Por defecto light

	useSystemThemeSwitch.checked = useSystemTheme;

	// Marcar el tema activo
	themeOptions.forEach((option) => {
		const optionTheme = option.getAttribute("data-theme");
		if (optionTheme === theme && !useSystemTheme) {
			option.classList.add("active");
		}
		// Deshabilitar selector si usamos tema del sistema
		if (useSystemTheme) {
			option.classList.add("disabled");
		}
	});

	// Actualizar indicador y status según si usamos tema del sistema o no
	updateSystemThemeIndicator(useSystemTheme);
	if (useSystemTheme) {
		updateStatus(null, false, chrome.i18n.getMessage("statusSystemTheme"));
	} else {
		updateStatus(theme);
	}
});

// Escuchar cambios en el toggle de sistema
useSystemThemeSwitch.addEventListener("change", async () => {
	const useSystemTheme = useSystemThemeSwitch.checked;

	try {
		// Guardar el estado
		await chrome.storage.sync.set({ useSystemTheme });

		// Si activamos tema del sistema, obtener tema actual para actualizar UI
		let selectedTheme = "light";
		if (!useSystemTheme) {
			const result = await chrome.storage.sync.get(["selectedTheme"]);
			selectedTheme = result.selectedTheme || "light";
		}

		// Habilitar/deshabilitar selector de temas y quitar active
		themeOptions.forEach((option) => {
			if (useSystemTheme) {
				option.classList.add("disabled");
				option.classList.remove("active");
			} else {
				option.classList.remove("disabled");
				// Volver a marcar el tema seleccionado como activo
				if (option.getAttribute("data-theme") === selectedTheme) {
					option.classList.add("active");
				}
			}
		});

		// Actualizar indicador y status
		updateSystemThemeIndicator(useSystemTheme);
		if (useSystemTheme) {
			updateStatus(
				null,
				false,
				chrome.i18n.getMessage("statusSystemTheme"),
			);
		} else {
			updateStatus(selectedTheme);
		}

		// Enviar mensaje a todas las pestañas de Spotify
		const tabs = await chrome.tabs.query({
			url: "https://open.spotify.com/*",
		});

		if (tabs.length === 0) {
			return;
		}

		// Enviar mensajes con reintentos automáticos
		const messagePromises = tabs.map((tab) =>
			sendMessageWithRetry(tab.id, {
				action: "updateSystemThemePreference",
				useSystemTheme,
			}),
		);

		await Promise.all(messagePromises);
	} catch (error) {
		console.error("Error updating system theme preference:", error);
		// Revertir el toggle si hay error
		useSystemThemeSwitch.checked = !useSystemTheme;
		themeOptions.forEach((option) => {
			if (!useSystemTheme) {
				option.classList.add("disabled");
			} else {
				option.classList.remove("disabled");
			}
		});
	}
});

// Escuchar clicks en las opciones de tema
themeOptions.forEach((option) => {
	option.addEventListener("click", async () => {
		// Ignorar si está deshabilitado (usando tema del sistema)
		if (option.classList.contains("disabled")) return;

		const selectedTheme = option.getAttribute("data-theme");

		try {
			// Guardar el tema seleccionado
			await chrome.storage.sync.set({ selectedTheme });

			// Actualizar UI
			themeOptions.forEach((opt) => opt.classList.remove("active"));
			option.classList.add("active");

			// Enviar mensaje a todas las pestañas de Spotify
			const tabs = await chrome.tabs.query({
				url: "https://open.spotify.com/*",
			});

			if (tabs.length === 0) {
				updateStatus(
					selectedTheme,
					false,
					chrome.i18n.getMessage("statusNoTabs"),
				);
				return;
			}

			// Enviar mensajes con reintentos automáticos
			const messagePromises = tabs.map((tab) =>
				sendMessageWithRetry(tab.id, {
					action: "changeTheme",
					theme: selectedTheme,
				}),
			);

			await Promise.all(messagePromises);
			updateStatus(selectedTheme);
		} catch (error) {
			console.error("Error changing theme:", error);
			updateStatus(selectedTheme, true);
		}
	});
});

function updateStatus(theme, hasError = false, customMessage = null) {
	if (hasError) {
		statusDiv.textContent = chrome.i18n.getMessage("statusError");
		statusDiv.style.color = "#e22134";
	} else if (customMessage) {
		statusDiv.textContent = customMessage;
		statusDiv.style.color = "#888";
	} else {
		const themeMessages = {
			light: chrome.i18n.getMessage("statusThemeLight"),
			dark: chrome.i18n.getMessage("statusThemeDark"),
			sepia: chrome.i18n.getMessage("statusThemeSepia"),
			highContrast: chrome.i18n.getMessage("statusThemeHighContrast"),
			vintage: chrome.i18n.getMessage("statusThemeVintage"),
		};
		statusDiv.textContent = themeMessages[theme] || theme;
		statusDiv.style.color = "#1db954";
	}
}
