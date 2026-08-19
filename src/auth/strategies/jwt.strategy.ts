import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {


    constructor(
        private configService: ConfigService
    ) {

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

            ignoreExpiration: false,

            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),

            issuer: configService.getOrThrow<string>('JWT_ISSUER'),

            audience: configService.getOrThrow<string>('JWT_AUDIENCE'),
        });

    }



    async validate(payload: any) {

        console.log("JWT PAYLOAD RECEIVED:", payload);

        return {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
        };

    }

}