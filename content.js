// Content script para aplicar/remover dinámicamente el modo claro en Spotify

// Crear un elemento style para inyectar/remover el CSS dinámicamente
const styleId = 'spotify-light-mode-styles';
const transitionStyleId = 'spotify-light-mode-transitions';
const correctionClass = 'spotify-lm-corrected';
let observer = null;
let debounceTimer = null;

// Función de debounce para limitar la frecuencia de ejecución
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
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

// Función para corregir elementos con background-image
function correctBackgroundImages() {
  const elements = document.querySelectorAll('[style*="background-image"]:not(.' + correctionClass + ')');

  // Optimización: usar requestAnimationFrame para evitar bloquear el renderizado
  if (elements.length === 0) return;

  requestAnimationFrame(() => {
    elements.forEach(el => {
      el.classList.add(correctionClass);
      const currentFilter = el.style.filter || '';
      if (!currentFilter.includes('invert')) {
        el.style.filter = (currentFilter + ' invert(1) hue-rotate(180deg)').trim();
      }
    });
  });
}

// Función para remover correcciones de background-image
function removeBackgroundCorrections() {
  const elements = document.querySelectorAll('.' + correctionClass);
  elements.forEach(el => {
    el.classList.remove(correctionClass);
    el.style.filter = el.style.filter
      .replace(/invert\(1\)\s*hue-rotate\(180deg\)/g, '')
      .trim();
    if (!el.style.filter) {
      el.style.removeProperty('filter');
    }
  });
}

// Función para aplicar el modo claro
function applyLightMode() {
  try {
    // Verificar si ya existe el style
    if (document.getElementById(styleId)) return;

    // Verificar que document.head existe
    if (!document.head) {
      console.warn('Spotify Light Mode: document.head not available yet');
      return;
    }

    // Inyectar estilos de transición permanentes primero
    injectTransitionStyles();

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      body {
        filter: invert(1) hue-rotate(180deg) !important;
        background-color: #fff !important;
      }
      img, video {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `;
    document.head.appendChild(style);

  // Corregir elementos existentes
  correctBackgroundImages();

  // Crear versión debounced de la función de corrección
  const debouncedCorrection = debounce(correctBackgroundImages, 150);

  // Observar cambios en el DOM para nuevos elementos
  // Optimización: solo observar cambios en atributos 'style' y nuevos nodos
  observer = new MutationObserver((mutations) => {
    // Verificar si hay cambios relevantes antes de ejecutar
    const hasRelevantChanges = mutations.some(mutation => {
      // Si se agregaron nodos nuevos
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        return true;
      }
      // Si cambió el atributo style en un elemento
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
    } else {
      console.warn('Spotify Light Mode: document.body not available for observation');
    }
  } catch (error) {
    console.error('Spotify Light Mode: Error applying light mode:', error);
  }
}

// Función para remover el modo claro
function removeLightMode() {
  try {
    // Inyectar estilos de transición si no existen
    injectTransitionStyles();

    const style = document.getElementById(styleId);
    if (style) {
      // En lugar de eliminar, cambiar los filtros a 'none' para permitir transición
      style.textContent = `
        body {
          filter: none !important;
          background-color: transparent !important;
        }
        img, video {
          filter: none !important;
        }
      `;

      // Después de la transición, eliminar el estilo completamente
      setTimeout(() => {
        const styleToRemove = document.getElementById(styleId);
        if (styleToRemove) {
          styleToRemove.remove();
        }
      }, 250); // Esperar un poco más que la duración de la transición (0.2s)
    }

    // Desconectar el observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Remover correcciones aplicadas con transición
    removeBackgroundCorrections();
  } catch (error) {
    console.error('Spotify Light Mode: Error removing light mode:', error);
  }
}

// Cargar el estado inicial al cargar la página
chrome.storage.sync.get(['lightModeEnabled'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Spotify Light Mode: Error loading state:', chrome.runtime.lastError);
    // En caso de error, aplicar modo claro por defecto
    applyLightMode();
    return;
  }

  const isEnabled = result.lightModeEnabled !== false; // Por defecto activado
  if (isEnabled) {
    applyLightMode();
  } else {
    removeLightMode();
  }
});

// Escuchar mensajes del popup para activar/desactivar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message && message.action === 'toggleLightMode') {
      if (message.enabled) {
        applyLightMode();
      } else {
        removeLightMode();
      }
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Spotify Light Mode: Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Indica que la respuesta será enviada de forma asíncrona
});

console.log('Spotify Light Mode content script loaded.');

