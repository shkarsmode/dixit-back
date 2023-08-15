import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { IUser } from '../interfaces/IUser';
import { States } from '../interfaces/states.enum';
import { Deck } from '../utils/deck';
import { DatabaseService } from './database.service';

@Injectable()
export class GameService {


	constructor(private readonly db: DatabaseService) {}


	/**
	* Starts the game in the specified room, initializing game state and distributing cards.
	*
	* @param roomCode - The code of the room where the game will start.
	* @param server - The server instance used to emit states of game.
	*/
	public start(roomCode: string, server: Server): void {
        const users = this.db.rooms.get(roomCode);

        let isFirst = true;
        users.forEach(user => {
            if (isFirst) {
                server.to(user.clientIds[0]).emit('changeState', States.ChooseCardAsHeader);
                isFirst = false;
                return;
            }

			server.to(user.clientIds[0]).emit('changeState', States.WaitForHeader);
        });

        this.emitUsersToFrontEnd(roomCode, server);
        
        const deck = new Deck();
        deck.shuffle();
        
        users.forEach(user => {
            const hand = deck.dealHand(7);
            user.hand = hand;
            server.to(user.clientIds[0]).emit('giveCards', hand);
        });

        this.db.setRoom(roomCode, users);
        this.db.setRoomsDecks(roomCode, deck);
    }


	/**
	* Handles the process of choosing a card as the header card for the game.
	*
	* @param client - The socket object of the client choosing the card.
	* @param params - An array containing [roomCode, card, association].
	* @param server - The server instance used to emit states of game.
	*/
	public chooseCardAsAHeader(
        client: Socket, 
        [roomCode, card, association]: Array<string>,
		server: Server
    ): void {

        const users = this.db.rooms.get(roomCode);
        const user = users.filter(user => user.clientIds[0] === client.id)[0];
        user.hand = user.hand.filter(card => card !== card);

        users.forEach(user => {
            server.to(user.clientIds[0]).emit('association', association);
            server.to(user.clientIds[0]).emit('cardForTheDesk', card);
            
            if (client.id !== user.clientIds[0]) {
                server.to(user.clientIds[0]).emit('changeState', States.ChooseCard);
            }
        });

        const deck = this.db.roomDecks.get(roomCode);
        deck.discardCards([card]);

        const cards = new Set<[string, string, string]>().add([card, client.id, 'header']);
        this.db.cardsOnTheDesk.set(roomCode, cards);
    }


	/**
	* Handles the process of a user choosing a card to play.
	*
	* @param client - The socket object of the client choosing the card.
	* @param params - An array containing [roomCode, card].
	* @param server - The server instance used to emit game-related events.
	*/
	public chooseCardAsAUser(
        client: Socket, 
        [roomCode, card]: Array<string>,
		server
    ): void {

        const users = this.db.rooms.get(roomCode);
        const user = users.filter(user => user.clientIds[0] === client.id)[0];
        user.hand = user.hand.filter(card => card !== card);

        users.forEach(user => {
            server.to(user.clientIds[0]).emit('cardForTheDesk', card);
        });

        const deck = this.db.roomDecks.get(roomCode);
        deck.discardCards([card]);

        const cards = this.db.cardsOnTheDesk.get(roomCode);
        cards.add([card, client.id, 'user']);
		
        console.log('cards', cards);

        if (cards.size === users.length) {
            const header = this.findAndReturnHeaderOfCard(cards);

            users.forEach(user => {
                if (header[1] === user.clientIds[0]) {
                    server.to(user.clientIds[0]).emit('changeState',  States.ShowCards);
                    return;
                }
                
                server.to(user.clientIds[0]).emit('changeState', States.Voting);
            });
        }
    }


