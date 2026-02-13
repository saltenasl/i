import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackendHandlers } from '@repo/backend';
import { type SeedProfile, closeDb, initializeRuntimeDatabase } from '@repo/db';
import { BrowserWindow, app } from 'electron';
import { registerIpcApiHandlers } from './ipc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let closeDatabase: (() => Promise<void>) | null = null;

const fatalExit = (message: string, error: unknown): void => {
  console.error(message, error);
  app.exit(1);
};

process.on('uncaughtException', (error) => {
  fatalExit('Uncaught exception in Electron main process.', error);
});

process.on('unhandledRejection', (reason) => {
  fatalExit('Unhandled rejection in Electron main process.', reason);
});

const resolveDbPath = (): string => {
  if (process.env.APP_DB_PATH) {
    return process.env.APP_DB_PATH;
  }

  return path.join(app.getPath('userData'), 'app.sqlite');
};

const resolveSeedProfile = (): SeedProfile | undefined => {
  if (!process.env.APP_DB_SEED_PROFILE) {
    return undefined;
  }

  return process.env.APP_DB_SEED_PROFILE as SeedProfile;
};

const resolveRendererDist = (): string => {
  if (process.env.RENDERER_DIST) {
    return process.env.RENDERER_DIST;
  }

  return path.resolve(process.cwd(), 'apps/renderer/dist');
};

const shouldHideWindow = (): boolean => process.env.E2E_HIDE_WINDOW === '1';

const createMainWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !shouldHideWindow(),
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    fatalExit(
      `Renderer process exited unexpectedly (reason: ${details.reason}, exitCode: ${details.exitCode}).`,
      details,
    );
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    fatalExit(`Renderer failed to load (code: ${code}, description: ${description}).`, description);
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(resolveRendererDist(), 'index.html'));
};

const bootstrap = async (): Promise<void> => {
  const seedProfile = resolveSeedProfile();
  const db = await initializeRuntimeDatabase({
    dbPath: resolveDbPath(),
    ...(seedProfile ? { seedProfile } : {}),
  });

  closeDatabase = async () => {
    await closeDb(db);
  };

  const handlers = createBackendHandlers({ db });
  registerIpcApiHandlers(handlers);
};

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (closeDatabase) {
      await closeDatabase();
      closeDatabase = null;
    }

    app.quit();
  }
});

app.on('before-quit', async () => {
  if (closeDatabase) {
    await closeDatabase();
    closeDatabase = null;
  }
});

app
  .whenReady()
  .then(async () => {
    await bootstrap();
    await createMainWindow();

    app.on('activate', async () => {
      if (!mainWindow) {
        await createMainWindow();
      }
    });
  })
  .catch((error) => {
    fatalExit('Application bootstrap failed.', error);
  });
