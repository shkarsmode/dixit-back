export class Deck {
    private cards: string[];
    private discardedCards: string[];

    constructor() {
        this.cards = [];
        this.discardedCards = [];
        this.initializeDeck();
    }

    private initializeDeck(): void {
        for(let i = 1; i <= 115; i++) {
            this.cards.push(i.toString());
        }
    }

    public shuffle(): void {
        const cardsToShuffle = [...this.cards, ...this.discardedCards];
        for (let i = cardsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardsToShuffle[i], cardsToShuffle[j]] = [cardsToShuffle[j], cardsToShuffle[i]];
        }
        this.cards = cardsToShuffle;
        this.discardedCards = [];
    }

    public dealHand(numCards: number): string[] {
        // Логика раздачи карт
        if (numCards > this.cards.length) {
            throw new Error('Not enough cards in the deck to deal the hand.');
        }

        const hand = this.cards.slice(0, numCards);
        this.cards = this.cards.slice(numCards); // Удаляем разданные карты из колоды
        return hand;
    }

    public drawCard(): string {
      // Логика взятия одной карты из колоды
        if (this.cards.length === 0) {
            if (this.discardedCards.length === 0) {
                throw new Error('No more cards in the deck.');
            } else {
                this.shuffle(); // Перемешиваем колоду, если в основной колоде закончились карты
            }
        }

        const card = this.cards.shift(); // Извлекаем первую карту из колоды
        return card;
    }

    public discardCards(cards: string[]): void {
        // Логика отбоя карт
        this.discardedCards.push(...cards);
    }
}