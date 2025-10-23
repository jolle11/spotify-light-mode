// Service Worker para gestionar el estado y los iconos de la extensión

// Al instalar la extensión, establecer el estado por defecto
chrome.runtime.onInstalled.addListener(async (details) => {
  // Establecer estado por defecto
  chrome.storage.sync.set({ selectedTheme: 'light' });
  updateIcon('light');

  // Si es una instalación o actualización, inyectar el script en pestañas existentes
  if (details.reason === 'install' || details.reason === 'update') {
    await injectIntoExistingTabs();
  }
});

// Escuchar cambios en el storage para actualizar el icono
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.selectedTheme) {
    updateIcon(changes.selectedTheme.newValue);
  }
});

// Actualizar el icono según el tema
function updateIcon(theme) {
  // Usar icono normal para light y sepia, disabled para dark
  const isActive = theme !== 'dark';
  const path = isActive ? {
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
chrome.storage.sync.get(['selectedTheme'], (result) => {
  const theme = result.selectedTheme || 'light';
  updateIcon(theme);
});

// Función para inyectar el content script en pestañas existentes
async function injectIntoExistingTabs() {
  try {
    // Buscar todas las pestañas de Spotify
    const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });

    for (const tab of tabs) {
      try {
        // Inyectar el content script en la pestaña
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        console.log(`Content script injected into tab ${tab.id}`);
      } catch (error) {
        // Puede fallar si la pestaña no está completamente cargada o no tiene permisos
        console.warn(`Failed to inject into tab ${tab.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error injecting into existing tabs:', error);
  }
}
