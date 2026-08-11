import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './config/data-source';
import { CalcEngineModule } from './modules/calc-engine/calc-engine.module';
import { SimpleSalonModule } from './modules/simple-salon/simple-salon.module';
import { XeroModule } from './modules/xero/xero.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({ ...AppDataSource.options }),
    CalcEngineModule,
    XeroModule,
    SimpleSalonModule,
  ],
})
export class AppModule {}
