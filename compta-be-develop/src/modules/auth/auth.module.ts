import { forwardRef, Global, Module } from '@nestjs/common';
import { PlatformStateService } from '../platform/auth/platform-state.service';
import { PlatformModule } from '../platform/platform.module';
import { SupportAccessService } from '../platform/support/support-access.service';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginAttemptsService } from './login-attempts.service';
import { MeController } from './me.controller';
import { MfaService } from './mfa.service';
import { UserStateService } from './user-state.service';

// JwtAuthGuard is registered globally in AppModule, before PermissionGuard.
@Global()
@Module({
  imports: [forwardRef(() => PlatformModule)],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccountService,
    MfaService,
    LoginAttemptsService,
    JwtAuthGuard,
    UserStateService,
    PlatformStateService,
    SupportAccessService,
  ],
  exports: [JwtAuthGuard, UserStateService, PlatformStateService, SupportAccessService, AuthService, MfaService],
})
export class AuthModule {}
