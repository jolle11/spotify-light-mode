// Content script para aplicar/remover dinámicamente temas en Spotify

// Crear un elemento style para inyectar/remover el CSS dinámicamente
const styleId = 'spotify-theme-styles';
const transitionStyleId = 'spotify-theme-transitions';
const correctionClass = 'spotify-theme-corrected';
let observer = null;
let debounceTimer = null;
let systemThemeListener = null;
let useSystemTheme = false;
let currentTheme = 'light'; // 'light', 'dark', 'sepia'

// Definición de temas
const themes = {
  light: {
    bodyFilter: 'invert(1) hue-rotate(180deg)',
    mediaFilter: 'invert(1) hue-rotate(180deg)',
    backgroundColor: '#fff'
  },
  dark: {
    bodyFilter: 'none',
    mediaFilter: 'none',
    backgroundColor: 'transparent'
  },
  sepia: {
    bodyFilter: 'sepia(0.9) hue-rotate(15deg) saturate(0.8)',
    mediaFilter: 'sepia(0) hue-rotate(0deg) saturate(1)',
    backgroundColor: '#f4ecd8'
  },
  highContrast: {
    bodyFilter: 'invert(1) hue-rotate(180deg) contrast(1.5) saturate(1.3)',
    mediaFilter: 'invert(1) hue-rotate(180deg)',
    backgroundColor: '#fff'
  },
  vintage: {
    bodyFilter: 'sepia(0.7) hue-rotate(-10deg) saturate(0.9) contrast(0.95) brightness(1.05)',
    mediaFilter: 'sepia(0) hue-rotate(0deg) saturate(1)',
    backgroundColor: '#f5f0e8'
  }
};

// Función de debounce para limitar la frecuencia de ejecución
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Función para detectar si el sistema está en modo oscuro
function isSystemDarkMode() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Función para aplicar tema según preferencia del sistema
function applyThemeBasedOnSystem() {
  if (!useSystemTheme) return;

  const isDarkMode = isSystemDarkMode();
  // Si el sistema está en modo claro, aplicamos light mode a Spotify
  // Si el sistema está en modo oscuro, mantenemos Spotify oscuro
  if (isDarkMode) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }
}

// Función para iniciar/detener listener del tema del sistema
function setupSystemThemeListener() {
  // Remover listener anterior si existe
  if (systemThemeListener) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.removeEventListener('change', systemThemeListener);
    systemThemeListener = null;
  }

  // Si usamos tema del sistema, añadir listener
  if (useSystemTheme && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeListener = (e) => {
      // Si el sistema está en modo oscuro, mantener Spotify oscuro
      // Si el sistema está en modo claro, aplicar light mode a Spotify
      if (e.matches) {
        applyTheme('dark');
      } else {
        applyTheme('light');
      }
    };
    mediaQuery.addEventListener('change', systemThemeListener);
  }
}

// Inyectar estilos de transición permanentes
function injectTransitionStyles() {
  if (document.getElementById(transitionStyleId)) return;

  if (!document.head) return;

  const transitionStyle = document.createElement('style');
  transitionStyle.id = transitionStyleId;
  transitionStyle.textContent = `
    body {
      transition: filter 0.2s ease-in-out, background-color 0.2s ease-in-out !important;
    }
    img, video {
      transition: filter 0.2s ease-in-out !important;
    }
    .${correctionClass} {
      transition: filter 0.2s ease-in-out !important;
    }
  `;
  document.head.appendChild(transitionStyle);
}

// Función para corregir elementos con background-image según el tema
function correctBackgroundImages(theme) {
  const elements = document.querySelectorAll('[style*="background-image"]:not(.' + correctionClass + ')');

  // Optimización: usar requestAnimationFrame para evitar bloquear el renderizado
  if (elements.length === 0) return;

  const themeConfig = themes[theme];
  if (!themeConfig) return;

  requestAnimationFrame(() => {
    elements.forEach(el => {
      el.classList.add(correctionClass);
      const currentFilter = el.style.filter || '';

      // Aplicar el filtro correspondiente al tema
      if (theme === 'light' && !currentFilter.includes('invert')) {
        el.style.filter = (currentFilter + ' invert(1) hue-rotate(180deg)').trim();
      } else if (theme === 'highContrast' && !currentFilter.includes('invert')) {
        el.style.filter = (currentFilter + ' invert(1) hue-rotate(180deg)').trim();
      } else if (theme === 'sepia' && !currentFilter.includes('sepia')) {
        el.style.filter = (currentFilter + ' ' + themeConfig.mediaFilter).trim();
      } else if (theme === 'vintage' && !currentFilter.includes('sepia')) {
        el.style.filter = (currentFilter + ' ' + themeConfig.mediaFilter).trim();
      }
      // Para dark theme no aplicamos filtro adicional
    });
  });
}

