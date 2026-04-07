import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID') || 'GOOGLE_NOT_CONFIGURED',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || 'GOOGLE_NOT_CONFIGURED',
      callbackURL: configService.get(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3001/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const { id, name, emails } = profile;
    done(null, {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
    });
  }
}
