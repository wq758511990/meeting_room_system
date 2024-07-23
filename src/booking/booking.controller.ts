import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UserInfo } from 'src/custom.decorator';
import { generateParseIntPipe } from 'src/util';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('list')
  async list(
    @Query('pageNo', new DefaultValuePipe(1), generateParseIntPipe('pageNo'))
    pageNo: number,
    @Query(
      'pageSize',
      new DefaultValuePipe(10),
      generateParseIntPipe('pageSize'),
    )
    pageSize: number,
    @Query('username') username: string,
    @Query('meetingRoomName') meetingRoomName: string,
    @Query('meetingRoomPosition') meetingRoomPosition: string,
    @Query(
      'bookingTimeRangeStart',
      generateParseIntPipe('bookingTimeRangeStart'),
    )
    bookingTimeRangeStart: number,
    @Query('bookingTimeRangeEnd', generateParseIntPipe('bookingTimeRangeEnd'))
    bookingTimeRangeEnd: number,
  ) {
    return this.bookingService.find(
      pageNo,
      pageSize,
      username,
      meetingRoomName,
      meetingRoomPosition,
      bookingTimeRangeStart,
      bookingTimeRangeEnd,
    );
  }

  @Post('add')
  async add(
    @Body() booking: CreateBookingDto,
    @UserInfo('userId') userId: number,
  ) {
    await this.bookingService.add(booking, userId);
  }

  @Get('apply/:id')
  async apply(@Param('id') id: number) {
    return this.bookingService.apply(id);
  }

  @Get('reject/:id')
  async reject(@Param('id') id: number) {
    return this.bookingService.reject(id);
  }

  @Get('unbind/:id')
  async unbind(@Param('id') id: number) {
    return this.bookingService.unbind(id);
  }

  @Get('urge/:id')
  async urge(@Param('id') id: number) {
    return this.bookingService.urge(id);
  }
}
