// src/auth/entities/refresh-token.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity'; // Pastikan path ke User.entity.ts benar

@Entity('refresh_tokens')
export class RefreshToken {
  // ID token, akan otomatis bertambah (increment) dan bertipe number
  @PrimaryGeneratedColumn('increment')
  id: number;

  // String refresh token itu sendiri (UUID)
  @Column({ type: 'text', unique: true, nullable: false })
  token: string;

  // ID pengguna yang memiliki refresh token ini
  // Tipe data harus int (int4) agar sesuai dengan User.id
  @Column({ name: 'user_id', type: 'int', nullable: false }) // Pastikan nullable: false (wajib ada user)
  userId: number; // Bertipe number, cocok dengan User.id

  // Hubungan Many-to-One dengan User
  // Banyak RefreshToken dapat dimiliki oleh satu User
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' }) // onDelete: 'CASCADE' akan menghapus RT jika user dihapus
  @JoinColumn({ name: 'user_id' }) // Menentukan kolom Foreign Key
  user: User;

  // Waktu kadaluwarsa token
  @Column({ type: 'timestamptz', name: 'expires_at', nullable: false })
  expiresAt: Date;

  // Status pencabutan token (true jika dicabut)
  @Column({ type: 'boolean', default: false, nullable: false })
  revoked: boolean;

  // Waktu pembuatan token
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
