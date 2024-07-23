import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CreateMeetingRoomDto } from './dto/create-meeting-room.dto';
import { UpdateMeetingRoomDto } from './dto/update-meeting-room.dto';
import { MeetingRoom } from './entities/meeting-room.entity';

@Injectable()
export class MeetingRoomService {
  @InjectRepository(MeetingRoom)
  private meetingRoomRepository: Repository<MeetingRoom>;

  async find(
    pageNo: number,
    pageSize: number,
    name: string,
    capacity: number,
    equipment: string,
  ) {
    if (pageNo < 1) {
      throw new BadRequestException('pageNo 应该大于 0');
    }
    const condition: Record<string, any> = {};
    if (name) {
      condition.name = Like(`%${name}%`);
    }
    if (equipment) {
      condition.equipment = Like(`%${equipment}%`);
    }
    if (capacity) {
      condition.capacity = capacity;
    }
    const skipCount = (pageNo - 1) * pageSize;

    const [meetingRooms, totalCount] =
      await this.meetingRoomRepository.findAndCount({
        skip: skipCount,
        take: pageSize,
        where: condition,
      });

    return {
      meetingRooms,
      totalCount,
    };
  }

  async create(meetingRoomDto: CreateMeetingRoomDto) {
    const room = await this.meetingRoomRepository.findOneBy({
      name: meetingRoomDto.name,
    });
    if (room) {
      throw new BadRequestException('会议室名字已经存在');
    }
    return await this.meetingRoomRepository.insert(meetingRoomDto);
  }

  async update(meetingRoomDto: UpdateMeetingRoomDto) {
    const meetingRoom = await this.meetingRoomRepository.findOneBy({
      id: meetingRoomDto.id,
    });
    if (!meetingRoom) {
      throw new BadRequestException('会议室不存在');
    }

    meetingRoom.capacity = meetingRoomDto.capacity;
    meetingRoom.location = meetingRoomDto.location;
    meetingRoom.name = meetingRoomDto.name;

    meetingRoomDto.description &&
      (meetingRoom.description = meetingRoomDto.description);

    meetingRoomDto.equipment &&
      (meetingRoom.equipment = meetingRoomDto.equipment);

    await this.meetingRoomRepository.update(
      {
        id: meetingRoom.id,
      },
      meetingRoom,
    );
  }

  async findById(id: number) {
    return await this.meetingRoomRepository.findOneBy({
      id,
    });
  }

  async delete(id: number) {
    await this.meetingRoomRepository.delete({
      id,
    });
    return 'success';
  }
}
