export interface ViewSession {
  serverUrl: string;
  roomName: string;
  token: string;
  expiresInSeconds: number;
}

export interface MediaProvider {
  createSubscribeSession(roomName: string, identity: string): Promise<ViewSession>;
  createPublisherIngress(roomName: string, identity: string): Promise<PublisherIngress>;
  deletePublisherIngress(ingressId: string): Promise<void>;
}

export interface PublisherIngress {
  ingressId: string;
  url: string;
  streamKey: string;
}

export const MEDIA_PROVIDER = Symbol('MEDIA_PROVIDER');
