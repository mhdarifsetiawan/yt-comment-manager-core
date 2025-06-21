// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity'; // Pastikan User entity diimport
import { UserController } from './user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Daftarkan User entity ke TypeORM
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService], // Penting: Ekspor UserService agar modul lain bisa menggunakannya
})
export class UserModule {}