// Función para remover correcciones de background-image
function removeBackgroundCorrections() {
  const elements = document.querySelectorAll('.' + correctionClass);
  elements.forEach(el => {
    el.classList.remove(correctionClass);
    // Remover todos los filtros que hayamos aplicado
    el.style.filter = el.style.filter
      .replace(/invert\(1\)\s*hue-rotate\(180deg\)/g, '')
      .replace(/sepia\([^)]*\)\s*hue-rotate\([^)]*\)\s*saturate\([^)]*\)/g, '')
      .trim();
    if (!el.style.filter) {
      el.style.removeProperty('filter');
    }
  });
}

// Función para aplicar un tema
function applyTheme(theme) {
  try {
    currentTheme = theme;
    const themeConfig = themes[theme];

    if (!themeConfig) {
      console.warn('Spotify Theme: Unknown theme:', theme);
      return;
    }

    // Verificar que document.head existe
    if (!document.head) {
      console.warn('Spotify Theme: document.head not available yet');
      return;
    }

    // Inyectar estilos de transición permanentes primero
    injectTransitionStyles();

    // Obtener o crear el elemento de estilo
    let style = document.getElementById(styleId);
    const isNewStyle = !style;

    if (isNewStyle) {
      style = document.createElement('style');
      style.id = styleId;
    }

    // Aplicar los estilos del tema
    if (theme === 'dark') {
      // Para tema oscuro, remover filtros
      style.textContent = `
        body {
          filter: none !important;
          background-color: transparent !important;
        }
        img, video {
          filter: none !important;
        }
      `;

      // Si es tema oscuro, desconectar observer y limpiar correcciones
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      removeBackgroundCorrections();

      // Eliminar el estilo después de la transición
      if (!isNewStyle) {
        setTimeout(() => {
          const styleToRemove = document.getElementById(styleId);
          if (styleToRemove) {
            styleToRemove.remove();
          }
        }, 250);
      }

      return;
    }

    // Para temas que requieren filtros (light, sepia)
    style.textContent = `
      body {
        filter: ${themeConfig.bodyFilter} !important;
        background-color: ${themeConfig.backgroundColor} !important;
      }
      img, video {
        filter: ${themeConfig.mediaFilter} !important;
      }
    `;

    if (isNewStyle) {
      document.head.appendChild(style);
    }

    // Corregir elementos existentes con background-image
    correctBackgroundImages(theme);

    // Configurar observer si no existe
    if (!observer) {
      // Crear versión debounced de la función de corrección
      const debouncedCorrection = debounce(() => correctBackgroundImages(currentTheme), 150);

      observer = new MutationObserver((mutations) => {
        const hasRelevantChanges = mutations.some(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            return true;
          }
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target;
            return target.style.backgroundImage && !target.classList.contains(correctionClass);
          }
          return false;
        });

        if (hasRelevantChanges) {
          debouncedCorrection();
        }
      });

      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style']
        });
      }
    } else {
      // Si ya existe, solo actualizar las correcciones de background
      removeBackgroundCorrections();
      correctBackgroundImages(theme);
    }
  } catch (error) {
    console.error('Spotify Theme: Error applying theme:', error);
  }
}

// Cargar el estado inicial al cargar la página
chrome.storage.sync.get(['selectedTheme', 'useSystemTheme'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Spotify Theme: Error loading state:', chrome.runtime.lastError);
    // En caso de error, aplicar modo claro por defecto
    applyTheme('light');
    return;
  }

  useSystemTheme = result.useSystemTheme === true; // Por defecto desactivado
  const theme = result.selectedTheme || 'light'; // Por defecto light

  if (useSystemTheme) {
    // Seguir el tema del sistema
    setupSystemThemeListener();
    applyThemeBasedOnSystem();
  } else {
    // Usar tema seleccionado manualmente
    applyTheme(theme);
  }
});

// Escuchar mensajes del popup para cambiar tema
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message && message.action === 'changeTheme') {
      applyTheme(message.theme);
      sendResponse({ success: true });
    } else if (message && message.action === 'updateSystemThemePreference') {
      useSystemTheme = message.useSystemTheme;

      if (useSystemTheme) {
        // Activar listener del sistema y aplicar tema
        setupSystemThemeListener();
        applyThemeBasedOnSystem();
      } else {
        // Desactivar listener y mantener tema seleccionado manualmente
        setupSystemThemeListener(); // Esto removerá el listener
        // Leer el tema manual actual
        chrome.storage.sync.get(['selectedTheme'], (result) => {
          const theme = result.selectedTheme || 'light';
          applyTheme(theme);
        });
      }
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Spotify Theme: Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Indica que la respuesta será enviada de forma asíncrona
});

console.log('Spotify Theme content script loaded.');

