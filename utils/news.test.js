import { jest } from '@jest/globals';
import axios from 'axios';
import { NewsAPI } from './news.js';

// Mock axios
jest.mock('axios');

describe('NewsAPI', () => {
    let newsAPI;
    const mockApiKey = 'test-api-key';

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        newsAPI = new NewsAPI(mockApiKey);
    });

    describe('constructor', () => {
        it('should create instance with provided API key', () => {
            expect(newsAPI.apiKey).toBe(mockApiKey);
        });
    });

    describe('getEverything', () => {
        const mockResponse = {
            data: {
                status: 'ok',
                totalResults: 2,
                articles: [
                    { title: 'Test Article 1' },
                    { title: 'Test Article 2' }
                ]
            }
        };

        it('should fetch articles with default parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const result = await newsAPI.getEverything();

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/everything',
                {
                    params: {
                        q: '',
                        sources: '',
                        domains: '',
                        from: '',
                        to: '',
                        language: 'en',
                        sortBy: 'publishedAt',
                        pageSize: 20,
                        page: 1,
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should fetch articles with custom parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const options = {
                q: 'blockchain',
                language: 'en',
                sortBy: 'relevancy',
                pageSize: 10,
                page: 2
            };

            const result = await newsAPI.getEverything(options);

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/everything',
                {
                    params: {
                        ...options,
                        sources: '',
                        domains: '',
                        from: '',
                        to: '',
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('getTopHeadlines', () => {
        const mockResponse = {
            data: {
                status: 'ok',
                totalResults: 2,
                articles: [
                    { title: 'Headline 1' },
                    { title: 'Headline 2' }
                ]
            }
        };

        it('should fetch headlines with default parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const result = await newsAPI.getTopHeadlines();

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/top-headlines',
                {
                    params: {
                        country: '',
                        category: '',
                        sources: '',
                        q: '',
                        pageSize: 20,
                        page: 1,
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should fetch headlines with custom parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const options = {
                country: 'us',
                category: 'technology',
                pageSize: 5
            };

            const result = await newsAPI.getTopHeadlines(options);

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/top-headlines',
                {
                    params: {
                        ...options,
                        sources: '',
                        q: '',
                        page: 1,
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('getSources', () => {
        const mockResponse = {
            data: {
                status: 'ok',
                sources: [
                    { id: 'source1', name: 'Source 1' },
                    { id: 'source2', name: 'Source 2' }
                ]
            }
        };

        it('should fetch sources with default parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const result = await newsAPI.getSources();

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/sources',
                {
                    params: {
                        category: '',
                        language: '',
                        country: '',
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });

        it('should fetch sources with custom parameters', async () => {
            axios.get.mockResolvedValueOnce(mockResponse);

            const options = {
                category: 'technology',
                language: 'en',
                country: 'us'
            };

            const result = await newsAPI.getSources(options);

            expect(axios.get).toHaveBeenCalledWith(
                'https://newsapi.org/v2/sources',
                {
                    params: {
                        ...options,
                        apiKey: mockApiKey
                    }
                }
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe('error handling', () => {
        it('should handle API error response', async () => {
            const errorResponse = {
                response: {
                    status: 401,
                    data: {
                        message: 'Invalid API key'
                    }
                }
            };
            axios.get.mockRejectedValueOnce(errorResponse);

            await expect(newsAPI.getEverything()).rejects.toThrow('NewsAPI Error (401): Invalid API key');
        });

        it('should handle network error', async () => {
            const networkError = {
                request: {}
            };
            axios.get.mockRejectedValueOnce(networkError);

            await expect(newsAPI.getEverything()).rejects.toThrow('No response received from NewsAPI');
        });

        it('should handle other errors', async () => {
            const otherError = new Error('Unknown error');
            axios.get.mockRejectedValueOnce(otherError);

            await expect(newsAPI.getEverything()).rejects.toThrow('Error: Unknown error');
        });
    });
});
