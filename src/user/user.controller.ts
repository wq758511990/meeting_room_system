import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequireLogin, UserInfo } from 'src/custom.decorator';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { generateParseIntPipe } from 'src/util';
import { AddressValidationDto } from './dto/address.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { UpdateUserPasswordDto } from './dto/udate-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';
import { UserDetailVo } from './vo/user-info.vo';

@ApiTags('用户管理模块')
@Controller('user')
export class UserController {
  @Inject(JwtService)
  private jwtService: JwtService;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(EmailService)
  private emailService: EmailService;

  constructor(private readonly userService: UserService) {}

  @ApiBody({ type: RegisterUserDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '验证码已失效/验证码不正确/用户已存在',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '注册成功/失败',
    type: String,
  })
  @Post('register')
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser);
  }

  @ApiQuery({
    name: 'address',
    type: String,
    description: '邮箱地址',
    required: true,
    example: 'xxx@xx.com',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '发送成功',
    type: String,
  })
  @Get('register-captcha')
  async captcha(@Query() query: AddressValidationDto) {
    const { address } = query;
    return this.userService.sendCaptcha(address);
  }

  @Post('login')
  async userLogin(@Body() loginUser: LoginUserDto) {
    const userVo = await this.userService.login(loginUser);

    const { id, username, roles, permissions } = userVo.userInfo;
    const { accessToken, refreshToken } = this.userService.getJwtToken(
      id,
      username,
      roles,
      permissions,
    );
    userVo.accessToken = accessToken;

    userVo.refreshToken = refreshToken;

    return userVo;
  }

  @Post('admin/login')
  async adminLogin(@Body() loginUser: LoginUserDto) {
    const userVo = await this.userService.login(loginUser, true);
    const { id, username, roles, permissions } = userVo.userInfo;
    const { accessToken, refreshToken } = this.userService.getJwtToken(
      id,
      username,
      roles,
      permissions,
    );

    userVo.accessToken = accessToken;

    userVo.refreshToken = refreshToken;
    return userVo;
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') token: string) {
    const { accessToken, refreshToken } =
      await this.userService.getRefreshedToken(token, false);
    return {
      accessToken,
      refreshToken,
    };
  }

  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') token: string) {
    const { accessToken, refreshToken } =
      await this.userService.getRefreshedToken(token, true);
    return {
      accessToken,
      refreshToken,
    };
  }

  @Get('info')
  @RequireLogin()
  async info(@UserInfo('userId') userId: number) {
    const user = await this.userService.findUserDetailById(userId);

    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.email = user.email;
    vo.username = user.username;
    vo.headPic = user.headPic;
    vo.phoneNumber = user.phoneNumber;
    vo.nickName = user.nickname;
    vo.createTime = user.createTime;
    vo.isFrozen = user.isFrozen;

    return vo;
  }

  @Post(['update_password', 'admin/update_password'])
  @RequireLogin()
  async updatePassword(
    @UserInfo('userId') userId: number,
    @Body() passwordDto: UpdateUserPasswordDto,
  ) {
    return await this.userService.updatePassword(userId, passwordDto);
  }

  @Get('update_password/captcha')
  async updatePasswordCaptcha(@Query() query: AddressValidationDto) {
    await this.sendEmail(
      query.address,
      `update_password_captcha_${query.address}`,
      '修改密码验证码',
    );
    return '发送成功';
  }

  @Post(['update', 'admin/update'])
  @RequireLogin()
  async update(
    @UserInfo('userId') userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.update(userId, updateUserDto);
  }

  @Get('update_user/captcha')
  async updateUserCaptcha(@Query() query: AddressValidationDto) {
    await this.sendEmail(
      query.address,
      `update_user_captcha_${query.address}`,
      '修改用户信息验证码',
    );
    return '发送成功';
  }

  async sendEmail(address: string, redisKey: string, desc: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(redisKey, code, 10 * 60);

    await this.emailService.sendMail({
      to: address,
      subject: desc,
      html: `<p>您的${desc}是：${code}</p>`,
    });
    return '发送成功';
  }

  @Get('freeze')
  async freeze(@Query('id') userId: number) {
    await this.userService.freezeUserById(userId);
    return 'success';
  }

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
    @Query('nickname') nickname: string,
    @Query('email') email: string,
  ) {
    return await this.userService.findUsersByPage(
      username,
      nickname,
      email,
      pageNo,
      pageSize,
    );
  }
}