	/**
	* Handles the process of a user voting for a card.
	*
	* @param client - The socket object of the client voting for the card.
	* @param params - An array containing [roomCode, card].
	* @param server - The server instance used to emit game-related events.
	*/
	public voteForTheCard(
        client: Socket,
        [roomCode, card]: Array<string>,
		server: Server
    ): void {

        const users = this.db.rooms.get(roomCode);
        // * show 'ready to choose' in the view
        // users.forEach(user => {
        //     this.server.to(user).emit('voteForTheCard', card);
        // });

        const votedCards = this.db.votedCards.get(roomCode);

        if (votedCards) {
            votedCards.set(client.id, card);
        } else {
            const userVotes = card;
            const votes = new Map().set(client.id, userVotes);
            this.db.setVotedCards(roomCode, votes);
        }

        const allVotedUsers = this.db.votedCards.get(roomCode);

        if (users.length === allVotedUsers.size + 1) {
            const cards = this.db.cardsOnTheDesk.get(roomCode);
            const scores = this.getCountScoreForEveryOne(allVotedUsers, cards, users);

            users.forEach(user => {
                user.score += scores[user.clientIds[0]];
            });

            this.emitUsersToFrontEnd(roomCode, server);
            // card, client.id, 'header'
            // client.id, card


            const votesForFront = this.getVotesForFront(Array.from(cards), allVotedUsers, users);
            console.log('votesForFront', votesForFront)

            server.to(roomCode).emit('votingResults', votesForFront);
            server.to(roomCode).emit('changeState', States.Results);
        }
    }


	/**
	* Moves the game to the next round if all users are ready
	*
	* @param client - The socket object of the client triggering the move to the next round.
	* @param roomCode - The code of the room where the game is being played.
	* @param server - The server instance used to emit game-related events.
	*/
	public moveToNextRound(
		client: Socket,
		roomCode: string,
		server: Server
	): void {
        const users = this.db.rooms.get(roomCode);

        if (!users) {
            return;
        }
    
        const userIndex = users.findIndex(user => user.clientIds[0] === client.id);
    
        if (userIndex !== -1) {
            users[userIndex].isReadyToNextRound = true;
        }
    
        const isAllUsersReady = users.every(user => user.isReadyToNextRound);

        this.db.setRoom(roomCode, users);

        if (isAllUsersReady) {
            const updatedRoomUsers = users.map(user => ({
                ...user,
                isReadyToNextRound: false,
            }));
    
            this.db.setRoom(roomCode, updatedRoomUsers);

            this.getUsersWithAnotherHeader(roomCode);
            this.giveOneMoreCardForEveryOne(roomCode, server);
            this.resetCardsWhichWasOnTheDesk(roomCode);
            this.startNextRound(roomCode, server);
        }
    }


	// *      Helper private functions      * //

	/**
	* Emits the list of users in the specified room to the frontend.
	*
	* @param roomCode - The code of the room whose users will be emitted.
	* @param server - The server instance used to emit events to the room.
	*/
	private emitUsersToFrontEnd(roomCode: string, server): void {
        const users = this.db.rooms.get(roomCode);
        console.log('users', users);
        
        server.to(roomCode).emit('users', users);
    }


	/**
	* Finds and returns the header card from the given set of cards.
	*
	* @param cards - A set of cards to search for the header card.
	* @returns The header card as an array [card, clientId, type].
	*/
	private findAndReturnHeaderOfCard(
        cards: Set<[string, string, string]>
    ): [string, string, string] {
        const toFind = 'header';
        for (const item of cards) 
            if (item[2] === toFind) return item;
    }

	/**
	* Calculates the scores for every user based on the votes and cards in the game.
	*
	* @param allVotedUsers - Map containing user votes.
	* @param cards - Set of cards on the desk.
	* @param users - Array of user objects.
	* @returns An object with user IDs as keys and their respective scores as values.
	*/
	private getCountScoreForEveryOne(
        allVotedUsers: Map<any, string>, 
        cards: Set<[string, string, string]>, 
        users: IUser[]
    ): { [key: string]: number } {
        const cardsArray = Array.from(cards);
        const headerCard = cardsArray.find(card => card[2] === 'header')[0];
        const headerId = cardsArray.find(card => card[2] === 'header')[1];

        let sumOfVotesForHeader = 0;
        for (const votes of allVotedUsers.values()) {
            if (votes === headerCard) 
                sumOfVotesForHeader++;
        }

        let headerPoints = 0;
        const userPoints = {};
        let isHeaderGet0: boolean = false;

        if (
            sumOfVotesForHeader === 0 || 
            sumOfVotesForHeader === users.length - 1
        ) {
            headerPoints = 0;
            isHeaderGet0 = true;

            for (const card of cards) {
                if (card[2] === 'user') {
                    const userId = card[1];
                    userPoints[userId] = 2;
                }
            }
        } else headerPoints = 3;
    
        for (const card of cards) {
            if (card[2] === 'user') {
                const userId = card[1];
                const userCard = card[0];
                const userVote = allVotedUsers.get(userId);

                let userCardPoints = 0;
                if (!isHeaderGet0) {
                    userCardPoints += userVote === headerCard ? 3 : 0;
                }
                
        
                for (const card of allVotedUsers.values()) {
                    userCardPoints += userCard === card ? 1 : 0;
                }

                userPoints[userId] = userCardPoints + (userPoints[userId] || 0);
            }
        }

        userPoints[headerId] = headerPoints;

        return userPoints;
    }


