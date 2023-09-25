import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { IUser } from '../interfaces/IUser';
import { States } from '../interfaces/states.enum';
import { DatabaseService } from './database.service';
import { GameService } from './game.service';

@Injectable()
export class RoomsService {

	
	constructor(
		private db: DatabaseService,
        private gameService: GameService
	) {}

	
	/**
    * Handles the event of a new client connecting to the WebSocket.
    *
    * @param client - The socket object of the newly connected client.
    */
    public connect(client: Socket, server: Server): void {
        const username = client.handshake.query.username as string;
        const id = client.handshake.query.id as string;

        server.to(client.id).emit('connectedToServer', id);
        
        console.log(`Client connected: ${client.id}, username: ${username}, id: ${id}`);
    }


	/**
	* Creates a new room and adds the client to it.
	*
	* @param client - The socket object of the client creating the room.
	* @param roomCode - The code of the room to be created.
	*/
	public create(client: Socket, roomCode: string): void {
		this.db.setRoom(roomCode, []);
        client.join(roomCode);

        console.log(`Room created: ${roomCode}`);
	}


	/**
    * Allows a client to join an existing room if it exists.
    *
    * @param client - The socket object of the client joining the room.
    * @param roomCode - The code of the room to join.
    * @returns `true` if the client successfully joins the room, otherwise `false`.
    */
	public join(client: Socket, roomCode: string, server: Server): IUser | boolean {
        if (this.db.rooms.has(roomCode)) {
            const users = this.db.rooms.get(roomCode);
            const id = client.handshake.query.id as string;
            const username = client.handshake.query.username as string;
            const userIndex = users.findIndex(user => user.id === id);

            if (userIndex !== -1) {
                if (!users[userIndex].clientIds.includes(client.id)) {
                    users[userIndex].clientIds.push(client.id);
                }
                
                this.db.setRoom(roomCode, users);

                this.sendToUserInfoAfterExitingTheRoom(roomCode, client.id, id, server);

                client.join(roomCode);
                return users[userIndex];
            }

            this.addUserToRoom(
				roomCode, 
				{
					id: id,
					clientIds: [client.id],
					score: 0,
					isHeader: false,
					hand: [],
					username,
					isReadyToNextRound: false,
                    state: States.NotStarted
				},
				server
			);

            client.join(roomCode);

            server.to(roomCode).emit('joinRoom', users.length);

            // console.log('this.usersNameById', this.usersNameById);
            console.log(`Client ${client.id} joined room: ${roomCode}`);
            const user = 
                this.db.rooms.get(roomCode)
                    .find(user => user.clientIds.some(id => id === client.id));

            return user;
        }

        return false;
    }


    /**
    * Sends to user info(scoreboard, association...) of his current state.
    *
    * @param roomCode - The code of the room.
    * @param clientId - The socket object of the client whom sent info.
    * @param userId - The user id.
    * @param server - The server instance for emitting events to the room.
    */
    private sendToUserInfoAfterExitingTheRoom(
        roomCode: string, 
        clientId: string,
        userId: string,
        server: Server
    ): void {
        const users = this.db.rooms.get(roomCode);

        const userIndex = users.findIndex(user => user.id === userId);
        const stateOfUser = users[userIndex].state;

        const updatedUsersArrayToFrontEnd = users.map(user => {
            const { clientIds, hand, ...userWithoutFields } = user;
            return userWithoutFields;
        });
        
        server.to(clientId).emit('users', updatedUsersArrayToFrontEnd);

        const cards = this.db.cardsOnTheDesk.get(roomCode);

        if (cards) {
            const cardsArray = Array.from(cards);
            cardsArray.forEach(cardOnTheDeskInfo => {
                server.to(clientId).emit('cardForTheDesk', cardOnTheDeskInfo[0]);
            });
        }

        server.to(clientId).emit('giveCards', users[userIndex].hand);
        server.to(clientId).emit('changeState', stateOfUser);

        switch(stateOfUser) {
            case States.NotStarted: {
                server.to(clientId).emit('joinRoom', users.length);
                break;
            };
            case States.ChooseCard: {
                const association = this.db.roomsAssociation.get(roomCode);
                server.to(clientId).emit('association', association);
                break;
            };
            case States.ShowCardsAndVoting: {
                const association = this.db.roomsAssociation.get(roomCode);

                const cardsOnTheDesk = this.db.cardsOnTheDesk.get(roomCode);
                const cardsOnTheDeskArr = Array.from(cardsOnTheDesk);
                const card = cardsOnTheDeskArr.find(cards => cards[1] === users[userIndex].id)[0];

                server.to(clientId).emit('myCardOnTheDesk', card);
                server.to(clientId).emit('association', association);

                const votes = this.db.votedCards.get(roomCode);
                if (!votes) return;

                const votedCard = votes.get(users[userIndex].id);

                if (!votedCard) return;

                const isHeaderCard = false;

                const userVote = [{
                    card: votedCard,
                    votes: [users[userIndex].color],
                    isHeaderCard
                }];

                server.to(clientId).emit('votingResults', userVote);

                break;
            };
            case States.Results: {
                const allVotedUsers = this.db.votedCards.get(roomCode);
                const votesForFront = 
                    this.gameService.getVotesForFront(Array.from(cards), allVotedUsers, users);

                server.to(clientId).emit('votingResults', votesForFront);
            }
        }
    }


	/**
    * Allows a client to leave a room and updates the user count in the room.
    *
    * @param client - The socket object of the client leaving the room.
    * @param roomCode - The code of the room to leave.
    * @param server - The server instance for emitting events to the room.
    */
	public leave(client: Socket, roomCode: string, server: Server): void {
        if (!this.db.rooms.has(roomCode)) return;

        const users = this.db.rooms.get(roomCode);
        this.removeUserFromRoom(roomCode, client.id);

        client.leave(roomCode);
        server.to(roomCode).emit('joinRoom', users.length);

        if (users.length === 0) this.db.deleteRoom(roomCode);

        // console.log('rooms', this.rooms);
        console.log(`Client ${client.id} leaved room: ${roomCode}`);
    }


	//  ? Separate it like class user

	public addUserToRoom(roomCode: string, user: IUser, server: Server): void {
        const users = this.db.rooms.get(roomCode) || [];
        
        // Check on an existing user and send him message to close the tab
        const existingUser = users.find(u => u.id === user.id);
        if (existingUser) {
            existingUser.clientIds.push(...user.clientIds);
            existingUser.clientIds.forEach((clientId: string, index: number) => {
                if (index === 0) return;

                server.to(clientId).emit('isTabAlreadyOpened');
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

        this.db.setRoom(roomCode, users);
    }

	// Delete a user from the room
    public removeUserFromRoom(roomCode: string, clientId: string): void {
        const users = this.db.rooms.get(roomCode);
        if (users) {
            users.forEach((user: IUser, index: number) => {
                user.clientIds = user.clientIds.filter(id => id !== clientId);
                if (user.clientIds.length === 0) {
                    users.splice(index, 1);

                    if (users.length === 0) {
                        this.db.deleteRoom(roomCode);
                    }
                }
            });
        }
    }

	//  ? Separate it like class user

	public disconnect(client: Socket) {
        this.db.rooms.forEach((users, room) => {
            const user = users.find(user => user.clientIds.some(id => id === client.id));

            if (user) {
                user.clientIds = user.clientIds.filter(id => id !== client.id);

                if (user.clientIds.length === 0) {
                    client.leave(room);
                }
            }
        });

        console.log(this.db.rooms);

        console.log(`Client disconnected: ${client.id}`);
    }
}
