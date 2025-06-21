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

  async findOrCreate(googleUser: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { googleSub: googleUser.sub },
    });

    if (!user) {
      user = await this.userRepository.findOne({
        where: { email: googleUser.email },
      });

      if (!user) {
        user = this.userRepository.create({
          googleSub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        });
        await this.userRepository.save(user);
        console.log('New user created:', user.email);
      } else {
        user.googleSub = googleUser.sub;
        user.name = googleUser.name;
        user.picture = googleUser.picture ?? null;
        await this.userRepository.save(user);
        console.log('Existing user updated with Google Sub:', user.email);
      }
    } else {
      if (
        user.name !== googleUser.name ||
        user.picture !== googleUser.picture ||
        user.email !== googleUser.email
      ) {
        user.name = googleUser.name;
        user.email = googleUser.email;
        user.picture = googleUser.picture ?? null;
        await this.userRepository.save(user);
        console.log('Existing user information updated:', user.email);
      }
    }
    return user;
  }
}
