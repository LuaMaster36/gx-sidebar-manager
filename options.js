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
let draggedIndex = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

function loadButtons() {
  chrome.storage.local.get({ buttons: [], categories: ['General', 'Social', 'Work', 'Gaming'] }, (result) => {
    renderButtons(result.buttons || []);
    renderCategories(result.categories || ['General']);
  });
}

function renderButtons(buttons) {
  buttonList.innerHTML = '';
  
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
        <div class="quick-access-buttons">
          <button class="assign-btn ${quickAccess[1] === btn.id ? 'assigned' : ''}" 
                  data-index="${i}" data-slot="1">1</button>
          <button class="assign-btn ${quickAccess[2] === btn.id ? 'assigned' : ''}" 
                  data-index="${i}" data-slot="2">2</button>
        </div>
        <button class="remove-btn" data-index="${i}">&times;</button>
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
      
      // Update all category dropdowns
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

function showError(message) {
  errorMessage.textContent = message;
  errorModal.classList.add('active');
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
  if (e.target.classList.contains("assign-btn")) {
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

loadButtons();