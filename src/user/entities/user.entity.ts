// src/user/entities/user.entity.ts
import { RefreshToken } from 'src/auth/entities/refresh-token.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'google_sub', unique: true, nullable: true })
  googleSub: string;

  @Column({ nullable: true, type: 'varchar' }) // Pastikan ada @Column({ nullable: true })
  picture: string | null; // <<< PASTIKAN TIPE INI PERSIS string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];
}
