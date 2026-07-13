import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * DTOs for POST /admin/levels.
 *
 * Nested validation runs through the global ValidationPipe (whitelist +
 * forbidNonWhitelisted from configureApp), so extra properties fail
 * fast with 400. Structural checks live here; domain invariants (no
 * overlap, valid direction, etc.) live in the value objects and fire
 * inside the use case.
 */

export class UpsertArrowDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  color!: string;

  @IsArray()
  @IsString({ each: true })
  cells!: string[];

  @IsString()
  @IsNotEmpty()
  direction!: string;
}

export class UpsertCollectibleDto {
  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsString()
  @IsNotEmpty()
  kind!: string;
}

export class UpsertBoardDto {
  @IsInt()
  @Min(1)
  rows!: number;

  @IsInt()
  @Min(1)
  cols!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertArrowDto)
  arrows!: UpsertArrowDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  walls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCollectibleDto)
  collectibles?: UpsertCollectibleDto[];
}

export class UpsertLevelDto {
  @IsUUID('4')
  id!: string;

  @IsInt()
  @Min(0)
  index!: number;

  @IsString()
  @IsNotEmpty()
  difficulty!: string;

  @IsInt()
  @Min(0)
  parTimeMs!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeLimitMs?: number | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ValidateNested()
  @Type(() => UpsertBoardDto)
  board!: UpsertBoardDto;
}