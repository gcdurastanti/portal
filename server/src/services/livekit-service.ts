import { AccessToken } from 'livekit-server-sdk';

export class LiveKitService {
    private apiKey: string;
    private apiSecret: string;
    private wsUrl: string;

    constructor() {
        this.apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
        this.apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
        this.wsUrl = process.env.LIVEKIT_URL || 'ws://localhost:7880';
    }

    async generateToken(roomName: string, participantName: string, identity: string): Promise<string> {
        const at = new AccessToken(this.apiKey, this.apiSecret, {
            identity: identity,
            name: participantName,
        });

        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
        });

        return await at.toJwt();
    }
}
