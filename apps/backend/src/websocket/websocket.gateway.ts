import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'file://'],
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emit(event: string, data: unknown) {
    this.server?.emit(event, data);
  }

  broadcastCameraStatus(cameraId: string, status: string) {
    this.emit('camera.status_changed', { cameraId, status, timestamp: new Date().toISOString() });
  }

  broadcastDetection(detection: unknown) {
    this.emit('detection.created', detection);
  }

  broadcastAlert(alert: unknown) {
    this.emit('security.alert', alert);
  }

  broadcastEvent(event: unknown) {
    this.emit('event.created', event);
  }

  broadcastSystemMetrics(metrics: unknown) {
    this.emit('system.metrics', metrics);
  }
}
