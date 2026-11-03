import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ControlDbHealthIndicator } from './control-db.health';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule.forRoot({ errorLogStyle: 'json' })],
  controllers: [HealthController],
  providers: [ControlDbHealthIndicator],
})
export class HealthModule {}
