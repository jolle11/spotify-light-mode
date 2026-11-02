// Lógica compartida entre content script, popup y background.
// Se carga como script clásico: expone `globalThis.ThemeCore`.

(() => {
	const THEMES = ["light", "dark", "sepia", "highContrast", "vintage"];

	const DEFAULTS = {
		selectedTheme: "light",
		lastLightTheme: "light", // último tema no oscuro (para el atajo de alternar)
		useSystemTheme: false,
		scheduleEnabled: false,
		scheduleLightStart: "07:00",
		scheduleDarkStart: "20:00",
		brightness: 100, // %, 70–130
		keepPlayerDark: false,
	};

	const SETTINGS_KEYS = Object.keys(DEFAULTS);

	function withDefaults(stored) {
		const s = { ...DEFAULTS, ...(stored || {}) };
		if (!THEMES.includes(s.selectedTheme)) s.selectedTheme = DEFAULTS.selectedTheme;
		if (!THEMES.includes(s.lastLightTheme) || s.lastLightTheme === "dark") {
			s.lastLightTheme = DEFAULTS.lastLightTheme;
		}
		const b = Number(s.brightness);
		s.brightness = Number.isFinite(b) ? Math.min(130, Math.max(70, b)) : 100;
		return s;
	}

	function toMinutes(hhmm) {
		const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
		return m ? Number(m[1]) * 60 + Number(m[2]) : null;
	}

	// ¿Estamos en la franja "clara" del horario? Soporta franjas que cruzan medianoche.
	function isScheduleLightTime(settings, now = new Date()) {
		const start = toMinutes(settings.scheduleLightStart);
		const end = toMinutes(settings.scheduleDarkStart);
		if (start === null || end === null || start === end) return true;
		const cur = now.getHours() * 60 + now.getMinutes();
		return start < end ? cur >= start && cur < end : cur >= start || cur < end;
	}

	// Tema "claro" a usar en modos automáticos.
	function lightVariant(settings) {
		return settings.selectedTheme !== "dark"
			? settings.selectedTheme
			: settings.lastLightTheme;
	}

	// Tema efectivo. `systemDark` puede ser null si no se conoce (service worker).
	function resolveTheme(settings, systemDark, now = new Date()) {
		if (settings.useSystemTheme) {
			if (systemDark === null || systemDark === undefined) return null;
			return systemDark ? "dark" : lightVariant(settings);
		}
		if (settings.scheduleEnabled) {
			return isScheduleLightTime(settings, now) ? lightVariant(settings) : "dark";
		}
		return settings.selectedTheme;
	}

	// Cambios al elegir un tema manualmente (desactiva los modos automáticos).
	function manualThemeChange(theme) {
		const changes = { selectedTheme: theme, useSystemTheme: false, scheduleEnabled: false };
		if (theme !== "dark") changes.lastLightTheme = theme;
		return changes;
	}

	globalThis.ThemeCore = {
		THEMES,
		DEFAULTS,
		SETTINGS_KEYS,
		withDefaults,
		isScheduleLightTime,
		resolveTheme,
		manualThemeChange,
	};
})();
