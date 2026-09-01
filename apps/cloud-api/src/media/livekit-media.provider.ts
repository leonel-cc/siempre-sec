import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, IngressClient, IngressInput } from 'livekit-server-sdk';
import { MediaProvider, PublisherIngress, ViewSession } from './media.provider';

const TOKEN_TTL_SECONDS = 300;

@Injectable()
export class LiveKitMediaProvider implements MediaProvider {
  constructor(private readonly config: ConfigService) {}

  async createSubscribeSession(roomName: string, identity: string): Promise<ViewSession> {
    const { serverUrl, apiKey, apiSecret } = this.configuration();

    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: TOKEN_TTL_SECONDS,
    });
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublish: false,
      canPublishData: false,
    });
    return {
      serverUrl,
      roomName,
      token: await accessToken.toJwt(),
      expiresInSeconds: TOKEN_TTL_SECONDS,
    };
  }

  async createPublisherIngress(roomName: string, identity: string): Promise<PublisherIngress> {
    const { serverUrl, apiKey, apiSecret } = this.configuration();
    const ingress = await new IngressClient(serverUrl, apiKey, apiSecret).createIngress(
      IngressInput.RTMP_INPUT,
      {
        name: `Security AI ${roomName}`,
        roomName,
        participantIdentity: identity,
        participantName: 'Security AI Edge',
        enableTranscoding: true,
      },
    );
    if (!ingress.ingressId || !ingress.url || !ingress.streamKey) {
      throw new ServiceUnavailableException('LiveKit did not return RTMP ingress credentials');
    }
    return {
      ingressId: ingress.ingressId,
      url: ingress.url,
      streamKey: ingress.streamKey,
    };
  }

  async deletePublisherIngress(ingressId: string): Promise<void> {
    const { serverUrl, apiKey, apiSecret } = this.configuration();
    try {
      await new IngressClient(serverUrl, apiKey, apiSecret).deleteIngress(ingressId);
    } catch (error) {
      const details = error as { code?: string | number; status?: number; message?: string };
      const notFound = details.status === 404
        || details.code === 404
        || details.code === 'not_found'
        || /not[ -]?found/i.test(details.message ?? '');
      if (!notFound) throw error;
    }
  }

  private configuration() {
    const serverUrl = this.config.get<string>('LIVEKIT_URL');
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit is not configured');
    }
    return { serverUrl, apiKey, apiSecret };
  }
}
