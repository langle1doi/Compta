import { Module } from '@nestjs/common';
import { InvitationsPublicController } from './invitations-public.controller';
import { InvitationsService } from './invitations.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, InvitationsPublicController],
  providers: [UsersService, InvitationsService],
  exports: [InvitationsService],
})
export class UsersModule {}
