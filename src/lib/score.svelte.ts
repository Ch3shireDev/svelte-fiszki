

class ScoreService {
    correct = $state(0);
    wrong = $state(0);
    total = $state(0);

    answered = $derived(this.correct + this.wrong);

    record = (isCorrect: boolean, value: number) => {

        if (isCorrect) this.correct += value;
        else this.wrong += value;
    };

    reset = (total = this.total) => {
        this.correct = 0;
        this.wrong = 0;
        this.total = total;
    };
}

export const score = new ScoreService();