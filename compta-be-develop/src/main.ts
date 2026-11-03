import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './common/http/configure-app';
import { initSentry } from './common/observability/sentry';
import { startWorkers } from './common/workers';
import { DefaultCredentialsService } from './modules/platform/default-credentials.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);
  const config = app.get(ConfigService);
  initSentry(config.get<string>('SENTRY_DSN'), config.getOrThrow<string>('NODE_ENV'));

  await startWorkers(app);

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  app.get(Logger).log(`API listening on :${port}`, 'Bootstrap');

  // Background: does not delay startup
  void app.get(DefaultCredentialsService).warnIfDefaultPasswordsInUse();
}

void bootstrap();
