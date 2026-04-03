import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details ?? null,
      });

      await this.auditRepo.save(entry);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit log for action "${input.action}"`,
      );
    }
  }
}
