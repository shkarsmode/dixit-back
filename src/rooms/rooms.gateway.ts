import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { IUser } from 'src/shared/interfaces/IUser';
import { GameService } from 'src/shared/services/game.service';
import { RoomsService } from 'src/shared/services/rooms.service';
import { Deck } from 'src/shared/utils/deck';

@WebSocketGateway()
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    public server: Server;

    // private rooms: Map<string, Set<string>> = new Map();
    private rooms: Map<string, IUser[]> = new Map();
    private roomDecks = new Map<string, Deck>();

    // roomCode: clientid, username
    // private users: Map<string, Set<string>> = new Map(); 
    // private usersScore: Map<string, number> = new Map();

    // client.id, card
    private votedCards: Map<string, any> = new Map();

    // card, client.id, isHeader
    private cardsOnTheDesk: Map<string, Set<[string, string, string]>> = new Map();

    constructor(
        private readonly roomsService: RoomsService,
        private readonly gameService: GameService
    ) {}

    /**
    * Handles the event of a new client connecting to the WebSocket
    */
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

    // * Game

    @SubscribeMessage('startGame')
    public startGame(_: Socket, roomCode: string): void {
        this.gameService.start(roomCode, this.server);
    }

    // private emitUsersToFrontEnd(roomCode: string): void {
    //     const users = this.rooms.get(roomCode);
    //     console.log('users', users);
        
    //     this.server.to(roomCode).emit('users', users);
    // }

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
        const deck = this.roomDecks.get(roomCode);
        deck.discardCards(discardedCards);

    }

    // * Room functions

    public addUserToRoom(roomCode: string, user: IUser): void {
        const users = this.rooms.get(roomCode) || [];
        
        // Check on an existing user and send him message to close the tab
        const existingUser = users.find(u => u.id === user.id);
        if (existingUser) {
            existingUser.clientIds.push(...user.clientIds);
            existingUser.clientIds.forEach((clientId: string, index: number) => {
                if (index === 0) return;

                this.server.to(clientId).emit('isTabAlreadyOpened');
            });
            
            return;
        }
        
        const colors = [
            "red", 
            "blue", 
            "green", 
            "yellow", 
            "orange", 
            "purple", 
            "pink", 
            "brown", 
            "gray", 
            "black"
        ];
        
        // Generates a random color that does not repeat for each user
        const getRandomColor = (): string => {
            const availableColors = colors.filter(color => !users.some(u => u.color === color));
            if (availableColors.length === 0) {
                return ""; // All colors are already sold
            }

            return availableColors[Math.floor(Math.random() * availableColors.length)];
        };
        
        // Adding a random color to the user
        user.color = getRandomColor();
        if (!user.color) {
            return;
        }
        
        users.push(user);

        if (users.length === 1) {
            users[0].isHeader = true;
        }

        this.rooms.set(roomCode, users);
    }

    // Delete a user from the room
    public removeUserFromRoom(roomCode: string, clientId: string): void {
        const users = this.rooms.get(roomCode);
        if (users) {
            users.forEach((user: IUser, index: number) => {
                user.clientIds = user.clientIds.filter(id => id !== clientId);
                if (user.clientIds.length === 0) {
                    users.splice(index, 1);

                    if (users.length === 0) {
                        this.rooms.delete(roomCode);
                    }
                }
            });
        }
    }

    public handleDisconnect(client: Socket) {
        this.roomsService.disconnect(client);
    }
}