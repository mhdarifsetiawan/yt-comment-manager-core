// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { UserModule } from '../user/user.module'; // <<< Import UserModule
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm'; // <<< Pastikan ini di-import
import { RefreshToken } from './entities/refresh-token.entity'; // <<< Import RefreshToken entity
import { User } from '../user/entities/user.entity'; // <<< Import User entity (penting!)
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    HttpModule,
    UserModule,
    TypeOrmModule.forFeature([RefreshToken, User]), // Mendaftarkan entitas RefreshToken dan User ke AuthModule
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION_TIME') || '10s',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PassportModule], // Ekspor JwtModule agar JwtStrategy bisa menggunakannya
})
export class AuthModule {}
