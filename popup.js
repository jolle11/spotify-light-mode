// Popup script para controlar el toggle de Spotify Light Mode

const toggleSwitch = document.getElementById('toggleSwitch');
const statusDiv = document.getElementById('status');

// Cargar textos traducidos
document.getElementById('popupTitle').textContent = chrome.i18n.getMessage('popupTitle');
document.getElementById('lightModeLabel').textContent = chrome.i18n.getMessage('lightModeLabel');
statusDiv.textContent = chrome.i18n.getMessage('statusLoading');

// Cargar el estado actual al abrir el popup
chrome.storage.sync.get(['lightModeEnabled'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Error loading state:', chrome.runtime.lastError);
    updateStatus(false, true);
    return;
  }

  const isEnabled = result.lightModeEnabled !== false; // Por defecto activado
  toggleSwitch.checked = isEnabled;
  updateStatus(isEnabled);
});

// Escuchar cambios en el toggle
toggleSwitch.addEventListener('change', async () => {
  const isEnabled = toggleSwitch.checked;

  try {
    // Guardar el estado
    await chrome.storage.sync.set({ lightModeEnabled: isEnabled });

    // Enviar mensaje a todas las pestañas de Spotify
    const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });

    if (tabs.length === 0) {
      updateStatus(isEnabled, false, chrome.i18n.getMessage('statusNoTabs'));
      return;
    }

    // Enviar mensajes con manejo de errores individual por pestaña
    const messagePromises = tabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleLightMode',
        enabled: isEnabled
      }).catch(error => {
        console.warn(`Error sending message to tab ${tab.id}:`, error);
        return null;
      })
    );

    await Promise.all(messagePromises);
    updateStatus(isEnabled);

  } catch (error) {
    console.error('Error toggling light mode:', error);
    updateStatus(isEnabled, true);
    // Revertir el toggle si hay error
    toggleSwitch.checked = !isEnabled;
  }
});

function updateStatus(enabled, hasError = false, customMessage = null) {
  if (hasError) {
    statusDiv.textContent = chrome.i18n.getMessage('statusError');
    statusDiv.style.color = '#e22134';
  } else if (customMessage) {
    statusDiv.textContent = customMessage;
    statusDiv.style.color = '#888';
  } else {
    statusDiv.textContent = enabled ? chrome.i18n.getMessage('statusEnabled') : chrome.i18n.getMessage('statusDisabled');
    statusDiv.style.color = enabled ? '#1db954' : '#888';
  }
}
