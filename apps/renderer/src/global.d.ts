import type { Api } from '@repo/api';

declare global {
  interface Window {
    appApi?: Api;
  }
}
