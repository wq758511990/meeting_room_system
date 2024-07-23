import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookingModule } from './booking/booking.module';
import { Booking } from './booking/entities/booking.entity';
import { EmailModule } from './email/email.module';
import { LoginGuard } from './login.guard';
import { MeetingRoom } from './meeting-room/entities/meeting-room.entity';
import { MeetingRoomModule } from './meeting-room/meeting-room.module';
import { PermissionGuard } from './permission.guard';
import { RedisModule } from './redis/redis.module';
import { StatisticController } from './statistic/statistic.controller';
import { StatisticService } from './statistic/statistic.service';
import { Permission } from './user/entities/permission.entity';
import { Role } from './user/entities/role.entity';
import { User } from './user/entities/user.entity';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory(configService: ConfigService) {
        return {
          type: 'mysql',
          host: configService.get('mysql_server_host'),
          port: configService.get('mysql_server_port'),
          username: configService.get('mysql_server_username'),
          password: configService.get('mysql_server_password'),
          database: configService.get('mysql_server_database'),
          synchronize: true,
          logging: true,
          entities: [User, Role, Permission, MeetingRoom, Booking],
          poolSize: 10,
          connectorPackage: 'mysql2',
          extra: {
            authPlugin: 'sha256_password',
          },
        };
      },
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      global: true,
      useFactory(configService: ConfigService) {
        return {
          secret: configService.get('jwt_secret'),
          signOptions: {
            expiresIn: configService.get('jwt_access_token_expires_time'),
          },
        };
      },
      inject: [ConfigService],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(
        __dirname,
        process.env.NODE_ENV === 'production' ? '.production.env' : '.env',
      ),
    }),
    UserModule,
    RedisModule,
    EmailModule,
    MeetingRoomModule,
    BookingModule,
  ],
  controllers: [AppController, StatisticController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: LoginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    StatisticService,
  ],
})
export class AppModule {}
