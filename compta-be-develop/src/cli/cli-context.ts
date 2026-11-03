import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../app.module';

/** Runs `fn` inside a Nest application context (same services and config as the API), then closes it. */
export async function withAppContext<T>(fn: (app: INestApplicationContext) => Promise<T>): Promise<T> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

/** Entry point helper for `node dist/cli/<script>.js`. */
export function runCli(main: () => Promise<unknown>) {
  main().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
