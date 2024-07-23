import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RequireLogin, RequirePermissions, UserInfo } from './custom.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('aaa')
  @RequireLogin()
  aaa(@UserInfo('username') username: string, @UserInfo() userInfo) {
    console.log('username', username);
    console.log('userInfo', userInfo);
    return 'aaa';
  }

  @Get('bbb')
  @RequireLogin()
  @RequirePermissions('ccc')
  bbb() {
    return 'bbb';
  }
}
