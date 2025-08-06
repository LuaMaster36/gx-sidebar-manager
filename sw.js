console.log("Service Worker starting...");

let keepAlive = () => {
  chrome.runtime.getPlatformInfo(() => {});
  setTimeout(keepAlive, 10000);
};
keepAlive();

const isStartPage = (url) => {
  return (
    url === 'about:blank' ||
    url.startsWith('chrome://newtab') ||
    url.startsWith('opera://startpage') ||
    url.startsWith('opera://startpageshared') ||
    url.startsWith('chrome-search://local-ntp') ||
    url.startsWith('chrome://startpage')
  );
};

function applyThemeToAllWindows(themeName) {
  const manifest = chrome.runtime.getManifest();
  const theme = manifest.theme_colors.find(t => t.name === themeName);
  
  if (theme) {
    chrome.windows.getAll({ populate: true }, (windows) => {
      windows.forEach((window) => {
        window.tabs.forEach((tab) => {
          if (tab.url.startsWith(chrome.runtime.getURL('')) || 
              tab.url.includes('options.html') || 
              tab.url.includes('panel.html')) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateTheme',
              colors: theme.colors
            });
          }
        });
      });
    });
  }
}

async function getSpeedDial() {
  return new Promise((resolve) => {
    chrome.storage.local.get('speedDial', (result) => {
      resolve(result.speedDial || false);
    });
  });
}

function initSidebar() {
  try {
    if (typeof chrome.sidebarAction === 'undefined') {
      console.warn("sidebarAction API not available");
      return;
    }

    console.log("Initializing sidebar...");
    
    chrome.sidebarAction.onClicked.addListener(() => {
      console.log("Sidebar clicked");
      chrome.storage.local.get({ buttons: [] }, ({ buttons = [] }) => {
        const btn = buttons[buttons.length - 1];
        if (btn?.mode === "tab") {
          chrome.tabs.create({ url: btn.url });
        }
      });
    });

    chrome.storage.local.get('buttons', ({ buttons = [] }) => {
      const lastBtn = buttons[buttons.length - 1];
      chrome.sidebarAction.setTitle({
        title: lastBtn?.title || "Sidebar Manager"
      });
      
      chrome.sidebarAction.setIcon({
        path: {
          "19": "icons/19.png",
          "38": "icons/38.png"
        }
      });
    });

    chrome.storage.onChanged.addListener(() => {
      chrome.storage.local.get('buttons', ({ buttons = [] }) => {
        const lastBtn = buttons[buttons.length - 1];
        chrome.sidebarAction.setTitle({
          title: lastBtn?.title || "Sidebar Manager"
        });
      });
    });

  } catch (e) {
    console.error("Sidebar init error:", e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  
  chrome.storage.local.get('theme', (result) => {
    if (!result.theme) {
      const manifest = chrome.runtime.getManifest();
      const defaultTheme = manifest.theme_colors?.[0]?.name || 'GX Purple';
      chrome.storage.local.set({ theme: defaultTheme });
    }
  });
  
  chrome.storage.local.get('speedDial', (result) => {
    if (result.speedDial === undefined) {
      chrome.storage.local.set({ speedDial: false });
    }
  });

  setTimeout(() => {
    initSidebar();
  }, 500);
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Browser started");
  initSidebar();
  initSpeedDial();
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchFavicon') {
    fetchFavicon(request.url).then(icon => {
      sendResponse({ icon });
    }).catch(error => {
      console.warn('Favicon fetch warning:', error);
      const defaultIcon = chrome.runtime.getURL("icons/default.png");
      sendResponse({ icon: defaultIcon });
    });
    return true;
  }
  
  if (request.action === 'getCurrentTheme') {
    chrome.storage.local.get('theme', (result) => {
      const manifest = chrome.runtime.getManifest();
      const theme = manifest.theme_colors.find(t => t.name === result.theme);
      sendResponse({ theme: theme || manifest.theme_colors[0] });
    });
    return true;
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) {
    applyThemeToAllWindows(changes.theme.newValue);
  }
});

function handleQuickAccess(slot) {
  chrome.storage.local.get(['buttons', 'quickAccess'], (result) => {
    const quickAccess = result.quickAccess || {};
    const buttonId = quickAccess[slot];
    
    if (!buttonId) {
      console.log(`No button assigned to quick access slot ${slot}`);
      return;
    }
    
    const buttons = result.buttons || [];
    const button = buttons.find(b => b.id === buttonId);
    
    if (button) {
      switch (button.mode) {
        case 'tab':
          chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs[0]) {
              const speedDial = await getSpeedDial();
              if (isStartPage(tabs[0].url) && speedDial) {
                chrome.tabs.update(tabs[0].id, { url: button.url });
              } else {
                chrome.tabs.create({ url: button.url });
              }
            } else {
              chrome.tabs.create({ url: button.url });
            }
          });
          break;
        case 'current':
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.update(tabs[0].id, { url: button.url });
          });
          break;
        case 'popup':
          chrome.windows.create({
            url: button.url,
            type: 'popup',
            width: 800,
            height: 600
          });
          break;
      }
    } else {
      console.warn(`Button assigned to slot ${slot} not found`);
    }
  });
}

chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'open-sidebar':
      browser.sidebarAction.open();
      break;
    case 'quick-access-1':
      handleQuickAccess(1);
      break;
    case 'quick-access-2':
      handleQuickAccess(2);
      break;
  }
});

async function fetchFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    
    const operaFavicon = `https://t0.gstatic.com/faviconV2?client=OPERA&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=64`;
    const duckduckgoFavicon = `https://external-content.duckduckgo.com/ip3/${domain}.ico`;
    
    return await fetchWithFallback(operaFavicon, duckduckgoFavicon);
  } catch (error) {
    console.warn('Favicon fetch warning:', error);
    const defaultIcon = chrome.runtime.getURL("icons/default.png");
    return defaultIcon;
  }
}

async function fetchWithFallback(primaryUrl, fallbackUrl) {
  try {
    const response = await fetch(primaryUrl);
    if (response.ok) {
      const blob = await response.blob();
      return await blobToDataURL(blob);
    }
    throw new Error('Primary favicon failed');
  } catch (primaryError) {
    console.log('Trying fallback favicon source');
    try {
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const blob = await fallbackResponse.blob();
        return await blobToDataURL(blob);
      }
      throw new Error('Fallback favicon failed');
    } catch (fallbackError) {
      throw new Error('All favicon sources failed');
    }
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}