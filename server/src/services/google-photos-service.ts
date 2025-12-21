import { google } from 'googleapis';
import { PortalDatabase } from '../database';

export class GooglePhotosService {
    private oauth2Client;
    private db: PortalDatabase;

    constructor(db: PortalDatabase) {
        this.db = db;
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    generateAuthUrl() {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/photoslibrary.readonly']
        });
    }

    async authenticate(code: string, userId: string) {
        const { tokens } = await this.oauth2Client.getToken(code);

        this.db.saveGooglePhotosConfig(userId, {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || undefined,
            expiryDate: tokens.expiry_date || undefined
        });

        return tokens;
    }

    async getClient(userId: string) {
        const config = this.db.getGooglePhotosConfig(userId);
        if (!config) return null;

        const client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        client.setCredentials({
            access_token: config.accessToken,
            refresh_token: config.refreshToken || undefined,
            expiry_date: config.expiryDate || undefined
        });

        // Refresh token if needed
        // The client handles this automatically if refresh_token is present
        // But we might want to save the new token if it refreshes
        client.on('tokens', (tokens) => {
            if (tokens.access_token) {
                this.db.saveGooglePhotosConfig(userId, {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token || undefined,
                    expiryDate: tokens.expiry_date || undefined
                });
            }
        });

        return client;
    }

    async listAlbums(userId: string) {
        const client = await this.getClient(userId);
        if (!client) throw new Error('User not authenticated with Google Photos');

        const url = 'https://photoslibrary.googleapis.com/v1/albums';
        const res = await client.request({ url });
        return res.data;
    }

    async getMediaItems(userId: string, albumId?: string) {
        const client = await this.getClient(userId);
        if (!client) throw new Error('User not authenticated with Google Photos');

        let url = 'https://photoslibrary.googleapis.com/v1/mediaItems:search';
        let body: any = {
            pageSize: 100,
            filters: {
                mediaTypeFilter: {
                    mediaTypes: ['PHOTO']
                }
            }
        };

        if (albumId) {
            body.albumId = albumId;
        }

        const res = await client.request({
            url,
            method: 'POST',
            data: body
        });

        return res.data;
    }

    async setSelectedAlbum(userId: string, albumId: string) {
        // Just update the config in DB
        const config = this.db.getGooglePhotosConfig(userId);
        if (config) {
            this.db.saveGooglePhotosConfig(userId, {
                ...config,
                selectedAlbumId: albumId,
                refreshToken: config.refreshToken || undefined,
                expiryDate: config.expiryDate || undefined
            });
        }
    }
}
