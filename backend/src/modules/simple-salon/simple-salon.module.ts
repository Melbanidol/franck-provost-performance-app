import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Employee,
  EmployeeSalonAssignment,
  RosterHour,
  RosterType,
} from '../../database/entities';
import { SimpleSalonApiClient } from './simple-salon-api.client';
import { SimpleSalonController } from './simple-salon.controller';
import { SimpleSalonRosterSyncService } from './simple-salon-roster-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, RosterHour, RosterType, EmployeeSalonAssignment])],
  controllers: [SimpleSalonController],
  providers: [SimpleSalonApiClient, SimpleSalonRosterSyncService],
  exports: [SimpleSalonApiClient, SimpleSalonRosterSyncService],
})
export class SimpleSalonModule {}
