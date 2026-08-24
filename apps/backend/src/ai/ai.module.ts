import { Module, Global } from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { AiController } from './ai.controller';

@Global()
@Module({
  controllers: [AiController],
  providers: [AiClientService],
  exports: [AiClientService],
})
export class AiModule {}
