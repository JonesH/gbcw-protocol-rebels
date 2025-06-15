import { evaluateCredibility } from './credibility.js';

describe('Question Evaluation', () => {
    test('t1', async () => {
        const result = await evaluateCredibility('Is Bitcoin price increasing?');
        expect(typeof result).toBe('boolean');
    });

    test('t2', async () => {
        const result = await evaluateCredibility('Will aliens visit Earth next week?');
        expect(typeof result).toBe('boolean');
    });

    test('t3', async () => {
        await expect(evaluateCredibility('')).rejects.toThrow();
    });
}); 