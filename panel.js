document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('buttonContainer');
  const categoryContainer = document.getElementById('categoryContainer');
  const searchInput = document.getElementById('search');
  const searchMode = document.getElementById('searchMode');
  
  let buttons = [];
  let categories = [];
  let quickAccess = {};
  let selectedCategory = 'All';
  
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

  function renderButtons() {
    container.innerHTML = '';

    let filteredButtons = buttons;
    
    if (selectedCategory !== 'All') {
      filteredButtons = filteredButtons.filter(btn => btn.category === selectedCategory);
    }
    
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
      const mode = searchMode.value;
      filteredButtons = filteredButtons.filter(btn => 
        mode === 'name' 
          ? btn.title.toLowerCase().includes(searchTerm)
          : btn.url.toLowerCase().includes(searchTerm)
      );
    }
    
    if (!filteredButtons || filteredButtons.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No Buttons Found</h3>
          <p>Try a different search or category</p>
        </div>
      `;
      return;
    }
    
    filteredButtons.forEach(button => {
      const btnElement = document.createElement('div');
      btnElement.className = 'button';
      btnElement.dataset.id = button.id;
      
      const modeText = button.mode === 'tab' ? 'New Tab' : 
                     button.mode === 'current' ? 'Current Tab' : 'Popup';

      const maxTitleLength = 25;
      const maxUrlLength = 30;
      
      const displayTitle = button.title.length > maxTitleLength 
        ? button.title.substring(0, maxTitleLength) + '...' 
        : button.title;
        
      const displayUrl = button.url.length > maxUrlLength 
        ? button.url.substring(0, maxUrlLength) + '...' 
        : button.url;

      const isSlot1 = Object.values(quickAccess).includes(button.id) && 
                     Object.keys(quickAccess).find(key => quickAccess[key] === button.id) === '1';
      const isSlot2 = Object.values(quickAccess).includes(button.id) && 
                     Object.keys(quickAccess).find(key => quickAccess[key] === button.id) === '2';
      
      btnElement.innerHTML = `
        <img src="${button.iconBase64}" alt="${button.title}">
        <div class="button-info">
          <strong title="${button.title}">${displayTitle}</strong>
          <small title="${button.url}">${displayUrl}</small>
        </div>
        <div class="button-mode">${modeText}</div>
        <div class="quick-access-indicators">
          ${isSlot1 ? '<span class="quick-indicator">1</span>' : ''}
          ${isSlot2 ? '<span class="quick-indicator">2</span>' : ''}
        </div>
      `;
      
      btnElement.addEventListener('click', () => {
        handleButtonClick(button);
      });
      
      container.appendChild(btnElement);
    });
  }

  function handleButtonClick(button) {
    switch (button.mode) {
      case 'tab':
         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            if (isStartPage(tabs[0].url)) {
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
          height: 600,
          state: 'normal'
        }, (win) => {
          if (chrome.runtime.lastError) {
            console.error('Popup error:', chrome.runtime.lastError);
            chrome.tabs.create({ url: button.url });
          }
        });
        break;
    }
  }
  
  function renderCategories() {
    categoryContainer.innerHTML = '';
    
    const allBtn = document.createElement('div');
    allBtn.className = `category-btn ${selectedCategory === 'All' ? 'active' : ''}`;
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => {
      selectedCategory = 'All';
      renderCategories();
      renderButtons();
    });
    categoryContainer.appendChild(allBtn);
    
    categories.forEach(category => {
      const catBtn = document.createElement('div');
      catBtn.className = `category-btn ${selectedCategory === category ? 'active' : ''}`;
      catBtn.textContent = category;
      catBtn.addEventListener('click', () => {
        selectedCategory = category;
        renderCategories();
        renderButtons();
      });
      categoryContainer.appendChild(catBtn);
    });
  }
  
  function loadData() {
    chrome.storage.local.get({ buttons: [], categories: [], quickAccess: {} }, (result) => {
      buttons = result.buttons || [];
      categories = result.categories || [];
      quickAccess = result.quickAccess || {};
      renderCategories();
      renderButtons();
    });
  }
  
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.buttons) {
      buttons = changes.buttons.newValue || [];
      renderButtons();
    }
    if (changes.categories) {
      categories = changes.categories.newValue || [];
      renderCategories();
    }
    if (changes.quickAccess) {
      quickAccess = changes.quickAccess.newValue || {};
      renderButtons();
    }
  });
  
  searchInput.addEventListener('input', renderButtons);
  searchMode.addEventListener('change', renderButtons);
  
  loadData();
});