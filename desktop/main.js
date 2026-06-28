const { app, BrowserWindow, Tray, Menu, Notification, nativeImage, dialog, shell } = require('electron');
const path = require('path');

const ADMIN_URL = `file://${path.join(__dirname, 'admin.html')}`;

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Icon data (32x32 purple heart, generated as PNG bytes)
function createIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = x - size/2, cy = y - size/2;
      // Simple heart shape
      const t = Math.atan2(cy, cx);
      const r = Math.sqrt(cx*cx + cy*cy);
      const heart = Math.pow(cx*cx + cy*cy - size*size*0.2, 2) - cx*cx*cy*cy*0.01;
      const inHeart = heart < size * size * 2;
      buf[i] = inHeart ? 139 : 0;     // R
      buf[i+1] = inHeart ? 47 : 0;    // G
      buf[i+2] = inHeart ? 142 : 0;   // B
      buf[i+3] = inHeart ? 255 : 0;   // A
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

const appIcon = createIcon();

app.on('ready', () => {
  createWindow();
  try { createTray(); } catch (e) { console.log('Tray not supported on this system'); }
  pollOrders();
});

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'GlowRX Manager - لوحة التحكم',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(ADMIN_URL);

  mainWindow.once('ready-to-show', () => { mainWindow.show(); });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      if (Notification.isSupported()) {
        new Notification({
          title: 'GlowRX Manager',
          body: 'التطبيق لا يزال يعمل في شريط المهام',
        }).show();
      }
    }
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  tray = new Tray(appIcon);
  tray.setToolTip('GlowRX Manager - لوحة التحكم');

  const contextMenu = Menu.buildFromTemplate([
    { label: '🖥️ فتح لوحة التحكم', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    {
      label: '📦 الطلبات', click: () => {
        mainWindow.show();
        mainWindow.webContents.executeJavaScript('showSection("orders")');
      },
    },
    {
      label: '🛍️ المنتجات', click: () => {
        mainWindow.show();
        mainWindow.webContents.executeJavaScript('showSection("products")');
      },
    },
    {
      label: '👥 العملاء', click: () => {
        mainWindow.show();
        mainWindow.webContents.executeJavaScript('showSection("users")');
      },
    },
    {
      label: '📊 الإحصائيات', click: () => {
        mainWindow.show();
        mainWindow.webContents.executeJavaScript('showSection("dashboard")');
      },
    },
    { type: 'separator' },
    { label: '🔄 تحديث', click: () => { mainWindow.webContents.reload(); } },
    {
      label: '🌐 فتح في المتصفح', click: () => {
        shell.openExternal(ADMIN_URL);
      },
    },
    { type: 'separator' },
    { label: '❌ خروج', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// Poll for new orders every 30 seconds
let lastOrderCount = 0;

function pollOrders() {
  setInterval(async () => {
    try {
      const res = await fetch('https://cosmetics-store-api.vercel.app/api/admin/stats', {
        headers: { 'x-admin-key': 'admin123' },
      });
      const data = await res.json();
      const count = data.stats.totalOrders;
      if (count > lastOrderCount && lastOrderCount > 0) {
        const newOrders = count - lastOrderCount;
        if (Notification.isSupported()) {
          new Notification({
            title: '🆕 طلب جديد!',
            body: `تم استلام ${newOrders} طلب جديد`,
            icon: appIcon,
          }).show();
        }
        if (mainWindow && !mainWindow.isVisible()) {
          tray.displayBalloon({
            title: 'طلب جديد',
            content: `تم استلام ${newOrders} طلب جديد في GlowRX`,
          });
        }
      }
      lastOrderCount = count;
    } catch {}
  }, 30000);
}
