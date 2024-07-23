import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/util';
import { Like, Repository } from 'typeorm';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserPasswordDto } from './dto/udate-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';
import { LoginUserVo } from './vo/login-user.vo';

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private userRepository: Repository<User>;

  @InjectRepository(Role)
  private roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(EmailService)
  private emailService: EmailService;

  @Inject(JwtService)
  private jwtService: JwtService;

  @Inject(ConfigService)
  private configService: ConfigService;

  async register(user: RegisterUserDto) {
    const captcha = await this.redisService.get(`captcha_${user.email}`);

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if (user.captcha !== captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      username: user.username,
    });

    if (foundUser) {
      throw new HttpException('用户名已存在', HttpStatus.BAD_REQUEST);
    }
    const newUser = new User();
    newUser.username = user.username;
    newUser.password = md5(user.password);
    newUser.email = user.email;
    newUser.nickname = user.nickname;

    try {
      await this.userRepository.save(newUser);
      return '注册成功';
    } catch (error) {
      this.logger.error(error, UserService);
      return '注册失败';
    }
  }

  async sendCaptcha(address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(`captcha_${address}`, code, 60 * 5);

    await this.emailService.sendMail({
      to: address,
      subject: '验证码',
      html: `<p>您的验证码是：${code}</p>`,
    });

    return '发送成功';
  }

  async login(loginUser: LoginUserDto, isAdmin: boolean = false) {
    const user = await this.userRepository.findOne({
      where: {
        username: loginUser.username,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }
    if (user.password !== md5(loginUser.password)) {
      throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
    }
    const vo = new LoginUserVo();
    vo.userInfo = {
      id: user.id,
      username: user.username,
      nickName: user.nickname,
      email: user.email,
      phoneNumber: user.phoneNumber,
      headPic: user.headPic,
      createTime: user.createTime.getTime(),
      isFrozen: user.isFrozen,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
    return vo;
  }

  getJwtToken(
    userId: number,
    username: string,
    roles: any[],
    permissions: any[],
  ) {
    const accessToken = this.jwtService.sign(
      {
        userId,
        username,
        roles,
        permissions,
      },
      {
        expiresIn:
          this.configService.get('jwt_access_token_expires_time') || '30m',
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        userId,
      },
      {
        expiresIn:
          this.configService.get('jwt_refresh_token_expires_time') || '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async findUserById(userId: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isAdmin,
      },
      relations: ['roles', 'roles.permissions'],
    });

    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map((item) => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach((permission) => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, []),
    };
  }

  async getRefreshedToken(
    token: string,
    isAdmin: boolean,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const data = this.jwtService.verify(token);
      const user = await this.findUserById(data.userId, isAdmin);
      const { accessToken, refreshToken: newRefreshToken } = this.getJwtToken(
        user.id,
        user.username,
        user.roles,
        user.permissions,
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('token已失效，请重新登陆');
    }
  }

  async findUserDetailById(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    return user;
  }

  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const captcha = await this.redisService.get(
      `update_password_captcha_${passwordDto.email}`,
    );

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if (passwordDto.captcha !== captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      id: userId,
    });

    foundUser.password = md5(passwordDto.password);
    try {
      await this.userRepository.save(foundUser);
      return '密码修改成功';
    } catch (error) {
      this.logger.error(error, UserService);
      return '密码修改失败';
    }
  }

  async update(userId: number, updateUserDto: UpdateUserDto) {
    const captcha = await this.redisService.get(
      `update_user_captcha_${updateUserDto.email}`,
    );

    if (!captcha) {
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if (updateUserDto.captcha !== captcha) {
      throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      id: userId,
    });

    if (updateUserDto.nickname) {
      foundUser.nickname = updateUserDto.nickname;
    }
    if (updateUserDto.headPic) {
      foundUser.headPic = updateUserDto.headPic;
    }

    try {
      await this.userRepository.save(foundUser);
      return '更新成功';
    } catch (error) {
      this.logger.error(error, UserService);
      return '更新失败';
    }
  }

  async freezeUserById(id: number) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    user.isFrozen = true;

    await this.userRepository.save(user);
  }

  async findUsersByPage(
    username: string,
    nickname: string,
    email: string,
    page: number,
    pageSize: number,
  ) {
    const skipCount = (page - 1) * pageSize;

    const condition: Record<string, any> = {};

    if (username) {
      condition.username = Like(`%${username}%`);
    }
    if (nickname) {
      condition.nickname = Like(`%${nickname}%`);
    }
    if (email) {
      condition.email = Like(`%${email}%`);
    }

    const [users, totalCount] = await this.userRepository.findAndCount({
      select: [
        'id',
        'username',
        'nickname',
        'email',
        'phoneNumber',
        'isFrozen',
        'headPic',
        'createTime',
      ],
      skip: skipCount,
      take: pageSize,
      where: condition,
    });

    return {
      users,
      totalCount,
    };
  }
}
