// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- TAMBAHKAN BAGIAN INI UNTUK CORS ---
  app.enableCors({
    origin: 'http://localhost:3000', // Izinkan permintaan dari Next.js/FE
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Izinkan kredensial jika berencana menggunakannya (misalnya cookie)
  });
  // -------------------------------------

  app.use(cookieParser()); // Gunakan middleware cookie-parser

  await app.listen(process.env.PORT ?? 3001);
  console.log(`NestJS application is running on: ${await app.getUrl()}`);
}
void bootstrap();
