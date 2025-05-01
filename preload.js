const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopCapturerBridge', {
  getSources: (opts) => ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
});
