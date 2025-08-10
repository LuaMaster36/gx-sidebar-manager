const form = document.getElementById('addButton');
const buttonList = document.getElementById('buttonList');
const categorySelect = document.getElementById('category');
const addCategoryBtn = document.getElementById('addCategory');
const manageCategoriesBtn = document.getElementById('manageCategories');
const dropZone = document.getElementById('dropZone');
const iconPreview = document.getElementById('iconPreview');
const iconDropZone = document.getElementById('iconDropZone');
const iconInput = document.getElementById('icon');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const closeError = document.getElementById('closeError');
const buttonSearch = document.getElementById('buttonSearch');
const buttonSearchMode = document.getElementById('buttonSearchMode');
const editModal = document.getElementById('editModal');
const editTitle = document.getElementById('editTitle');
const editUrl = document.getElementById('editUrl');
const editIcon = document.getElementById('editIcon');
const editIconPreview = document.getElementById('editIconPreview');
const editIconDropZone = document.getElementById('editIconDropZone');
const saveEdit = document.getElementById('saveEdit');
const cancelEdit = document.getElementById('cancelEdit');
const MAX_SHORTCUTS = 3;
const colorInputs = [
  'customBg', 'customCard', 'customAccent', 'customText', 
  'customBorder', 'customHover', 'customSecondary', 'customSuccess', 'customError'
];
let isRecordingShortcut = false;
let currentRecordingElement = null;
let currentShortcutKeys = [];
let currentShortcutToAssign = null;
const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];
const numberKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", 
                   "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", 
                   "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
                   "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5",
                   "Numpad6", "Numpad7", "Numpad8", "Numpad9", "Numpad0"];
let allButtons = [];
let currentCommandShortcuts = {};
let draggedIndex = null;
let customThemes = [];
let isEditingTheme = false;
let currentEditingThemeName = '';
let currentlyEditingIndex = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
async function loadThemeOptions() {
  chrome.storage.local.get(['theme', 'speedDial'], (result) => {
    const themeSelect = document.getElementById('theme');
    const speedDialToggle = document.getElementById('speedDialToggle');
    
    const manifest = chrome.runtime.getManifest();
    const themes = manifest.theme_colors || [];
    
    themeSelect.innerHTML = '';
    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.name;
      option.textContent = theme.name;
      themeSelect.appendChild(option);
    });
    
    if (result.theme) {
      themeSelect.value = result.theme;
    }
    
    if (result.speedDial) {
      speedDialToggle.checked = result.speedDial;
    }

    themeSelect.addEventListener('change', async (e) => {
      const themeName = e.target.value;
      const success = await validateAndApplyTheme(themeName);
      
      if (!success) {
        showError('Selected theme not found');
        // Revert to default theme
        const manifest = chrome.runtime.getManifest();
        if (manifest.theme_colors.length > 0) {
          document.getElementById('theme').value = manifest.theme_colors[0].name;
          await chrome.storage.local.set({ theme: manifest.theme_colors[0].name });
          applyTheme(manifest.theme_colors[0].colors);
        }
      }
    });

    speedDialToggle.addEventListener('change', (e) => {
      chrome.storage.local.set({ speedDial: e.target.checked });
    });
  });

  await updateThemeDropdown();
}

