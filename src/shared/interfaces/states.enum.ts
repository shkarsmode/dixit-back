export enum States {
    NotStarted = 'notstarted',
    Pending = 'pending',
    WaitForHeader = 'waitforheader',
    ChooseCard = 'choosecard',
    WaitForTheOthersVotes = 'waitfortheothersvotes',
    ChooseCardAsHeader = 'choosecardasheader',
    ShowCardsForHeader = 'showcards',
    ShowCardsAndVoting = 'voting',
    Results = 'results',
}