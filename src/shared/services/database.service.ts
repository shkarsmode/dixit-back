import { Injectable } from '@nestjs/common';
import { IUser } from '../interfaces/IUser';
import { Deck } from '../utils/deck';

@Injectable()
export class DatabaseService {
	private readonly db_rooms: Map<string, IUser[]> = new Map();
	private readonly db_roomsAssociations: Map<string, string> = new Map();
    private readonly db_roomDecks: Map<string, Deck> = new Map<string, Deck>();
												   // card, client.id, isHeader
    private readonly db_cardsOnTheDesk: Map<string, Set<[string, string, string]>> = new Map();
	private readonly db_votedCards: Map<string, any> = new Map();

	public get rooms(): Map<string, IUser[]> {
		return this.db_rooms;
	}

	public get roomsAssociation(): Map<string, string> {
		return this.db_roomsAssociations;
	}

	public get roomDecks(): Map<string, Deck> {
		return this.db_roomDecks;
	}

	public get cardsOnTheDesk():  Map<string, Set<[string, string, string]>> {
		return this.db_cardsOnTheDesk;
	}

	public get votedCards(): Map<string, any> {
		return this.db_votedCards;
	}

	public setRoomsAssociation(roomCode: string, association: string): void {
		this.db_roomsAssociations.set(roomCode, association);
	}

	public setRoomsDecks(roomCode: string, deck: Deck): void {
		this.db_roomDecks.set(roomCode, deck);
	}

	public setRoom(roomCode: string, users: IUser[]): void {
		this.db_rooms.set(roomCode, users);
	}

	public setCardsOnTheDesk(roomCode: string, cards: Set<[string, string, string]>): void {
		this.db_cardsOnTheDesk.set(roomCode, cards);
	}

	public setVotedCards(roomCode: string, votes: any): void {
		this.db_votedCards.set(roomCode, votes);
	}

	public deleteRoom(roomCode: string): void {
		this.db_rooms.delete(roomCode);
	}
}
