import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../auth/auth.module';
import { PopupLayersController } from './popup-layers.controller';
import { PopupLayersService } from './popup-layers.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [PopupLayersController],
  providers: [PopupLayersService],
})
export class PopupLayersModule {}
