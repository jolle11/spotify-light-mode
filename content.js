// Content script: aplica temas en open.spotify.com.
// Envuelto en una IIFE para poder reinyectarse (instalación/actualización) sin
// errores de "Identifier has already been declared".

(() => {
	// Si hay una instancia anterior (p. ej. huérfana tras actualizar), la desmontamos.
	if (window.__spotifyThemeInstance) {
		try {
			window.__spotifyThemeInstance.destroy();
		} catch (_) {
			/* contexto anterior invalidado: ignorar */
		}
	}

	const { SETTINGS_KEYS, withDefaults, resolveTheme } = globalThis.ThemeCore;

	const STYLE_ID = "spotify-theme-styles";
	const TRANSITION_STYLE_ID = "spotify-theme-transitions";
	const BG_ATTR = "data-spotify-theme-bg";
	const PLAYER_SELECTOR = '[data-testid="now-playing-bar"], footer';
	const INVERT = "invert(1) hue-rotate(180deg)";
	// Inverso de INVERT (los filtros se aplican en orden, hay que deshacerlos al revés)
	const UNINVERT = "hue-rotate(180deg) invert(1)";

	const THEME_FILTERS = {
		light: { page: INVERT, media: UNINVERT, bg: "#fff", inverted: true },
		highContrast: {
			page: `${INVERT} contrast(1.5) saturate(1.3)`,
			media: `saturate(0.77) contrast(0.67) ${UNINVERT}`,
			bg: "#fff",
			inverted: true,
		},
		sepia: {
			page: "sepia(0.9) hue-rotate(15deg) saturate(0.8)",
			media: "",
			bg: "#f4ecd8",
			inverted: false,
		},
		vintage: {
			page: "sepia(0.7) hue-rotate(-10deg) saturate(0.9) contrast(0.95) brightness(1.05)",
			media: "",
			bg: "#f5f0e8",
			inverted: false,
		},
		dark: { page: "", media: "", bg: "", inverted: false },
	};

	let settings = withDefaults({});
	let previewTheme = null;
	let appliedTheme = null;
	let observer = null;
	let scanTimer = null;
	let removeStyleTimer = null;
	let scheduleTimer = null;
	const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const effectiveTheme = () =>
		previewTheme || resolveTheme(settings, systemQuery.matches) || "light";

	function buildCss(theme) {
		const t = THEME_FILTERS[theme];
		const b = settings.brightness / 100;
		const brightness = b !== 1 ? ` brightness(${b})` : "";
		const unBrightness = b !== 1 ? `brightness(${(1 / b).toFixed(4)}) ` : "";
		const page = `${t.page}${brightness}`.trim();
		if (!page) return "";
		const media = `${unBrightness}${t.media}`.trim() || "none";

		let css = `
      html {
        filter: ${page} !important;
        ${t.bg ? `background-color: ${t.bg} !important;` : ""}
      }
      img, video, [${BG_ATTR}] {
        filter: ${media} !important;
      }
    `;
		// Mantener la barra del reproductor oscura (solo posible en temas invertidos)
		if (settings.keepPlayerDark && t.inverted) {
			css += `
      :is(${PLAYER_SELECTOR}) {
        filter: ${unBrightness}${t.media} !important;
      }
      :is(${PLAYER_SELECTOR}) :is(img, video, [${BG_ATTR}]) {
        filter: none !important;
      }
    `;
		}
		return css;
	}

	function injectTransitionStyles() {
		if (document.getElementById(TRANSITION_STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = TRANSITION_STYLE_ID;
		style.textContent = `
      html, img, video, [${BG_ATTR}] {
        transition: filter 0.2s ease-in-out, background-color 0.2s ease-in-out !important;
      }
    `;
		document.head.appendChild(style);
	}

	// Marca/desmarca elementos con background-image inline; el filtro lo pone el CSS.
	function scanBackgroundImages() {
		document.querySelectorAll(`[style*="background-image"]:not([${BG_ATTR}])`).forEach((el) => {
			if (el.style.backgroundImage && el.style.backgroundImage !== "none") {
				el.setAttribute(BG_ATTR, "");
			}
		});
		document.querySelectorAll(`[${BG_ATTR}]`).forEach((el) => {
			if (!el.style.backgroundImage || el.style.backgroundImage === "none") {
				el.removeAttribute(BG_ATTR);
			}
		});
	}

	function scheduleScan() {
		clearTimeout(scanTimer);
		scanTimer = setTimeout(scanBackgroundImages, 250);
	}

	function startObserver() {
		if (observer) return;
		if (!document.body) {
			// En document_start aún no hay body: esperar al DOM
			document.addEventListener("DOMContentLoaded", startObserver, { once: true });
			return;
		}
		scanBackgroundImages();
		observer = new MutationObserver(scheduleScan);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style"],
		});
	}

	function stopObserver() {
		observer?.disconnect();
		observer = null;
		clearTimeout(scanTimer);
		document.querySelectorAll(`[${BG_ATTR}]`).forEach((el) => el.removeAttribute(BG_ATTR));
	}

	function apply() {
		if (!document.head) {
			setTimeout(apply, 20);
			return;
		}
		const theme = effectiveTheme();
		const css = buildCss(theme);
		clearTimeout(removeStyleTimer);
		injectTransitionStyles();

		let style = document.getElementById(STYLE_ID);
		if (!css) {
			// Tema oscuro nativo: quitar filtros con transición y luego el <style>
			stopObserver();
			if (style) {
				style.textContent = "html { filter: none !important; }";
				removeStyleTimer = setTimeout(() => style.remove(), 250);
			}
		} else {
			if (!style) {
				style = document.createElement("style");
				style.id = STYLE_ID;
				document.head.appendChild(style);
			}
			style.textContent = css;
			startObserver();
		}

		if (theme !== appliedTheme && !previewTheme) {
			appliedTheme = theme;
			// Informar al background para el icono de esta pestaña
			chrome.runtime.sendMessage({ action: "effectiveTheme", theme }).catch(() => {});
		}
	}

	// Reevaluar el horario al cambiar de minuto
	function updateScheduleTimer() {
		clearTimeout(scheduleTimer);
		if (!settings.scheduleEnabled || settings.useSystemTheme) return;
		const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
		scheduleTimer = setTimeout(() => {
			apply();
			updateScheduleTimer();
		}, msToNextMinute);
	}

	const onSystemChange = () => {
		if (settings.useSystemTheme) apply();
	};

	const onStorageChanged = (changes, area) => {
		if (area !== "sync" || !SETTINGS_KEYS.some((k) => k in changes)) return;
		const next = { ...settings };
		for (const k of SETTINGS_KEYS) if (k in changes) next[k] = changes[k].newValue;
		settings = withDefaults(next);
		updateScheduleTimer();
		apply();
	};

	// Vista previa desde el popup: dura mientras el puerto esté conectado
	const onConnect = (port) => {
		if (port.name !== "theme-preview") return;
		port.onMessage.addListener((msg) => {
			previewTheme = msg && msg.theme ? msg.theme : null;
			apply();
		});
		port.onDisconnect.addListener(() => {
			previewTheme = null;
			apply();
		});
	};

	function destroy() {
		systemQuery.removeEventListener("change", onSystemChange);
		chrome.storage.onChanged.removeListener(onStorageChanged);
		chrome.runtime.onConnect.removeListener(onConnect);
		clearTimeout(scheduleTimer);
		clearTimeout(removeStyleTimer);
		observer?.disconnect();
		observer = null;
	}

	systemQuery.addEventListener("change", onSystemChange);
	chrome.storage.onChanged.addListener(onStorageChanged);
	chrome.runtime.onConnect.addListener(onConnect);
	window.__spotifyThemeInstance = { destroy };

	chrome.storage.sync.get(SETTINGS_KEYS, (result) => {
		if (chrome.runtime.lastError) {
			console.error("Spotify Theme: Error loading state:", chrome.runtime.lastError);
		}
		settings = withDefaults(result);
		updateScheduleTimer();
		apply();
	});
})();
