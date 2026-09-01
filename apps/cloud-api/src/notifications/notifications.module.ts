import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CloudCamera,
  NotificationDelivery,
  PhoneRecipient,
  VerificationChallenge,
} from '../entities/entities';
import { AlertDispatchService } from './alert-dispatch.service';
import { PhoneController } from './phone.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { MetaWhatsAppProvider, WHATSAPP_PROVIDER } from './whatsapp.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationChallenge, PhoneRecipient, NotificationDelivery, CloudCamera]),
  ],
  controllers: [PhoneController],
  providers: [
    PhoneVerificationService,
    AlertDispatchService,
    MetaWhatsAppProvider,
    { provide: WHATSAPP_PROVIDER, useExisting: MetaWhatsAppProvider },
  ],
  exports: [AlertDispatchService],
})
export class NotificationsModule {}