function applyTheme(colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--gx-${key}`, value);
  });
}

function findBookmarkByUrl(tree, url) {
  for (const node of tree) {
    if (node.url && node.url === url) {
      return node;
    }
    if (node.children) {
      const found = findBookmarkByUrl(node.children, url);
      if (found) return found;
    }
  }
  return null;
}

async function loadButtons() {
  const [storage, shortcuts] = await Promise.all([
    chrome.storage.local.get({ 
      buttons: [], 
      categories: ['General', 'Social', 'Work', 'Gaming'] 
    }),
    getCurrentCommandShortcuts()
  ]);
  
  currentCommandShortcuts = shortcuts;
  allButtons = storage.buttons || [];
  renderButtons(allButtons);
  renderCategories(storage.categories || ['General']);
  renderShortcuts();
}

function exportSettings() {
  chrome.storage.local.get(null, (data) => {
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gx-sidebar-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!data.buttons || !Array.isArray(data.buttons)) {
          throw new Error('Invalid settings file format');
        }
        
        const confirmed = await openConfirm('This will overwrite your current settings. Continue?');
        if (confirmed) {
          chrome.storage.local.clear(() => {
            chrome.storage.local.set(data, () => {
              showSuccess('Settings imported successfully!');
              loadButtons();
              loadThemeOptions();
            });
          });
        }
      } catch (error) {
        showError('Error importing settings: ' + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

function renderButtons(buttons) {
  buttonList.innerHTML = '';
  
  var buttonsEmpty = buttons.length === 0;

  const searchTerm = buttonSearch.value.toLowerCase();
  if (searchTerm) {
    const mode = buttonSearchMode.value;
    buttons = buttons.filter(btn => 
      mode === 'name' 
        ? btn.title.toLowerCase().includes(searchTerm)
        : btn.url.toLowerCase().includes(searchTerm)
    );
  }

  if (!buttonsEmpty && (!buttons || buttons.length === 0)) {
    buttonList.innerHTML = '<li style="justify-content: center; padding: 20px;">No buttons found</li>';
    return;
  }

  if (!buttons || buttons.length === 0) {
    buttonList.innerHTML = '<li style="justify-content: center; padding: 20px;">No buttons added yet</li>';
    return;
  }
  chrome.storage.local.get('quickAccess', (result) => {
    const quickAccess = result.quickAccess || {};
    buttons.forEach((btn, i) => {
      const li = document.createElement('li');
      li.setAttribute('draggable', 'true');
      li.setAttribute('data-index', i);
      
      li.innerHTML = `
        <span class="drag-handle" draggable="false">≡</span>
        <img src="${btn.iconBase64}" alt="icon">
        <div class="btn-info">
          <strong>${btn.title}</strong>
          <small>${btn.url}</small>
        </div>
        <select class="mode-select" data-index="${i}">
          <option value="tab">New Tab</option>
          <option value="current">Current Tab</option>
          <option value="popup">Popup</option>
        </select>
        <select class="category-select" data-index="${i}">
          <!-- Categories will be populated by JS -->
        </select>
        <button class="edit-btn" data-index="${i}" title="Edit">✎</button>
        <button class="duplicate-btn" data-index="${i}" title="Duplicate">🗐</button>
        <button class="remove-btn" data-index="${i}" title="Delete">&times;</button>
      `;
      
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragenter', handleDragEnter);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
      
      buttonList.appendChild(li);

      const modeSelect = li.querySelector('.mode-select');
      modeSelect.value = btn.mode;

      modeSelect.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const newMode = e.target.value;
        
        chrome.storage.local.get('buttons', (result) => {
          const buttons = result.buttons || [];
          const newButtons = [...buttons];
          newButtons[index].mode = newMode;
          
          chrome.storage.local.set({ buttons: newButtons }, () => {
            li.style.borderColor = '#ff79c6';
            setTimeout(() => {
              li.style.borderColor = '';
            }, 1000);
          });
        });
      });
      
      const categorySelect = li.querySelector('.category-select');
      populateCategoryDropdown(categorySelect, btn.category);

      categorySelect.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const newCategory = e.target.value;
        
        chrome.storage.local.get('buttons', (result) => {
          const buttons = result.buttons || [];
          const newButtons = [...buttons];
          newButtons[index].category = newCategory;
          
          chrome.storage.local.set({ buttons: newButtons }, () => {
            li.style.borderColor = '#ff79c6';
            setTimeout(() => {
              li.style.borderColor = '';
            }, 1000);
          });
        });
      });
    });
  });
}

function populateCategoryDropdown(selectElement, selectedCategory) {
  chrome.storage.local.get('categories', (result) => {
    const categories = result.categories || [];
    selectElement.innerHTML = '';
    
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      selectElement.appendChild(option);
    });
    
    selectElement.value = selectedCategory || categories[0];
  });
}

function renderCategories(categories) {
  categorySelect.innerHTML = '';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

async function renderShortcuts() {
  const [storage, currentShortcuts] = await Promise.all([
    chrome.storage.local.get(['shortcutAssignments', 'buttons']),
    getCurrentCommandShortcuts()
  ]);
  
  const assignments = storage.shortcutAssignments || {};
  const buttons = storage.buttons || [];
  
  // Clear and rebuild the shortcuts list
  const buttonShortcutsList = document.getElementById('buttonShortcutsList');
  buttonShortcutsList.innerHTML = '';

  // Update sidebar shortcut display
  // const sidebarShortcutDisplay = document.getElementById('sidebarShortcut');
  // sidebarShortcutDisplay.textContent = currentShortcuts.sidebar?.key || 'Not set';

  // Render each slot
  for (let slot = 1; slot <= MAX_SHORTCUTS; slot++) {
    const shortcutItem = document.createElement('div');
    shortcutItem.className = 'shortcut-item';
    shortcutItem.dataset.slot = slot;

    const shortcutDisplay = document.createElement('button');
    shortcutDisplay.className = 'shortcut-display';
    
    // Find button assigned to this slot
    const [buttonId] = Object.entries(assignments).find(([, assignedSlot]) => assignedSlot == slot) || [];
    const button = buttons.find(b => b.id === buttonId);
    const shortcutKey = currentShortcuts.custom[slot]?.key;

    if (button) {
      shortcutDisplay.textContent = `Slot ${slot} - ${button.title} (${shortcutKey || 'Not set'})`;
      shortcutDisplay.title = `${button.url}`;
    } else {
      shortcutDisplay.textContent = `Slot ${slot} - Not assigned (${shortcutKey || 'Not set'})`;
      shortcutDisplay.title = `Click to assign a button`;
    }

    shortcutDisplay.addEventListener('click', () => prepareShortcutAssignment(slot));
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.dataset.slot = slot;
    removeBtn.addEventListener('click', removeShortcut);
    
    shortcutItem.appendChild(shortcutDisplay);
    shortcutItem.appendChild(removeBtn);
    buttonShortcutsList.appendChild(shortcutItem);
  }
}

function prepareShortcutAssignment(slot) {
  currentShortcutToAssign = slot;
  const select = document.getElementById('shortcutButtonSelect');
  select.innerHTML = '';
  
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a button...';
  select.appendChild(defaultOption);
 
  allButtons.forEach(button => {
    const option = document.createElement('option');
    option.value = button.id;
    option.textContent = `${button.title} (${button.url})`;
    select.appendChild(option);
  });
  
  document.getElementById('shortcutAssignment').style.display = 'block';
}

document.getElementById('assignShortcutBtn').addEventListener('click', async () => {
  const buttonId = document.getElementById('shortcutButtonSelect').value;
  if (!buttonId) return;
  
  const slot = currentShortcutToAssign;

  chrome.storage.local.get(['shortcutAssignments'], async (result) => {
    const assignments = result.shortcutAssignments || {};
    
    // Remove any existing assignment for this button
    if (assignments[buttonId]) {
      delete assignments[buttonId];
    }
    
    // Remove any existing assignment for this slot
    Object.keys(assignments).forEach(id => {
      if (assignments[id] == slot) {
        delete assignments[id];
      }
    });

    // Assign the button to this slot
    assignments[buttonId] = slot;
    
    await chrome.storage.local.set({ shortcutAssignments: assignments });
    renderShortcuts();
    document.getElementById('shortcutAssignment').style.display = 'none';
  });
});

async function getCurrentCommandShortcuts() {
  return new Promise((resolve) => {
    chrome.commands.getAll(commands => {
      const shortcuts = {
        sidebar: null,
        custom: {}
      };
      
      commands.forEach(command => {
        if (command.name === '_execute_action') {
          shortcuts.sidebar = {
            key: command.shortcut,
            name: command.name
          };
          console.log(command.shortcut);
        } else if (command.name.startsWith('custom_shortcut_')) {
          const slot = command.name.replace('custom_shortcut_', '');
          shortcuts.custom[slot] = {
            key: command.shortcut,
            name: command.name
          };
        }
      });
      resolve(shortcuts);
    });
  });
}

function migrateShortcutAssignments() {
  chrome.storage.local.get(['shortcuts', 'shortcutAssignments'], (result) => {
    if (result.shortcuts && !result.shortcutAssignments) {
      const newAssignments = {};
      Object.entries(result.shortcuts).forEach(([buttonId, shortcut]) => {
        const slot = shortcut.match(/(\d+)$/)?.[1];
        if (slot) {
          newAssignments[buttonId] = slot;
        }
      });
      chrome.storage.local.set({ 
        shortcutAssignments: newAssignments,
        shortcuts: {}  // Clear old format
      }, () => {
        renderShortcuts();
      });
    }
  });
}

// let recordingTimeout;

// function startRecordingShortcut(e) {
//   if (isRecordingShortcut) return;
  
//   isRecordingShortcut = true;
//   currentRecordingElement = e.currentTarget;
//   currentShortcutKeys = [];
  
//   currentRecordingElement.classList.add('recording');
//   currentRecordingElement.textContent = '...';
  
//   recordingTimeout = setTimeout(() => {
//     if (isRecordingShortcut) {
//       showError('Recording timed out');
//       stopRecordingShortcut();
//     }
//   }, 7000);
  
//   document.addEventListener('keydown', handleShortcutKeyDown);
//   document.addEventListener('keyup', handleShortcutKeyUp);
// }

// function stopRecordingShortcut() {
//   if (!isRecordingShortcut) return;
  
//   clearTimeout(recordingTimeout);
//   isRecordingShortcut = false;
//   currentRecordingElement.classList.remove('recording');
  
//   document.removeEventListener('keydown', handleShortcutKeyDown);
//   document.removeEventListener('keyup', handleShortcutKeyUp);

//   renderShortcuts();
// }

// function handleShortcutKeyDown(e) {
//   e.preventDefault();
  
//   if (!isRecordingShortcut) return;
  
//   // Count current modifiers
//   const currentModifiers = currentShortcutKeys.filter(k => modifierKeys.includes(k));
  
//   // Don't allow more than 2 modifiers
//   if (modifierKeys.includes(e.key) && currentModifiers.length >= 2) return;
  
//   // Only allow modifier keys and number keys
//   if (!modifierKeys.includes(e.key) && !numberKeys.includes(e.code)) return;
  
//   // Don't allow duplicate keys
//   if (currentShortcutKeys.includes(e.key) || currentShortcutKeys.includes(e.code)) return;
  
//   numberKeys.includes(e.code) ? currentShortcutKeys.push(e.code): currentShortcutKeys.push(e.key)
//   updateShortcutDisplay();
  
//   if (numberKeys.includes(e.code)) {
//     setTimeout(() => {
//       if (isRecordingShortcut) {
//         saveShortcut();
//       }
//     }, 300);
//   }
// }

// function handleShortcutKeyUp(e) {
//   if (!isRecordingShortcut) return;
//   e.preventDefault();
  
//   if (!modifierKeys.includes(e.key) && !numberKeys.includes(e.code)) return;

//   saveShortcut();
// }

// function saveShortcut() {
//   if (currentShortcutKeys.length === 0) {
//     stopRecordingShortcut();
//     return;
//   }

//   const hasModifier = currentShortcutKeys.some(k => modifierKeys.includes(k));
//   const hasNumber = currentShortcutKeys.some(k => numberKeys.includes(k));
  
//   if (!hasModifier || !hasNumber) {
//     showError('Shortcut requires at least one modifier key and one number key');
//     currentShortcutKeys = [];
//     renderShortcuts();
//     stopRecordingShortcut();
//     return;
//   }

//   const shortcut = formatShortcutKeys(currentShortcutKeys);
//   const buttonId = document.getElementById('shortcutButtonSelect').value;
  
//   if (!buttonId) {
//     showError('No button selected for shortcut');
//     return;
//   }

//   chrome.storage.local.get(['shortcuts'], (result) => {
//     const shortcuts = result.shortcuts || {};
    
//     Object.keys(shortcuts).forEach(key => {
//       if (shortcuts[key] === shortcut) {
//         delete shortcuts[key];
//       }
//     });
    
//     Object.keys(shortcuts).forEach(key => {
//       if (key === buttonId) {
//         delete shortcuts[key];
//       }
//     });
    
//     // Add the new shortcut
//     shortcuts[buttonId] = shortcut;
    
//     chrome.storage.local.set({ shortcuts }, () => {
//       const commandName = getCommandNameForShortcut(shortcut);
//       if (commandName) {
//         chrome.commands.update({
//           [commandName]: { shortcut: shortcut }
//         });
//       }
//       renderShortcuts();
//       stopRecordingShortcut();
//     });
//   });
// }

// function formatShortcutKeys(keys) {
//   const modifiers = keys.filter(k => modifierKeys.includes(k));
//   const numbers = keys.filter(k => numberKeys.includes(k));
  
//   modifiers.sort((a, b) => {
//     const order = ['Control', 'Alt', 'Shift', 'Meta'];
//     return order.indexOf(a) - order.indexOf(b);
//   });
  
//   const number = numbers.length > 0 ? codeToNumberKey(numbers[0]): "";
  
//   return [...modifiers, number]
//     .map(key => {
//       if (key === 'Meta') return 'Cmd';
//       return key;
//     })
//     .join('+');
// }

// function codeToNumberKey(code) {
//   if (code.startsWith('Digit')) {
//     return code.replace('Digit', '');
//   }
  
//   if (code.startsWith('Numpad')) {
//     return code.replace('Numpad', '');
//   }
//   return null;
// }

// function updateShortcutDisplay() {
//   let displayText = formatShortcutKeys(currentShortcutKeys);
  
//   currentRecordingElement.textContent = displayText || '...';
//   currentRecordingElement.title = 'Press modifier keys (Ctrl, Alt, Shift) then a number';
// }

// function getCommandNameForShortcut(shortcut) {
//   const match = shortcut.match(/(\d+)$/);
//   return match ? `custom_shortcut_${match[1]}` : null;
// }

async function removeShortcut(e) {
  e.stopPropagation();
  const slot = e.currentTarget.dataset.slot;

  chrome.storage.local.get(['shortcutAssignments'], async (result) => {
    const assignments = result.shortcutAssignments || {};
    
    // Remove any assignment for this slot
    Object.keys(assignments).forEach(buttonId => {
      if (assignments[buttonId] == slot) {
        delete assignments[buttonId];
      }
    });
    
    await chrome.storage.local.set({ shortcutAssignments: assignments });
    renderShortcuts();
  });
}

function openCustomThemeCreator() {
  document.getElementById('customThemeModal').classList.add('active');
  resetCustomThemeForm();
  updateThemePreview();
  loadCustomThemeList();
}

function closeCustomThemeModal() {
  document.getElementById('customThemeModal').classList.remove('active');
  isEditingTheme = false;
  currentEditingThemeName = '';
}

function resetCustomThemeForm() {
  document.getElementById('customThemeName').value = '';
  document.getElementById('customBg').value = '#1e1e2e';
  document.getElementById('customCard').value = '#2d2d44';
  document.getElementById('customAccent').value = '#ff79c6';
  document.getElementById('customText').value = '#e0e0ff';
  document.getElementById('customBorder').value = '#4a4a7a';
  document.getElementById('customHover').value = '#3a3a5a';
  document.getElementById('customSecondary').value = '#bd93f9';
  document.getElementById('customSuccess').value = '#50fa7b';
  document.getElementById('customError').value = '#ff5555';
}

function updateThemePreview() {
  const preview = document.getElementById('fullPagePreview');
  
  // Update CSS variables for the preview
  preview.style.setProperty('--preview-bg', document.getElementById('customBg').value);
  preview.style.setProperty('--preview-card', document.getElementById('customCard').value);
  preview.style.setProperty('--preview-accent', document.getElementById('customAccent').value);
  preview.style.setProperty('--preview-text', document.getElementById('customText').value);
  preview.style.setProperty('--preview-border', document.getElementById('customBorder').value);
  preview.style.setProperty('--preview-hover', document.getElementById('customHover').value);
  preview.style.setProperty('--preview-secondary', document.getElementById('customSecondary').value);
  preview.style.setProperty('--preview-success', document.getElementById('customSuccess').value);
  preview.style.setProperty('--preview-error', document.getElementById('customError').value);
}

async function loadCustomThemeList() {
  const { customThemes: themes = [] } = await chrome.storage.local.get('customThemes');
  const themeList = document.getElementById('customThemeList');
  themeList.innerHTML = '';
  
  if (themes.length === 0) {
    themeList.innerHTML = '<p style="text-align: center; color: var(--gx-secondary);">No custom themes yet</p>';
    return;
  }
  
  themes.forEach(theme => {
    const themeItem = document.createElement('div');
    themeItem.className = 'theme-item';
    themeItem.innerHTML = `
      <div>
        <strong>${theme.name}</strong>
        <div style="display: flex; gap: 5px; margin-top: 5px;">
          <div style="width: 15px; height: 15px; background: ${theme.colors.bg}; border: 1px solid ${theme.colors.border};"></div>
          <div style="width: 15px; height: 15px; background: ${theme.colors.card}; border: 1px solid ${theme.colors.border};"></div>
          <div style="width: 15px; height: 15px; background: ${theme.colors.accent}; border: 1px solid ${theme.colors.border};"></div>
        </div>
      </div>
      <div class="theme-item-actions">
        <button class="theme-item-btn edit" data-theme="${theme.name}">Edit</button>
        <button class="theme-item-btn delete" data-theme="${theme.name}">Delete</button>
      </div>
    `;
    themeList.appendChild(themeItem);
  });
  
  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.theme-item-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editCustomTheme(e.target.dataset.theme);
      document.querySelector('.theme-tab[data-tab="create"]').click();
    });
  });
  
  document.querySelectorAll('.theme-item-btn.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const confirmed = await openConfirm(`Delete theme "${e.target.dataset.theme}"?`);
      if (confirmed) {
        deleteCustomTheme(e.target.dataset.theme);
      }
    });
  });
}

async function editCustomTheme(themeName) {
  const { customThemes = [] } = await chrome.storage.local.get('customThemes');
  const theme = customThemes.find(t => t.name === themeName);
  
  if (theme) {
    isEditingTheme = true;
    currentEditingThemeName = themeName;
    
    document.getElementById('customThemeName').value = theme.name;
    document.getElementById('customBg').value = theme.colors.bg;
    document.getElementById('customCard').value = theme.colors.card;
    document.getElementById('customAccent').value = theme.colors.accent;
    document.getElementById('customText').value = theme.colors.text;
    document.getElementById('customBorder').value = theme.colors.border;
    document.getElementById('customHover').value = theme.colors.hover;
    document.getElementById('customSecondary').value = theme.colors.secondary;
    document.getElementById('customSuccess').value = theme.colors.success;
    document.getElementById('customError').value = theme.colors.error;
    
    updateThemePreview();
  }
}

async function deleteCustomTheme(themeName) {
  const { customThemes = [] } = await chrome.storage.local.get('customThemes');
  const updatedThemes = customThemes.filter(t => t.name !== themeName);
  
  await chrome.storage.local.set({ customThemes: updatedThemes });
  loadCustomThemeList();
  updateThemeDropdown();
  
  // If the deleted theme was currently selected, revert to default
  const { theme: currentTheme } = await chrome.storage.local.get('theme');
  if (currentTheme === themeName) {
    const manifest = chrome.runtime.getManifest();
    const defaultTheme = manifest.theme_colors[0].name;
    await chrome.storage.local.set({ theme: defaultTheme });
    applyTheme(manifest.theme_colors[0].colors);
  }
  
  showSuccess(`Theme "${themeName}" deleted`);
}

async function saveCustomTheme() {
  const name = document.getElementById('customThemeName').value.trim();
  if (!name) {
    showError('Please enter a theme name');
    return;
  }

  const theme = {
    name,
    colors: {
      bg: document.getElementById('customBg').value,
      card: document.getElementById('customCard').value,
      accent: document.getElementById('customAccent').value,
      text: document.getElementById('customText').value,
      border: document.getElementById('customBorder').value,
      hover: document.getElementById('customHover').value,
      secondary: document.getElementById('customSecondary').value,
      success: document.getElementById('customSuccess').value,
      error: document.getElementById('customError').value
    }
  };

  const { customThemes: existingThemes = [] } = await chrome.storage.local.get('customThemes');
  
  if (isEditingTheme) {
    const updatedThemes = existingThemes.map(t => 
      t.name === currentEditingThemeName ? theme : t
    );

    if (document.getElementById('theme').value === theme.name) {
      applyTheme(updatedThemes.find(t => t.name === theme.name).colors);
    }
    await chrome.storage.local.set({ customThemes: updatedThemes });
  } else {
    if (existingThemes.some(t => t.name === name)) {
      showError('A theme with this name already exists');
      return;
    }
    await chrome.storage.local.set({ customThemes: [...existingThemes, theme] });
  }

  // Update theme dropdown and list
  await updateThemeDropdown();
  loadCustomThemeList();
  
  showSuccess(`Theme "${name}" saved successfully!`);
  closeCustomThemeModal(); // Add this line to close the popup
  isEditingTheme = false;
  currentEditingThemeName = '';
}

// Update your existing updateThemeDropdown function to include custom themes
async function updateThemeDropdown() {
  const themeSelect = document.getElementById('theme');
  const { customThemes = [], theme: currentTheme } = await chrome.storage.local.get(['customThemes', 'theme']);
  
  // Save current selection
  const selectedTheme = themeSelect.value;
  
  // Clear and rebuild options
  themeSelect.innerHTML = '';
  
  // Add default themes
  const manifest = chrome.runtime.getManifest();
  manifest.theme_colors.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.name;
    option.textContent = theme.name;
    themeSelect.appendChild(option);
  });
  
  // Add custom themes
  customThemes.forEach(theme => {
    const option = document.createElement('option');
    option.value = theme.name;
    option.textContent = `${theme.name} ★`;
    option.style.fontWeight = 'bold';
    themeSelect.appendChild(option);
  });
  
  // Restore selection if still available
  const availableThemes = [...manifest.theme_colors, ...customThemes];
  if (availableThemes.some(t => t.name === selectedTheme)) {
    themeSelect.value = selectedTheme;
  } else if (currentTheme && availableThemes.some(t => t.name === currentTheme)) {
    themeSelect.value = currentTheme;
  } else if (manifest.theme_colors.length > 0) {
    themeSelect.value = manifest.theme_colors[0].name;
  }
}

async function validateAndApplyTheme(themeName) {
  const manifest = chrome.runtime.getManifest();
  const { customThemes = [] } = await chrome.storage.local.get('customThemes');
  
  const builtInTheme = manifest.theme_colors.find(t => t.name === themeName);
  if (builtInTheme) {
    await chrome.storage.local.set({ theme: themeName });
    applyTheme(builtInTheme.colors);
    return true;
  }
  
  const customTheme = customThemes.find(t => t.name === themeName);
  if (customTheme) {
    await chrome.storage.local.set({ theme: themeName });
    applyTheme(customTheme.colors);
    return true;
  }
  
  return false;
}

const categoryModal = document.getElementById('categoryModal');
const newCategoryName = document.getElementById('newCategoryName');
const saveCategory = document.getElementById('saveCategory');
const cancelCategory = document.getElementById('cancelCategory');

const manageCategoriesModal = document.getElementById('manageCategoriesModal');
const categoryManagerList = document.getElementById('categoryManagerList');
const closeManageCategories = document.getElementById('closeManageCategories');

addCategoryBtn.addEventListener('click', () => {
  newCategoryName.value = '';
  categoryModal.classList.add('active');
  newCategoryName.focus();
});

manageCategoriesBtn.addEventListener('click', () => {
  manageCategoriesModal.classList.add('active');
  renderCategoryManager();
});

function closeCategoryModal() {
  categoryModal.classList.remove('active');
}

function closeManageCategoriesModal() {
  manageCategoriesModal.classList.remove('active');
}

cancelCategory.addEventListener('click', closeCategoryModal);
closeManageCategories.addEventListener('click', closeManageCategoriesModal);

saveCategory.addEventListener('click', () => {
  const categoryName = newCategoryName.value.trim();
  
  if (!categoryName) {
    showError('Please enter a category name');
    return;
  }
  
  chrome.storage.local.get('categories', (result) => {
    const categories = result.categories || [];
    
    if (categories.includes(categoryName)) {
      showError('Category already exists');
      return;
    }
    
    const newCategories = [...categories, categoryName];
    
    chrome.storage.local.set({ categories: newCategories }, () => {
      renderCategories(newCategories);
      
      document.querySelectorAll('.category-select').forEach(select => {
        populateCategoryDropdown(select);
      });
      
      chrome.storage.local.get('buttons', (result) => {
        renderButtons(result.buttons || []);
        renderCategories(newCategories);
        closeCategoryModal();
      });
    });
  });
  
});

function renderCategoryManager() {
  categoryManagerList.innerHTML = '';
  
  chrome.storage.local.get(['categories', 'buttons'], (result) => {
    const categories = result.categories || [];
    const buttons = result.buttons || [];
    
    categories.forEach(category => {
      const categoryItem = document.createElement('div');
      categoryItem.className = 'category-item';
      categoryItem.setAttribute('draggable', 'true');
      categoryItem.dataset.category = category;
      
      const buttonCount = buttons.filter(b => b.category === category).length;
      
      categoryItem.innerHTML = `
        <span class="drag-handle" draggable="false">≡</span>
        <div class="category-info">
          <div class="category-name">${category}</div>
          <div class="category-count">${buttonCount} button${buttonCount !== 1 ? 's' : ''}</div>
        </div>
        <button class="remove-btn" data-category="${category}" 
                ${category === 'General' || buttonCount > 0 ? 'disabled' : ''}>
          &times;
        </button>
      `;
      
      categoryItem.addEventListener('dragstart', handleCategoryDragStart);
      categoryItem.addEventListener('dragenter', handleCategoryDragEnter);
      categoryItem.addEventListener('dragover', handleCategoryDragOver);
      categoryItem.addEventListener('dragleave', handleCategoryDragLeave);
      categoryItem.addEventListener('drop', handleCategoryDrop);
      categoryItem.addEventListener('dragend', handleCategoryDragEnd);
      
      categoryManagerList.appendChild(categoryItem);
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = e.target.dataset.category;
        deleteCategory(category);
      });
    });
  });
}

function deleteCategory(category) {
  if (category === 'General') {
    showError('Cannot delete the General category');
    return;
  }
  
  chrome.storage.local.get(['categories', 'buttons'], (result) => {
    let categories = result.categories || [];
    let buttons = result.buttons || [];
    
    const newCategories = categories.filter(c => c !== category);
    
    const newButtons = buttons.map(btn => {
      if (btn.category === category) {
        return {...btn, category: 'General'};
      }
      return btn;
    });
    
   chrome.storage.local.set({ 
      categories: newCategories,
      buttons: newButtons
    }, () => {
      renderButtons(newButtons);
      renderCategories(newCategories);
      renderCategoryManager();
    });
  });
}

categoryModal.addEventListener('click', (e) => {
  if (e.target === categoryModal) {
    closeCategoryModal();
  }
});

manageCategoriesModal.addEventListener('click', (e) => {
  if (e.target === manageCategoriesModal) {
    closeManageCategoriesModal();
  }
});

buttonSearch.addEventListener('input', () => {
  renderButtons(allButtons);
});

buttonSearchMode.addEventListener('change', () => {
  renderButtons(allButtons);
});

function editButton(index) {
  currentlyEditingIndex = index;
  chrome.storage.local.get('buttons', (result) => {
    const buttons = result.buttons || [];
    const button = buttons[index];
    
    if (button) {
      editTitle.value = button.title;
      editUrl.value = button.url;
      editIconPreview.src = button.iconBase64;
      editIcon.value = '';
      
      editModal.classList.add('active');
      editTitle.focus();
    }
  });
}

function duplicateButton(index) {
  chrome.storage.local.get('buttons', (result) => {
    const buttons = result.buttons || [];
    const buttonToDuplicate = buttons[index];
    
    if (buttonToDuplicate) {
      const newButton = {
        ...buttonToDuplicate,
        id: generateId(),
        title: `${buttonToDuplicate.title} (Copy)`
      };
      
      const newButtons = [...buttons];
      newButtons.splice(index + 1, 0, newButton);
      
      chrome.storage.local.set({ buttons: newButtons }, () => {
        renderButtons(newButtons);
      });
    }
  });
}

function showError(message) {
  const icon = document.getElementById('statusIcon');
  const msg = document.getElementById('statusMessage');
  
  icon.textContent = '⚠️';
  msg.textContent = message;
  errorModal.classList.add('active');
}

function showSuccess(message) {
  const icon = document.getElementById('statusIcon');
  const msg = document.getElementById('statusMessage');
  
  icon.textContent = '✅';
  msg.textContent = message;
  errorModal.classList.add('active');
}

function openConfirm(message) {
  return new Promise((resolve) => {
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOK = document.getElementById('confirmOK');
    const confirmCancel = document.getElementById('confirmCancel');
    
    confirmMessage.textContent = message;
    
    confirmModal.classList.add('active');
    
    const cleanUp = () => {
      confirmModal.classList.remove('active');
      confirmOK.removeEventListener('click', onConfirm);
      confirmCancel.removeEventListener('click', onCancel);
    };
    
    const onConfirm = () => {
      cleanUp();
      resolve(true);
    };
    
    const onCancel = () => {
      cleanUp();
      resolve(false);
    };
    
    confirmOK.addEventListener('click', onConfirm);
    confirmCancel.addEventListener('click', onCancel);
  });
}

closeError.addEventListener('click', () => {
  errorModal.classList.remove('active');
});

function toggleQuickAccess(button) {
  if (!button.classList.contains('assign-btn')) return;
  const index = parseInt(button.dataset.index);
  const slot = parseInt(button.dataset.slot);
  
  chrome.storage.local.get(['buttons', 'quickAccess'], (result) => {
    const buttons = result.buttons || [];
    const quickAccess = result.quickAccess || {};
    const buttonId = buttons[index]?.id;
    
    if (buttonId) {
      if (quickAccess[slot] === buttonId) {
        delete quickAccess[slot];
      } else {
        quickAccess[slot] = buttonId;
      }
      
      chrome.storage.local.set({ quickAccess }, () => {
        renderButtons(buttons);
      });
    }
  });
}

buttonList.addEventListener('click', (e) => {
  if (e.target.classList.contains("edit-btn")) {
    const index = parseInt(e.target.dataset.index);
    editButton(index);
  } 
  else if (e.target.classList.contains("duplicate-btn")) {
    const index = parseInt(e.target.dataset.index);
    duplicateButton(index);
  }
  else if (e.target.classList.contains("assign-btn")) {
    toggleQuickAccess(e.target);
  }
  else if (e.target.classList.contains('remove-btn')) {
    const index = parseInt(e.target.dataset.index);
    chrome.storage.local.get('buttons', (result) => {
      const buttons = result.buttons || [];
      const newButtons = [...buttons];
      newButtons.splice(index, 1);
      
      chrome.storage.local.set({ buttons: newButtons }, () => {
        renderButtons(newButtons);
      });
    });
  }
});

form.addEventListener('click', (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const category = categorySelect.value;
  const mode = document.getElementById('mode').value;
  const iconFile = iconInput.files[0];
  
  if (!title) {
    showError('Button title is required');
    return;
  }
  
  if (!url) {
    showError('URL is required');
    return;
  }
  
  try {
    new URL(url);
  } catch (e) {
    showError('Please enter a valid URL');
    return;
  }
  
  const handleIcon = (base64) => {
    chrome.storage.local.get('buttons', (result) => {
      const buttons = result.buttons || [];
      const newButtons = [...buttons, {
        id: generateId(),
        title,
        url,
        category,
        mode,
        iconBase64: base64
      }];
      
      chrome.storage.local.set({ buttons: newButtons }, () => {
        renderButtons(newButtons);
        document.getElementById('title').value = '';
        document.getElementById('url').value = '';
        iconInput.value = '';
        iconPreview.src = '';
      });
    });
  };
  
  if (iconFile) {
    const reader = new FileReader();
    reader.onload = (e) => handleIcon(e.target.result);
    reader.readAsDataURL(iconFile);
  } else {
    fetchFavicon(url).then(handleIcon).catch(() => {
      const defaultIcon = chrome.runtime.getURL('icons/default.png');
      toDataURL(defaultIcon).then(handleIcon);
    });
  }
});

function fetchFavicon(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchFavicon', url },
      (response) => {
        if (response && response.icon) {
          resolve(response.icon);
        } else {
          reject('Favicon not available');
        }
      }
    );
  });
}

function toDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = reject;
    img.src = url;
  });
}

iconInput.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      iconPreview.src = e.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
  }
});

iconDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  iconDropZone.classList.add('drag-over');
});

iconDropZone.addEventListener('dragleave', () => {
  iconDropZone.classList.remove('drag-over');
});

iconDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  iconDropZone.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length && files[0].type.startsWith('image/')) {
    iconInput.files = files;
    const event = new Event('change');
    iconInput.dispatchEvent(event);
  }
});

function handleDragStart(e) {
  draggedIndex = parseInt(this.getAttribute('data-index'));
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedIndex);
  this.classList.add('dragging');
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  const targetIndex = parseInt(this.getAttribute('data-index'));
  if (draggedIndex === targetIndex) return;
  
  chrome.storage.local.get('buttons', (result) => {
    const buttons = result.buttons || [];
    const movedItem = buttons[draggedIndex];
    
    const newButtons = [...buttons];
    newButtons.splice(draggedIndex, 1);
    
    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      newIndex = targetIndex - 1;
    }
    
    newButtons.splice(newIndex, 0, movedItem);
    
    chrome.storage.local.set({ buttons: newButtons }, () => {
      renderButtons(newButtons);
    });
  });
  
  this.classList.remove('drag-over');
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('#buttonList li').forEach(li => {
    li.classList.remove('drag-over');
  });
}

let draggedCategory = null;

function handleCategoryDragStart(e) {
  draggedCategory = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.category);
}

function handleCategoryDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleCategoryDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleCategoryDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleCategoryDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  this.classList.remove('drag-over');
  
  if (draggedCategory !== this) {
    const category = draggedCategory.dataset.category;
    const targetCategory = this.dataset.category;
    
    chrome.storage.local.get('categories', (result) => {
      const categories = result.categories || [];
      const oldIndex = categories.indexOf(category);
      const newIndex = categories.indexOf(targetCategory);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        categories.splice(oldIndex, 1);
        categories.splice(newIndex, 0, category);
        
        chrome.storage.local.set({ categories }, () => {
          chrome.storage.local.get('buttons', (result) => {
            renderButtons(result.buttons || []);
            renderCategories(categories);
            renderCategoryManager();
          });
          
          document.querySelectorAll('.category-select').forEach(select => {
            populateCategoryDropdown(select);
          });
        });
      }
    });
  }
}

function handleCategoryDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  if (e.dataTransfer.types.includes('text/uri-list')) {
    const url = e.dataTransfer.getData('text/uri-list');
    
    chrome.bookmarks.getTree((bookmarkTree) => {
      let title = 'Bookmark';
      
      const matchedBookmark = findBookmarkByUrl(bookmarkTree, url);
      
      if (matchedBookmark) {
        title = matchedBookmark.title;
      } else {
        try {
          title = new URL(url).hostname;
        } catch {
          title = 'Bookmark';
        }
      }

      chrome.storage.local.get('buttons', (result) => {
        const buttons = result.buttons || [];
        const newButtons = [...buttons, {
          id: generateId(),
          title,
          url,
          category: 'General',
          mode: 'tab',
          iconBase64: ''
        }];
        
        chrome.storage.local.set({ buttons: newButtons }, () => {
          renderButtons(newButtons);
          fetchFavicon(url).then(icon => {
            newButtons[newButtons.length - 1].iconBase64 = icon;
            chrome.storage.local.set({ buttons: newButtons }, () => {
              renderButtons(newButtons);
            });
          }).catch(() => {
            const defaultIcon = chrome.runtime.getURL('icons/default.png');
            toDataURL(defaultIcon).then(icon => {
              newButtons[newButtons.length - 1].iconBase64 = icon;
              chrome.storage.local.set({ buttons: newButtons }, () => {
                renderButtons(newButtons);
              });
            });
          });
        });
      });
    });
    return;
  }
  
  if (e.dataTransfer.types.includes('text/tab-url')) {
    const tabData = JSON.parse(e.dataTransfer.getData('text/tab-url'));
    
    chrome.storage.local.get('buttons', (result) => {
      const buttons = result.buttons || [];
      const newButtons = [...buttons, {
        id: generateId(),
        title: tabData.title,
        url: tabData.url,
        category: 'General',
        mode: 'tab',
        iconBase64: ''
      }];
      
      chrome.storage.local.set({ buttons: newButtons }, () => {
        renderButtons(newButtons);
        fetchFavicon(tabData.url).then(icon => {
          newButtons[newButtons.length - 1].iconBase64 = icon;
          chrome.storage.local.set({ buttons: newButtons }, () => {
            renderButtons(newButtons);
          });
        }).catch(() => {
          const defaultIcon = chrome.runtime.getURL('icons/default.png');
          toDataURL(defaultIcon).then(icon => {
            newButtons[newButtons.length - 1].iconBase64 = icon;
            chrome.storage.local.set({ buttons: newButtons }, () => {
              renderButtons(newButtons);
            });
          });
        });
      });
    });
  }
});

document.getElementById('exportBtn').addEventListener('click', exportSettings);
document.getElementById('importBtn').addEventListener('click', importSettings);
document.getElementById('createCustomThemeBtn').addEventListener('click', openCustomThemeCreator);
document.getElementById('cancelCustomTheme').addEventListener('click', closeCustomThemeModal);
document.getElementById('saveCustomTheme').addEventListener('click', saveCustomTheme);
document.querySelectorAll('.theme-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.theme-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.theme-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    document.getElementById(`${tab.dataset.tab}ThemeTab`).classList.add('active');
  });
});

colorInputs.forEach(id => {
  document.getElementById(id).addEventListener('input', updateThemePreview);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'shortcutsUpdated') {
    renderShortcuts();
  }
});
saveEdit.addEventListener('click', () => {
  const title = editTitle.value.trim();
  const url = editUrl.value.trim();
  const iconFile = editIcon.files[0];
  
  if (!title) {
    showError('Button title is required');
    return;
  }
  
  if (!url) {
    showError('URL is required');
    return;
  }
  
  try {
    new URL(url);
  } catch (e) {
    showError('Please enter a valid URL');
    return;
  }
  
  chrome.storage.local.get('buttons', (result) => {
    const buttons = result.buttons || [];
    
    const updateButton = (iconBase64) => {
      const newButtons = [...buttons];
      newButtons[currentlyEditingIndex] = {
        ...newButtons[currentlyEditingIndex],
        title,
        url,
        iconBase64: iconBase64 || newButtons[currentlyEditingIndex].iconBase64
      };
      
      chrome.storage.local.set({ buttons: newButtons }, () => {
        renderButtons(newButtons);
        editModal.classList.remove('active');
      });
    };
    
    if (iconFile) {
      const reader = new FileReader();
      reader.onload = (e) => updateButton(e.target.result);
      reader.readAsDataURL(iconFile);
    } else {
      updateButton();
    }
  });
});

cancelEdit.addEventListener('click', () => {
  editModal.classList.remove('active');
});

editIcon.addEventListener('change', (e) => {
  if (e.target.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      editIconPreview.src = e.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
  }
});

editIconDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  editIconDropZone.classList.add('drag-over');
});

editIconDropZone.addEventListener('dragleave', () => {
  editIconDropZone.classList.remove('drag-over');
});

editIconDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  editIconDropZone.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length && files[0].type.startsWith('image/')) {
    editIcon.files = files;
    const event = new Event('change');
    editIcon.dispatchEvent(event);
  }
});

loadButtons();
loadThemeOptions();

chrome.storage.local.get(['theme'], (result) => {
  if (result.theme) {
    const manifest = chrome.runtime.getManifest();
    const theme = manifest.theme_colors.find(t => t.name === result.theme);
    if (theme) {
      applyTheme(theme.colors);
    }
  }
});