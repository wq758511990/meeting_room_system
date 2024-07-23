import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EmailService } from 'src/email/email.service';
import { MeetingRoom } from 'src/meeting-room/entities/meeting-room.entity';
import { RedisService } from 'src/redis/redis.service';
import { User } from 'src/user/entities/user.entity';
import {
  Between,
  EntityManager,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
} from 'typeorm';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingService {
  @InjectEntityManager()
  private entityManager: EntityManager;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(EmailService)
  private emailService: EmailService;

  async find(
    pageNo: number,
    pageSize: number,
    username: string,
    meetingRoomName: string,
    meetingRoomPosition: string,
    bookingTimeRangeStart: number,
    bookingTimeRangeEnd: number,
  ) {
    const skipCount = (pageNo - 1) * pageSize;
    const condition: Record<string, any> = {};

    if (username) {
      condition.user = {
        username: Like(`%${username}%`),
      };
    }

    if (meetingRoomName) {
      condition.room = {
        name: Like(`%${meetingRoomName}%`),
      };
    }

    if (meetingRoomPosition) {
      if (!condition.room) {
        condition.room = {};
      }
      condition.room.location = Like(`%${meetingRoomPosition}%`);
    }

    if (bookingTimeRangeStart) {
      if (!bookingTimeRangeEnd) {
        bookingTimeRangeEnd = bookingTimeRangeStart + 60 * 60 * 1000;
      }
      condition.startTime = Between(
        new Date(bookingTimeRangeStart),
        new Date(bookingTimeRangeEnd),
      );
    }

    const [bookings, totalCount] = await this.entityManager.findAndCount(
      Booking,
      {
        where: condition,
        relations: {
          user: true,
          room: true,
        },
        skip: skipCount,
        take: pageSize,
      },
    );
    return {
      bookings: bookings.map((item) => {
        delete item.user.password;
        return item;
      }),
      totalCount,
    };
  }

  async add(booking: CreateBookingDto, userId: number) {
    const meetingRoom = await this.entityManager.findOneBy(MeetingRoom, {
      id: booking.meetingRoomId,
    });

    if (!meetingRoom) {
      throw new BadRequestException('会议室不存在');
    }

    const user = await this.entityManager.findOneBy(User, {
      id: userId,
    });

    const addedBooking = new Booking();
    addedBooking.room = meetingRoom;
    addedBooking.user = user;
    addedBooking.startTime = new Date(booking.startTime);
    addedBooking.endTime = new Date(booking.endTime);

    const res = await this.entityManager.findOneBy(Booking, {
      room: meetingRoom,
      startTime: LessThanOrEqual(addedBooking.startTime),
      endTime: MoreThanOrEqual(addedBooking.endTime),
    });

    if (res) {
      throw new BadRequestException('该时间段已被预定');
    }

    await this.entityManager.save(Booking, addedBooking);
  }

  async apply(id: number) {
    await this.entityManager.update(Booking, id, {
      status: '审批通过',
    });
    return 'success';
  }
  async reject(id: number) {
    await this.entityManager.update(Booking, id, {
      status: '审批驳回',
    });
    return 'success';
  }
  async unbind(id: number) {
    await this.entityManager.update(Booking, id, {
      status: '已解除',
    });
    return 'success';
  }

  async urge(id: number) {
    const flag = await this.redisService.get(`urge_${id}`);

    if (flag) {
      return '半小时内只能催办一次';
    }

    let email = await this.redisService.get('admin_email');
    if (!email) {
      const admin = await this.entityManager.findOne(User, {
        select: {
          email: true,
        },
        where: {
          isAdmin: true,
        },
      });

      email = admin.email;

      this.redisService.set('admin_email', admin.email);
    }

    this.emailService.sendMail({
      to: email,
      subject: '预定申请催办提醒',
      html: `id 为 ${id} 的预定申请需要审批`,
    });

    this.redisService.set(`urge_${id}`, 1, 60 * 30);
  }
}
