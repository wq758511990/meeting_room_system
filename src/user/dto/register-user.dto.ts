import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty({
    message: '用户名不能为空',
  })
  @ApiProperty()
  username: string;

  @IsNotEmpty({
    message: '昵称不能为空',
  })
  nickname: string;

  @IsNotEmpty({
    message: '密码不能为空',
  })
  @MinLength(6, {
    message: '密码长度不能小于6位',
  })
  password: string;

  @IsEmail(
    {},
    {
      message: '邮箱格式不合法',
    },
  )
  email: string;

  @IsNotEmpty({
    message: '验证码不能为空',
  })
  captcha: string;
}
