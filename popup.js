// Popup script para controlar la selección de temas de Spotify

// Función para aplicar tema del sistema al popup
function applySystemThemeToPopup() {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// Aplicar tema del sistema al cargar
applySystemThemeToPopup();

// Escuchar cambios en el tema del sistema
if (window.matchMedia) {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', (e) => {
    applySystemThemeToPopup();
  });
}

const useSystemThemeSwitch = document.getElementById('useSystemThemeSwitch');
const themeSelector = document.getElementById('themeSelector');
const themeOptions = document.querySelectorAll('.theme-option');
const statusDiv = document.getElementById('status');

// Cargar textos traducidos
document.getElementById('popupTitle').textContent = chrome.i18n.getMessage('popupTitle');
document.getElementById('useSystemThemeLabel').textContent = chrome.i18n.getMessage('useSystemThemeLabel');
document.getElementById('themeLightLabel').textContent = chrome.i18n.getMessage('themeLightLabel');
document.getElementById('themeDarkLabel').textContent = chrome.i18n.getMessage('themeDarkLabel');
document.getElementById('themeSepiaLabel').textContent = chrome.i18n.getMessage('themeSepiaLabel');
document.getElementById('themeHighContrastLabel').textContent = chrome.i18n.getMessage('themeHighContrastLabel');
document.getElementById('themeVintageLabel').textContent = chrome.i18n.getMessage('themeVintageLabel');
statusDiv.textContent = chrome.i18n.getMessage('statusLoading');

// Cargar el estado actual al abrir el popup
chrome.storage.sync.get(['selectedTheme', 'useSystemTheme'], (result) => {
  if (chrome.runtime.lastError) {
    console.error('Error loading state:', chrome.runtime.lastError);
    updateStatus('light', true);
    return;
  }

  const useSystemTheme = result.useSystemTheme === true; // Por defecto desactivado
  const theme = result.selectedTheme || 'light'; // Por defecto light

  useSystemThemeSwitch.checked = useSystemTheme;

  // Marcar el tema activo
  themeOptions.forEach(option => {
    const optionTheme = option.getAttribute('data-theme');
    if (optionTheme === theme) {
      option.classList.add('active');
    }
    // Deshabilitar selector si usamos tema del sistema
    if (useSystemTheme) {
      option.classList.add('disabled');
    }
  });

  updateStatus(theme);
});

// Escuchar cambios en el toggle de sistema
useSystemThemeSwitch.addEventListener('change', async () => {
  const useSystemTheme = useSystemThemeSwitch.checked;

  try {
    // Guardar el estado
    await chrome.storage.sync.set({ useSystemTheme });

    // Habilitar/deshabilitar selector de temas
    themeOptions.forEach(option => {
      if (useSystemTheme) {
        option.classList.add('disabled');
      } else {
        option.classList.remove('disabled');
      }
    });

    // Enviar mensaje a todas las pestañas de Spotify
    const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });

    if (tabs.length === 0) {
      return;
    }

    // Enviar mensajes con manejo de errores individual por pestaña
    const messagePromises = tabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateSystemThemePreference',
        useSystemTheme
      }).catch(error => {
        console.warn(`Error sending message to tab ${tab.id}:`, error);
        return null;
      })
    );

    await Promise.all(messagePromises);

  } catch (error) {
    console.error('Error updating system theme preference:', error);
    // Revertir el toggle si hay error
    useSystemThemeSwitch.checked = !useSystemTheme;
    themeOptions.forEach(option => {
      if (!useSystemTheme) {
        option.classList.add('disabled');
      } else {
        option.classList.remove('disabled');
      }
    });
  }
});

// Escuchar clicks en las opciones de tema
themeOptions.forEach(option => {
  option.addEventListener('click', async () => {
    // Ignorar si está deshabilitado (usando tema del sistema)
    if (option.classList.contains('disabled')) return;

    const selectedTheme = option.getAttribute('data-theme');

    try {
      // Guardar el tema seleccionado
      await chrome.storage.sync.set({ selectedTheme });

      // Actualizar UI
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');

      // Enviar mensaje a todas las pestañas de Spotify
      const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });

      if (tabs.length === 0) {
        updateStatus(selectedTheme, false, chrome.i18n.getMessage('statusNoTabs'));
        return;
      }

      // Enviar mensajes con manejo de errores individual por pestaña
      const messagePromises = tabs.map(tab =>
        chrome.tabs.sendMessage(tab.id, {
          action: 'changeTheme',
          theme: selectedTheme
        }).catch(error => {
          console.warn(`Error sending message to tab ${tab.id}:`, error);
          return null;
        })
      );

      await Promise.all(messagePromises);
      updateStatus(selectedTheme);

    } catch (error) {
      console.error('Error changing theme:', error);
      updateStatus(selectedTheme, true);
    }
  });
});

function updateStatus(theme, hasError = false, customMessage = null) {
  if (hasError) {
    statusDiv.textContent = chrome.i18n.getMessage('statusError');
    statusDiv.style.color = '#e22134';
  } else if (customMessage) {
    statusDiv.textContent = customMessage;
    statusDiv.style.color = '#888';
  } else {
    const themeMessages = {
      light: chrome.i18n.getMessage('statusThemeLight'),
      dark: chrome.i18n.getMessage('statusThemeDark'),
      sepia: chrome.i18n.getMessage('statusThemeSepia'),
      highContrast: chrome.i18n.getMessage('statusThemeHighContrast'),
      vintage: chrome.i18n.getMessage('statusThemeVintage')
    };
    statusDiv.textContent = themeMessages[theme] || theme;
    statusDiv.style.color = '#1db954';
  }
}
