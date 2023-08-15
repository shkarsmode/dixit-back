import { Module } from '@nestjs/common';
import { GameGateway } from './game/game.gateway';
import { RoomsGateway } from './rooms/rooms.gateway';
import { DatabaseService } from './shared/services/database.service';
import { GameService } from './shared/services/game.service';
import { RoomsService } from './shared/services/rooms.service';

@Module({
    imports: [],
    controllers: [],
    providers: [
        RoomsGateway, 
        GameGateway, 
        RoomsService, 
        GameService,
        DatabaseService
    ],
})
export class AppModule {}
