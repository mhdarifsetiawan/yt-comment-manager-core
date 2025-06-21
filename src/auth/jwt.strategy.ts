// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config'; // Pastikan ini di-import
import { UserService } from '../user/user.service'; // Pastikan path ini benar
import { User } from '../user/entities/user.entity'; // Pastikan path ini benar

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService, // Properi ini akan tersedia setelah super() dipanggil
    private userService: UserService,
  ) {
    // Kita perlu mendapatkan JWT_SECRET di sini
    // Cara paling mudah adalah dengan mendapatkan ConfigService di super()
    // Atau, mendapatkan nilai JWT_SECRET sebelum super() dan meneruskannya.

    // Opsi terbaik: Mendapatkan nilai secret langsung di dalam super()
    const jwtSecret = configService.get<string>('JWT_SECRET'); // Mengakses configService dari parameter konstruktor

    if (!jwtSecret) {
      throw new Error('Variabel lingkungan JWT_SECRET tidak terdefinisi.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // Gunakan variabel yang sudah dipastikan ada
    });
  }

  async validate(payload: { sub: number; email: string }): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return user;
  }
}
