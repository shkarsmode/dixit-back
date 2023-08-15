import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from 'src/shared/services/game.service';
import { RoomsService } from 'src/shared/services/rooms.service';

@WebSocketGateway()
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    public server: Server;

    constructor(
        private readonly roomsService: RoomsService,
        private readonly gameService: GameService
    ) {}


    public handleConnection(client: Socket): void {
        this.roomsService.connect(client);
    }

    @SubscribeMessage('createRoom')
    public createRoom(client: Socket, roomCode: string): void {
        this.roomsService.create(client, roomCode);
    }

    @SubscribeMessage('joinRoom')
    public joinRoom(client: Socket, roomCode: string): boolean {
        return this.roomsService.join(client, roomCode, this.server);
    }

    @SubscribeMessage('leaveRoom')
    public leaveRoom(client: Socket, roomCode: string): void {
        this.roomsService.leave(client, roomCode, this.server);
    }

    
    // *     Game functions     * //

    @SubscribeMessage('startGame')
    public startGame(_: Socket, roomCode: string): void {
        this.gameService.start(roomCode, this.server);
    }

    @SubscribeMessage('chooseCardAsAHeader')
    public chooseCardAsAHeader(
        client: Socket, 
        [roomCode, card, association]: Array<string>
    ): void {
        this.gameService.chooseCardAsAHeader(client, [roomCode, card, association], this.server);
    }

    @SubscribeMessage('chooseCardAsAUser')
    public chooseCardAsAUser(
        client: Socket, 
        [roomCode, card]: Array<string>
    ): void {
        this.gameService.chooseCardAsAUser(client, [roomCode, card], this.server);
    }

    @SubscribeMessage('voteForTheCard')
    public voteForTheCard(
        client: Socket,
        [roomCode, card]: Array<string>
    ): void {
        this.gameService.voteForTheCard(client, [roomCode, card], this.server);
    }

    @SubscribeMessage('moveToNextRound')
    public moveToNextRound(client: Socket, roomCode: string): void {
        this.gameService.moveToNextRound(client, roomCode, this.server);
    }

    @SubscribeMessage('discardCards')
    public discardCards(_: Socket, roomCode: string, discardedCards: string[]): void {
        this.gameService.discardCards(roomCode, discardedCards);
    }

    public handleDisconnect(client: Socket) {
        this.roomsService.disconnect(client);
    }
}