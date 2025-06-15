const { evaluateCredibility } = require('./credibility');
const { newsAPI } = require('./news');

// Only mock the NewsAPI
jest.mock('./news');

describe('evaluateCredibility', () => {
    let mockNewsResponse;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Setup mock news response
        mockNewsResponse = {
            articles: [
                {
                    title: 'Test Article 1',
                    description: 'Test Description 1',
                    source: { name: 'Test Source 1' }
                },
                {
                    title: 'Test Article 2',
                    description: 'Test Description 2',
                    source: { name: 'Test Source 2' }
                }
            ]
        };
        newsAPI.getEverything.mockResolvedValue(mockNewsResponse);
    });

    test('should demonstrate full flow with console output', async () => {
        const question = 'Is Bitcoin trading above $50,000?';

        // Mock news response with realistic data
        newsAPI.getEverything.mockResolvedValueOnce({
            articles: [
                {
                    title: 'Bitcoin Surges Past $50,000 Mark',
                    description: 'Bitcoin has broken through the $50,000 resistance level, currently trading at $51,200.',
                    source: { name: 'Financial Times' }
                },
                {
                    title: 'Crypto Market Update: BTC Above $50K',
                    description: 'Bitcoin maintains strong position above $50,000 as institutional adoption grows.',
                    source: { name: 'Bloomberg' }
                },
                {
                    title: 'Bitcoin Price Analysis: $50K Breakthrough',
                    description: 'Technical analysis shows Bitcoin\'s strong position above $50,000 with bullish indicators.',
                    source: { name: 'CoinDesk' }
                }
            ]
        });

        console.log('\n=== Credibility Evaluation Demo ===');
        console.log('\nQuestion:', question);
        
        const result = await evaluateCredibility(question);
        
        console.log('\nSources Found:');
        result.sources = mockNewsResponse.articles.map(article => ({
            title: article.title,
            source: article.source.name
        }));
        console.log(JSON.stringify(result.sources, null, 2));
        
        console.log('\nFinal Decision:');
        console.log(JSON.stringify({
            credible: result.credible,
            confidence: result.confidence,
            explanation: result.explanation
        }, null, 2));
        console.log('\n==============================\n');

        // Basic validation of the result
        expect(result).toHaveProperty('credible');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('explanation');
        expect(typeof result.credible).toBe('boolean');
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });
}); 