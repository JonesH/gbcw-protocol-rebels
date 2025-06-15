const { newsAPI } = require('./news');
const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI client with proper error handling
let openai;
try {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    
    if (!openai || !openai.chat || !openai.chat.completions) {
        throw new Error('OpenAI client not properly initialized');
    }
} catch (error) {
    console.error('Failed to initialize OpenAI client:', error.message);
    throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
}

/**
 * Evaluates the credibility of a yes/no question by analyzing recent news articles
 * @param {string} question - The yes/no question to evaluate
 * @returns {Promise<Object>} Object containing credibility analysis
 */
async function evaluateCredibility(question) {
    if (!openai) {
        throw new Error('OpenAI client not initialized');
    }

    try {
        // Extract key terms from the question for news search
        const prompt = `Extract 2-3 key search terms from this yes/no question for searching news articles: "${question}"`;
        const keyTermsResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
        });
        
        if (!keyTermsResponse?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI');
        }

        const searchTerms = keyTermsResponse.choices[0].message.content.trim();
        
        // Fetch relevant news articles
        const newsResponse = await newsAPI.getEverything({
            q: searchTerms,
            language: 'en',
            sortBy: 'relevancy',
            pageSize: 5
        });

        if (!newsResponse.articles || newsResponse.articles.length === 0) {
            return {
                credible: false,
                confidence: 0,
                explanation: "No relevant news articles found to evaluate the question."
            };
        }

        // Prepare news articles for analysis
        const articlesText = newsResponse.articles.map(article => 
            `Title: ${article.title}\nDescription: ${article.description}\nSource: ${article.source.name}\n`
        ).join('\n');

        // Analyze credibility using OpenAI
        const analysisPrompt = `
        Question: "${question}"
        
        Recent news articles:
        ${articlesText}
        
        Based on these news articles, evaluate if the question can be answered with high confidence.
        Consider:
        1. Are there enough recent and relevant articles?
        2. Do the sources appear reliable?
        3. Is there consensus in the reporting?
        
        Provide a JSON response with:
        {
            "credible": boolean,
            "confidence": number (0-1),
            "explanation": string
        }`;

        const analysisResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
        });

        if (!analysisResponse?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI');
        }

        try {
            const analysis = JSON.parse(analysisResponse.choices[0].message.content);
            return analysis;
        } catch (parseError) {
            throw new Error('Invalid response format from OpenAI');
        }

    } catch (error) {
        console.error('Error in credibility evaluation:', error);
        throw new Error(`Failed to evaluate credibility: ${error.message}`);
    }
}

module.exports = {
    evaluateCredibility
}; 