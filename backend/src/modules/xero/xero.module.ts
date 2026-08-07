import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee, XeroConnection } from '../../database/entities';
import { XeroCallbackController } from './xero-callback.controller';
import { XeroController } from './xero.controller';
import { XeroOauthService } from './xero-oauth.service';
import { XeroPayrollService } from './xero-payroll.service';

@Module({
  imports: [TypeOrmModule.forFeature([XeroConnection, Employee])],
  controllers: [XeroController, XeroCallbackController],
  providers: [XeroOauthService, XeroPayrollService],
  exports: [XeroOauthService, XeroPayrollService],
})
export class XeroModule {}
