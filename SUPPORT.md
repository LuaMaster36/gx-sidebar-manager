# GX Sidebar Manager - Support Guide

## 🚀 Getting Started
### System Requirements
- **Browsers**: Opera GX (v89+) or Chrome (v114+)
- **Permissions**: Requires access to bookmarks, tabs, and storage

## 🔍 Common Issues & Solutions

### 1. Sidebar Won't Open
**Symptoms**:
- Clicking icon does nothing
- Keyboard shortcut doesn't work

**Solutions**:
```steps
1. Verify extension is enabled at opera://extensions
2. Check keyboard shortcut at opera://extensions/shortcuts
3. Try in a new window without other extensions
```

### 2. Buttons Not Saving
**Fix**:
```steps
1. Clear extension storage:
   - Right-click extension icon → "Manage extension"
   - Click "Remove" then reinstall
2. Ensure no storage limits are reached
```

### 3. Icons Not Loading
**Troubleshooting**:
- For specific sites: Try manual icon upload
- For all sites: Check host permissions in manifest.json

## ❓ FAQ

### Q: Can I use this in Firefox?
**A**: No - uses Opera-specific APIs like `sidePanel`

### Q: How to export my buttons?
**A**: Currently not supported - data is stored locally in browser storage

### Q: Why can't I delete the All category?
**A**: This is a protected default category

## 🐛 Reporting Bugs
Report [here](https://github.com/LuaMaster36/gx-sidebar-manager/issuse).
Please include:
1. Browser version
2. Exact steps to reproduce
3. Console errors (F12 → Console)
4. Screenshots if relevant

**Template**:
```
Issue: [Brief description of the problem]

Steps to Reproduce:
1. [First step]
2. [Second step]
3. [Third step]

Expected Behavior: [What should happen]

Actual Behavior: [What actually happens]

Browser Version: [e.g., Opera GX v101]
Extension Version: [e.g., v1.3]

Screenshots: [If applicable]
```

## 💡 Feature Requests
We welcome suggestions! Please:
- Check existing issues first
- Explain your use case
- Suggest implementation if possible

## 📞 Contact
For urgent support:
- Email: gxsidebarmanager@gmail.com
- Discord: @apessw_65515

## 🛠️ Developer Notes
If contributing:
- All storage operations use `chrome.storage.local`
- Key components:
  - `options.js` - Main logic
  - `sw.js` - Background processes
  - `panel.js` - Sidebar UI

---

> ⚠️ **Before contacting support**:
> 1. Restart browser
> 2. Test in incognito mode
> 3. Disable other extensions
