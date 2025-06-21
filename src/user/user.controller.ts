// src/user/user.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport'; // <<< IMPORT INI
import { Request } from 'express'; // Import Request dari express

@Controller('user') // Endpoint dasar /user
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(AuthGuard('jwt')) // <<< Gunakan Jwt AuthGuard untuk melindungi endpoint ini
  @Get('profile') // Endpoint /user/profile
  getProfile(@Req() req: Request) {
    // Di sini, req.user akan berisi objek User yang dikembalikan oleh JwtStrategy.validate()
    // Karena kita mengembalikan User dari validate, maka req.user akan bertipe User.
    return req.user; // Mengembalikan data user yang sedang login
  }
}
