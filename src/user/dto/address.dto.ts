import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddressValidationDto {
  @IsNotEmpty()
  @IsEmail()
  address: string;
}
