// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { v4 as uuidv4 } from 'uuid'; // Untuk menghasilkan UUID

// Definisikan tipe untuk respons login/refresh
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private GOOGLE_CLIENT_ID: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>, // Pastikan properti ini ada dan benar
    private readonly httpService?: HttpService, // Opsional jika hanya pakai verifyIdToken
  ) {
    this.GOOGLE_CLIENT_ID = this.configService.get<string>('GOOGLE_CLIENT_ID')!;

    if (!this.GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not defined.');
    }
    this.googleClient = new OAuth2Client(this.GOOGLE_CLIENT_ID);
  }

  // --- FUNGSI: Generate Refresh Token ---
  async generateRefreshToken(userId: number): Promise<string> {
    const refreshToken = uuidv4(); // Menggunakan UUID untuk string refresh token
    // const refreshTokenExpirationTime = parseInt(
    //   this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME') || '604800', // Default 7 hari dalam detik
    // );

    const rawExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION_TIME',
    );
    const refreshTokenExpirationTime = parseInt(rawExpiration || '604800');

    console.log(
      `[DEBUG] JWT_REFRESH_EXPIRATION_TIME dari .env: ${rawExpiration}`,
    );
    console.log(`
    [DEBUG] Refresh token akan kedaluwarsa dalam: ${refreshTokenExpirationTime} detik`);

    const expiresAt = new Date(Date.now() + refreshTokenExpirationTime * 1000);

    const newRefreshToken = this.refreshTokenRepository.create({
      token: refreshToken,
      userId: userId,
      expiresAt: expiresAt,
      revoked: false, // Penting: Pastikan ini selalu false saat membuat token baru
    });
    await this.refreshTokenRepository.save(newRefreshToken);
    return refreshToken;
  }

  // --- FUNGSI HELPER: Mendapatkan Token Otentikasi (Access & Refresh) ---
  private async getAuthTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload); // Access Token berumur pendek
    const refreshToken = await this.generateRefreshToken(user.id); // Generate dan simpan Refresh Token

    return { accessToken, refreshToken };
  }

  // --- FUNGSI: Verify Google Access Token (Login Awal) ---
  async verifyGoogleAccessToken(accessToken: string): Promise<AuthResponse> {
    if (!accessToken) {
      throw new BadRequestException('Access token is missing.');
    }

    let googleUserPayload: any;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: accessToken,
        audience: this.GOOGLE_CLIENT_ID,
      });
      googleUserPayload = ticket.getPayload();
      console.log('Google ID Token Payload (verified):', googleUserPayload);
    } catch (idTokenError: any) {
      console.warn(
        'ID Token verification failed, trying with Access Token to userinfo endpoint:',
        idTokenError.message,
      );

      try {
        if (!this.httpService) {
          throw new Error('HttpService not injected for userinfo endpoint.');
        }
        const { data } = await firstValueFrom(
          this.httpService.get(
            `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
          ),
        );
        googleUserPayload = data;
        console.log(
          'User Info from Access Token (verified):',
          googleUserPayload,
        );
      } catch (userInfoError: any) {
        console.error(
          'Failed to get user info with access token:',
          userInfoError.response?.data || userInfoError.message,
        );
        throw new UnauthorizedException(
          'Google authentication failed: Could not verify token or get user info.',
        );
      }
    }

    if (!googleUserPayload) {
      throw new UnauthorizedException(
        'Google authentication failed: No user payload received.',
      );
    }

    if (!googleUserPayload.email || !googleUserPayload.sub) {
      throw new UnauthorizedException(
        'Google authentication failed: Missing email or sub in payload.',
      );
    }

    const user = await this.userService.findOrCreate({
      sub: googleUserPayload.sub,
      email: googleUserPayload.email,
      name: googleUserPayload.name,
      picture: googleUserPayload.picture,
    });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.getAuthTokens(user);

    return {
      user: user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // --- FUNGSI: Refresh Access Token (Kritis untuk Rotating Refresh Token dan Deteksi Penyalahgunaan) ---
  async refreshAccessToken(refreshTokenString: string): Promise<AuthResponse> {
    // 1. Ambil token dari DB tanpa filter `revoked: false`
    const existingRefreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString },
      relations: ['user'],
    });

    // 2. Jika token tidak ditemukan sama sekali di DB
    if (!existingRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // 3. !!! KRITIS: DETEKSI PENYALAHGUNAAN - Jika refresh token sudah dicabut !!!
    // Ini berarti token ini sudah pernah digunakan atau dicabut (oleh logout atau sistem keamanan).
    // Jika ada yang mencoba menggunakannya lagi, itu adalah upaya penyalahgunaan.
    if (existingRefreshToken.revoked === true) {
      console.warn(
        `[SECURITY ALERT] Reused or revoked refresh token detected for user ID: ${existingRefreshToken.user.id}. All sessions revoked.`,
      );
      // Cabut SEMUA refresh token milik user ini untuk memaksa
      // user asli login ulang dan mengamankan akunnya.
      await this.revokeAllRefreshTokensForUser(existingRefreshToken.user.id);
      throw new UnauthorizedException(
        'Sesi Anda telah berakhir karena aktivitas mencurigakan. Silakan login kembali.',
      );
    }

    // 4. Jika refresh token sudah kadaluwarsa (berdasarkan expiresAt)
    // Pengecekan ini dilakukan setelah `revoked` karena `revoked` lebih prioritas (indikasi keamanan).
    if (existingRefreshToken.expiresAt < new Date()) {
      // Tandai sebagai dicabut jika belum, agar statusnya konsisten
      if (!existingRefreshToken.revoked) {
        existingRefreshToken.revoked = true;
        await this.refreshTokenRepository.save(existingRefreshToken);
      }
      throw new UnauthorizedException('Expired refresh token.');
    }

    // --- REFRESH TOKEN ROTATION: Invalidate old refresh token ---
    // Jika semua pengecekan di atas lolos, maka token ini valid dan belum dicabut.
    // Sekarang tandai token lama ini sebagai dicabut karena akan diganti dengan yang baru.
    existingRefreshToken.revoked = true;
    await this.refreshTokenRepository.save(existingRefreshToken);

    // Buat token baru untuk user yang sama
    const user = existingRefreshToken.user;
    if (!user) {
      // Seharusnya tidak terjadi jika `relations: ['user']` berhasil dimuat
      throw new UnauthorizedException('User not found for refresh token');
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.getAuthTokens(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: user,
    };
  }

  // --- FUNGSI: Revoke Refresh Token (Untuk Logout) ---
  async revokeRefreshToken(refreshTokenString: string): Promise<void> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshTokenString, revoked: false }, // Hanya cari yang belum dicabut
    });

    if (refreshToken) {
      refreshToken.revoked = true; // Tandai sebagai dicabut
      await this.refreshTokenRepository.save(refreshToken); // Simpan perubahan
      console.log(
        `Refresh token ${refreshTokenString} revoked for user ${refreshToken.userId}.`,
      );
    } else {
      console.warn(
        `Attempted to revoke non-existent or already revoked refresh token: ${refreshTokenString}`,
      );
    }
  }

  // --- FUNGSI: Mencabut Semua Refresh Token untuk User Tertentu ---
  // Dipanggil saat deteksi penyalahgunaan (token reused) atau ganti password, dll.
  async revokeAllRefreshTokensForUser(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId: userId, revoked: false }, // Hanya update token yang belum dicabut
      { revoked: true }, // Set status menjadi dicabut
    );
    console.log(`All active refresh tokens revoked for user ID: ${userId}`);
  }
}
