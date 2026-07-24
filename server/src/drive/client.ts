import { drive_v3, google, sheets_v4 } from 'googleapis';
import { Config } from '../config';
import { Session } from '../types';
import { decrypt, encrypt } from '../auth/crypto';
import { newOAuthClient, ReauthRequired } from '../auth/oauth';
import { SessionStore } from '../store/sessions';
import { log } from '../util/log';

function isUnauthorized(err: unknown): boolean {
  const e = err as { code?: number; response?: { status?: number } };
  return e?.code === 401 || e?.response?.status === 401;
}

function isInvalidGrant(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error === 'invalid_grant';
}

// Wraps Drive/Sheets calls so a mid-job token expiry refreshes once and retries.
// invalid_grant (revocation or Testing-mode 7-day expiry) fails closed.
export class DriveClient {
  constructor(
    private config: Config,
    private store: SessionStore,
    private session: Session,
  ) {}

  private oauthClient() {
    const client = newOAuthClient(this.config);
    client.setCredentials({
      access_token: this.session.accessToken,
      refresh_token: decrypt(this.session.encryptedRefreshToken, this.config.tokenEncryptionKey),
      expiry_date: this.session.accessTokenExpiry,
    });
    return client;
  }

  private async refresh(): Promise<void> {
    try {
      const { credentials } = await this.oauthClient().refreshAccessToken();
      if (credentials.access_token) this.session.accessToken = credentials.access_token;
      if (credentials.expiry_date) this.session.accessTokenExpiry = credentials.expiry_date;
      if (credentials.refresh_token) {
        this.session.encryptedRefreshToken = encrypt(
          credentials.refresh_token,
          this.config.tokenEncryptionKey,
        );
      }
      this.store.flush();
    } catch (err) {
      if (isInvalidGrant(err)) {
        this.store.delete(this.session.id);
        log.warn('session dropped on invalid_grant', { sessionId: this.session.id });
        throw new ReauthRequired('Google access expired or was revoked. Please sign in again.');
      }
      throw err;
    }
  }

  private drive(): drive_v3.Drive {
    return google.drive({ version: 'v3', auth: this.oauthClient() });
  }

  private sheets(): sheets_v4.Sheets {
    return google.sheets({ version: 'v4', auth: this.oauthClient() });
  }

  async withDrive<T>(fn: (drive: drive_v3.Drive) => Promise<T>): Promise<T> {
    try {
      return await fn(this.drive());
    } catch (err) {
      if (!isUnauthorized(err)) throw err;
      await this.refresh();
      return fn(this.drive());
    }
  }

  async withSheets<T>(fn: (sheets: sheets_v4.Sheets) => Promise<T>): Promise<T> {
    try {
      return await fn(this.sheets());
    } catch (err) {
      if (!isUnauthorized(err)) throw err;
      await this.refresh();
      return fn(this.sheets());
    }
  }
}
