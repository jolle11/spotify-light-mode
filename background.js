// Service Worker para gestionar el estado y los iconos de la extensión

// Al instalar la extensión, establecer el estado por defecto
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ lightModeEnabled: true });
  updateIcon(true);
});

// Escuchar cambios en el storage para actualizar el icono
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.lightModeEnabled) {
    updateIcon(changes.lightModeEnabled.newValue);
  }
});

// Actualizar el icono según el estado
function updateIcon(enabled) {
  const path = enabled ? {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  } : {
    "16": "icons/icon16-disabled.png",
    "48": "icons/icon48-disabled.png",
    "128": "icons/icon128-disabled.png"
  };

  chrome.action.setIcon({ path }).catch((error) => {
    console.error('Error updating icon:', error);
  });
}

// Inicializar el icono al cargar
chrome.storage.sync.get(['lightModeEnabled'], (result) => {
  const isEnabled = result.lightModeEnabled !== false;
  updateIcon(isEnabled);
});
