import { newsAPI } from './news.js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

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
 * Evaluates a yes/no question by analyzing recent news articles
 * @param {string} question - The yes/no question to evaluate
 * @returns {Promise<boolean>} True for yes, false for no
 */
export async function evaluateCredibility(question) {
    if (!openai) {
        throw new Error('OpenAI client not initialized');
    }

    if (!question || question.trim() === '') {
        throw new Error('Question cannot be empty');
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
            return false;
        }

        // Prepare news articles for analysis
        const articlesText = newsResponse.articles.map(article => 
            `Title: ${article.title}\nDescription: ${article.description}\nSource: ${article.source.name}\n`
        ).join('\n');

        // Analyze the question using OpenAI
        const analysisPrompt = `
        Question: "${question}"
        
        Recent news articles:
        ${articlesText}
        
        Based on these news articles, answer the question with a simple yes or no.
        Consider:
        1. Are there enough recent and relevant articles?
        2. Do the sources appear reliable?
        3. Is there consensus in the reporting?
        
        Respond with only "yes" or "no".`;

        const analysisResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: analysisPrompt }],
            temperature: 0.3,
        });

        if (!analysisResponse?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response from OpenAI');
        }

        const answer = analysisResponse.choices[0].message.content.trim().toLowerCase();
        return answer === 'yes';

    } catch (error) {
        console.error('Error in question evaluation:', error);
        throw new Error(`Failed to evaluate question: ${error.message}`);
    }
} 