	/**
	* Prepares votes data for frontend display.
	*
	* @param cardsArray - Array of cards on the desk.
	* @param allVotedUsers - Map containing user votes.
	* @param users - Array of user objects.
	* @returns An array of vote information objects for each card.
	*/
	private getVotesForFront(
        cardsArray,
        allVotedUsers,
        users
    ): Array<{ card: string, votes: string[], isHeaderCard: boolean }> {
        const usersVotes: Array<{ userColor: string, vote: string }> = [];
        for (const userVote of allVotedUsers.keys()) {
            // const userId = users.find(user => user.clientIds[0] === vote).id;
            const userColor = users.find(user => user.clientIds[0] === userVote).color;
            const vote = allVotedUsers.get(userVote);

            usersVotes.push({
                userColor, vote
            });
        }

        return cardsArray.map(card => {
            const votes: string[] = [];
            usersVotes.forEach(userVote => {
                if (userVote.vote === card[0]) {
                    votes.push(userVote.userColor);
                }
            });

            const isHeaderCard = card[2] === 'header' ? true : false; 
            return {
                card: card[0],
                votes,
                isHeaderCard
            };
        });
    }


	/**
	* Starts the next round of the game, changing user states accordingly.
	*
	* @param roomCode - The code of the room where the next round will start.
	* @param server - The server instance used to emit game-related events.
	*/
	private startNextRound(roomCode: string, server): void {
        const users = this.db.rooms.get(roomCode);

        users.forEach(user => {
            if (user.isHeader) {
                server.to(user.clientIds[0]).emit('changeState', States.ChooseCardAsHeader);
                return;
            }

            server.to(user.clientIds[0]).emit('changeState', States.WaitForHeader);
        });

        this.emitUsersToFrontEnd(roomCode, server);
    }


	/**
	* Resets the cards that were on the desk for the next round.
	*
	* @param roomCode - The code of the room where the game is being played.
	*/
	private resetCardsWhichWasOnTheDesk(roomCode): void {
        const cards = new Set<[string, string, string]>()
        this.db.setCardsOnTheDesk(roomCode, cards);

        const votes = new Map();
        this.db.setVotedCards(roomCode, votes);
    }


	/**
	* Updates the user who will be the header for the next round.
	*
	* @param roomCode - The code of the room where the game is being played.
	*/
    private getUsersWithAnotherHeader(roomCode: string): void {
        const users =  this.db.rooms.get(roomCode);
        let previousHeaderIndex = -1;

        previousHeaderIndex = users.findIndex(user => user.isHeader);

        users[previousHeaderIndex].isHeader = false;

        if (previousHeaderIndex + 1 < users.length) {
            users[previousHeaderIndex + 1].isHeader = true;
        } else {
            users[0].isHeader = true;
        }

        this.db.setRoom(roomCode, users);
    }


	/**
	* Gives one more card to every player at the start of a new round.
	*
	* @param roomCode - The code of the room where the game is being played.
	* @param server - The server instance used to emit game-related events.
	*/
    private giveOneMoreCardForEveryOne(roomCode: string, server: Server): void {
        const users =  this.db.rooms.get(roomCode);
        const deck = this.db.roomDecks.get(roomCode);

        users.forEach(user => {
            const card = deck.drawCard();
            user.hand.push(card);
            server.to(user.clientIds[0]).emit('giveOneCard', card);
        });

        this.db.setRoom(roomCode, users);
    }
}
