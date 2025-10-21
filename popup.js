// Popup script para controlar el toggle de Spotify Light Mode

const toggleSwitch = document.getElementById('toggleSwitch');
const statusDiv = document.getElementById('status');

// Cargar el estado actual al abrir el popup
chrome.storage.sync.get(['lightModeEnabled'], (result) => {
  const isEnabled = result.lightModeEnabled !== false; // Por defecto activado
  toggleSwitch.checked = isEnabled;
  updateStatus(isEnabled);
});

// Escuchar cambios en el toggle
toggleSwitch.addEventListener('change', async () => {
  const isEnabled = toggleSwitch.checked;

  // Guardar el estado
  await chrome.storage.sync.set({ lightModeEnabled: isEnabled });

  // Enviar mensaje a todas las pestañas de Spotify
  const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleLightMode',
      enabled: isEnabled
    });
  });

  updateStatus(isEnabled);
});

function updateStatus(enabled) {
  statusDiv.textContent = enabled ? 'Activado ✓' : 'Desactivado';
  statusDiv.style.color = enabled ? '#1db954' : '#888';
}
