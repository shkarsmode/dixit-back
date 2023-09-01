import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { DatabaseService } from './database.service';

@Injectable()
export class UserService {

	
	constructor(
		private db: DatabaseService,
	) {}

	
	/**
    * Handles the event of a new client connecting to the WebSocket.
    *
    * @param client - The socket object of the newly connected client.
    * @param roomCode - The code of the room to find user
    * @param userName - The new name of the user
    */
    public changeUserName(client: Socket, roomCode: string, username: string): void {
        const users = this.db.rooms.get(roomCode);
        const user = users.find(user => user.clientIds.some(clientId => clientId === client.id));
        if (!user) return;

        user.username = username;
        this.db.setRoom(roomCode, users);
    }

}
