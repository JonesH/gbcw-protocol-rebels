const axios = require('axios');
require('dotenv').config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

/**
 * NewsAPI client class for fetching news articles
 */
class NewsAPI {
    constructor(apiKey = NEWS_API_KEY) {
        if (!apiKey) {
            throw new Error('NewsAPI key is required');
        }
        this.apiKey = apiKey;
    }

    /**
     * Fetch news articles with various filtering options
     * @param {Object} options - Query options
     * @param {string} options.q - Keywords or phrase to search for
     * @param {string} options.sources - Comma-separated list of sources
     * @param {string} options.domains - Comma-separated list of domains
     * @param {string} options.from - Start date (YYYY-MM-DD)
     * @param {string} options.to - End date (YYYY-MM-DD)
     * @param {string} options.language - Language code (e.g., 'en')
     * @param {string} options.sortBy - Sort by parameter (relevancy, popularity, publishedAt)
     * @param {number} options.pageSize - Number of results per page (max 100)
     * @param {number} options.page - Page number
     * @returns {Promise<Object>} News articles and metadata
     */
    async getEverything({
        q = '',
        sources = '',
        domains = '',
        from = '',
        to = '',
        language = 'en',
        sortBy = 'publishedAt',
        pageSize = 20,
        page = 1
    } = {}) {
        try {
            const response = await axios.get(`${BASE_URL}/everything`, {
                params: {
                    q,
                    sources,
                    domains,
                    from,
                    to,
                    language,
                    sortBy,
                    pageSize,
                    page,
                    apiKey: this.apiKey
                }
            });
            return response.data;
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Get top headlines
     * @param {Object} options - Query options
     * @param {string} options.country - Country code (e.g., 'us')
     * @param {string} options.category - News category
     * @param {string} options.sources - Comma-separated list of sources
     * @param {string} options.q - Keywords or phrase
     * @param {number} options.pageSize - Number of results per page
     * @param {number} options.page - Page number
     * @returns {Promise<Object>} Top headlines and metadata
     */
    async getTopHeadlines({
        country = '',
        category = '',
        sources = '',
        q = '',
        pageSize = 20,
        page = 1
    } = {}) {
        try {
            const response = await axios.get(`${BASE_URL}/top-headlines`, {
                params: {
                    country,
                    category,
                    sources,
                    q,
                    pageSize,
                    page,
                    apiKey: this.apiKey
                }
            });
            return response.data;
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Get available news sources
     * @param {Object} options - Query options
     * @param {string} options.category - News category
     * @param {string} options.language - Language code
     * @param {string} options.country - Country code
     * @returns {Promise<Object>} Available news sources
     */
    async getSources({
        category = '',
        language = '',
        country = ''
    } = {}) {
        try {
            const response = await axios.get(`${BASE_URL}/sources`, {
                params: {
                    category,
                    language,
                    country,
                    apiKey: this.apiKey
                }
            });
            return response.data;
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Handle API errors
     * @private
     * @param {Error} error - Error object
     * @throws {Error} Formatted error message
     */
    _handleError(error) {
        if (error.response) {
            const { status, data } = error.response;
            throw new Error(`NewsAPI Error (${status}): ${data.message || 'Unknown error'}`);
        } else if (error.request) {
            throw new Error('No response received from NewsAPI');
        } else {
            throw new Error(`Error: ${error.message}`);
        }
    }
}

// Export both the class and a default instance
const newsAPI = new NewsAPI();
module.exports = {
    NewsAPI,
    newsAPI
};
