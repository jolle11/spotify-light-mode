// Content script para aplicar/remover dinámicamente el modo claro en Spotify

// Crear un elemento style para inyectar/remover el CSS dinámicamente
const styleId = 'spotify-light-mode-styles';
const correctionClass = 'spotify-lm-corrected';
let observer = null;

// Función para corregir elementos con background-image
function correctBackgroundImages() {
  const elements = document.querySelectorAll('[style*="background-image"]:not(.' + correctionClass + ')');
  elements.forEach(el => {
    el.classList.add(correctionClass);
    const currentFilter = el.style.filter || '';
    if (!currentFilter.includes('invert')) {
      el.style.filter = currentFilter + ' invert(1) hue-rotate(180deg)';
    }
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
  // Verificar si ya existe el style
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    body {
      filter: invert(1) hue-rotate(180deg);
      background-color: #fff !important;
    }
    img, video {
      filter: invert(1) hue-rotate(180deg);
    }
  `;
  document.head.appendChild(style);

  // Corregir elementos existentes
  correctBackgroundImages();

  // Observar cambios en el DOM para nuevos elementos
  observer = new MutationObserver(() => {
    correctBackgroundImages();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  });
}

// Función para remover el modo claro
function removeLightMode() {
  const style = document.getElementById(styleId);
  if (style) {
    style.remove();
  }

  // Desconectar el observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // Remover correcciones aplicadas
  removeBackgroundCorrections();
}

// Cargar el estado inicial al cargar la página
chrome.storage.sync.get(['lightModeEnabled'], (result) => {
  const isEnabled = result.lightModeEnabled !== false; // Por defecto activado
  if (isEnabled) {
    applyLightMode();
  } else {
    removeLightMode();
  }
});

// Escuchar mensajes del popup para activar/desactivar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleLightMode') {
    if (message.enabled) {
      applyLightMode();
    } else {
      removeLightMode();
    }
  }
});

console.log('Spotify Light Mode content script loaded.');

