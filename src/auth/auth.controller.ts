// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException, // Tambahkan ini jika belum
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service'; // Hapus AuthResponse dari sini, atau biarkan jika masih dipakai di tempat lain
import { User } from '../user/entities/user.entity'; // Import User karena dipakai di tipe kembalian

// --- Definisi tipe baru untuk respons controller ---
interface ControllerAuthResponse {
  user: User;
  accessToken: string;
}
// ---

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(
    @Body('accessToken') accessToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ControllerAuthResponse> {
    const {
      user,
      accessToken: jwtAccessToken,
      refreshToken,
    } = await this.authService.verifyGoogleAccessToken(accessToken);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      domain: 'localhost',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    return { user, accessToken: jwtAccessToken }; // Sekarang ini sesuai dengan ControllerAuthResponse
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ControllerAuthResponse> {
    // <<< UBAH TIPE KEMBALIAN DI SINI JUGA
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    } = await this.authService.refreshAccessToken(refreshToken);
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      domain: 'localhost',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    return { user, accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }
    res.cookie('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      domain: 'localhost',
      path: '/',
      expires: new Date(0),
      sameSite: 'lax',
    });
    return { message: 'Logged out successfully' };
  }
}
