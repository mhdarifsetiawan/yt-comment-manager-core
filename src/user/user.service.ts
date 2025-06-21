// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Mencari user berdasarkan ID.
   * @param id ID user (number/int4).
   * @returns Objek User atau undefined jika tidak ditemukan.
   */
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Mencari user berdasarkan googleSub atau email. Jika tidak ditemukan, membuat user baru.
   * Jika ditemukan berdasarkan email tetapi belum ada googleSub, akan diupdate.
   * @param googleUser Data user dari Google (sub, email, name, picture).
   * @returns Objek User dari database.
   */
  async findOrCreate(googleUser: {
    sub: string;
    email: string;
    name?: string; // name bisa opsional karena di entity juga nullable
    picture?: string;
  }): Promise<User> {
    // 1. Coba cari user berdasarkan Google Sub (ID unik dari Google)
    let user = await this.userRepository.findOne({
      where: { googleSub: googleUser.sub },
    });

    if (!user) {
      // 2. Jika tidak ditemukan berdasarkan googleSub, coba cari berdasarkan email
      user = await this.userRepository.findOne({
        where: { email: googleUser.email },
      });

      if (!user) {
        // 3. Jika user belum ada sama sekali (baik googleSub maupun email), buat user baru
        user = this.userRepository.create({
          googleSub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name, // name dari GoogleUser bisa null/undefined, tapi entitas User.name kita bisa nullable.
          picture: googleUser.picture ?? null,
        });
        await this.userRepository.save(user);
        console.log('New user created:', user.email);
      } else {
        // 4. Jika ditemukan berdasarkan email tapi belum ada googleSub, update user
        let needsUpdate = false;
        if (!user.googleSub) {
          user.googleSub = googleUser.sub;
          needsUpdate = true;
        }
        if (googleUser.name !== undefined && user.name !== googleUser.name) {
          user.name = googleUser.name;
          needsUpdate = true;
        }
        const newPicture = googleUser.picture ?? null;
        if (user.picture !== newPicture) {
          user.picture = newPicture;
          needsUpdate = true;
        }
        // Pastikan email konsisten
        if (user.email !== googleUser.email) {
          user.email = googleUser.email;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await this.userRepository.save(user);
          console.log(
            'Existing user updated with Google Sub/info:',
            user.email,
          );
        }
      }
    } else {
      // 5. Jika user sudah ada berdasarkan googleSub, perbarui informasi dasar jika ada perubahan
      let needsUpdate = false;
      if (googleUser.name !== undefined && user.name !== googleUser.name) {
        user.name = googleUser.name;
        needsUpdate = true;
      }
      const newPicture = googleUser.picture ?? null;
      if (user.picture !== newPicture) {
        user.picture = newPicture;
        needsUpdate = true;
      }
      if (user.email !== googleUser.email) {
        user.email = googleUser.email;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.userRepository.save(user);
        console.log('Existing user information updated:', user.email);
      }
    }
    return user;
  }
}
