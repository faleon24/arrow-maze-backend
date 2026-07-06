import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService wraps PrismaClient and ties its connection lifecycle
 * to the NestJS module lifecycle.
 *
 * This class lives in the infrastructure layer. Domain and application
 * code never touch it directly; they depend on repository interfaces
 * (ports) instead, and this service is injected into the concrete
 * repository adapter (PostgresUserRepository).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}