export interface IUser {
    id: string;
    clientIds: string[];
    color?: string;
    isHeader: boolean;
    score: number;
    hand: string[];
    username: string;
    isReadyToNextRound: boolean;
}