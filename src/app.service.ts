import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'This is the Finance Dashboard API. Please refer to the documentation for usage details.';
  }
}
