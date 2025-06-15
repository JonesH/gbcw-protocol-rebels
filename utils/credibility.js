import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
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
    console.log('OpenAI client initialized successfully');
} catch (error) {
    console.error('Failed to initialize OpenAI client:', error.message);
    throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
}

/**
 * Gets current Bitcoin price from CoinGecko
 * @returns {Promise<number>} Current Bitcoin price in USD
 */
async function getBitcoinPrice() {
    try {
        console.log('Fetching Bitcoin price from CoinGecko...');
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        console.log('CoinGecko API response:', JSON.stringify(data, null, 2));
        
        if (!data || !data.bitcoin || typeof data.bitcoin.usd !== 'number') {
            console.error('Invalid response format from CoinGecko:', data);
            throw new Error('Invalid response format from CoinGecko API');
        }
        
        const price = data.bitcoin.usd;
        console.log('Successfully fetched Bitcoin price:', price);
        return price;
    } catch (error) {
        console.error('Error fetching Bitcoin price:', error);
        if (error.response) {
            console.error('API Response:', await error.response.text());
        }
        throw new Error(`Failed to fetch Bitcoin price: ${error.message}`);
    }
}

/**
 * Evaluates a yes/no question by analyzing web search results
 * @param {string} question - The yes/no question to evaluate
 * @returns {Promise<{question: string, sources: Array<{title: string, url: string}>, answer: boolean}>} Object containing question, sources, and answer
 */
export async function evaluateCredibility(question) {
    console.log('Starting credibility evaluation for question:', question);

    if (!openai) {
        console.error('OpenAI client not initialized when evaluateCredibility was called');
        throw new Error('OpenAI client not initialized');
    }

    if (!question || question.trim() === '') {
        console.error('Empty question provided to evaluateCredibility');
        throw new Error('Question cannot be empty');
    }

    try {
        console.log('Searching web for relevant information...');
        
        // Use web search to get real-time information
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-search-preview",
            web_search_options: {
                search_context_size: "high", // Use high context for more accurate results
            },
            messages: [{
                role: "user",
                content: `Based on the most recent information from the web, answer this yes/no question: "${question}". 
                Focus on finding the most recent and reliable sources. 
                For price-related questions, prioritize the most recent price information.
                Include specific price information in your response.
                IMPORTANT: Include the source URLs in your response using markdown links.
                Format your response as:
                Answer: [yes/no]
                Current price: [price]
                Sources:
                - [source name](url)
                - [source name](url)
                
                Make sure to include at least 2-3 reliable sources with their URLs.`
            }],
        });

        if (!completion?.choices?.[0]?.message?.content) {
            console.error('Invalid response from OpenAI');
            throw new Error('Invalid response from OpenAI');
        }

        const answer = completion.choices[0].message.content.trim().toLowerCase();
        console.log('Web search analysis complete. Full response:');
        console.log(completion.choices[0].message.content);

        // Extract sources from annotations
        const sources = [];
        if (completion.choices[0].message.annotations) {
            completion.choices[0].message.annotations.forEach(annotation => {
                if (annotation.type === 'url_citation') {
                    sources.push({
                        title: annotation.url_citation.title,
                        url: annotation.url_citation.url
                    });
                }
            });
        }

        // Extract the answer from the response
        const firstSentence = answer.split('.')[0].toLowerCase();
        let isYes = false;

        if (firstSentence.includes('yes') || firstSentence.includes('no')) {
            isYes = firstSentence.includes('yes');
        } else {
            // Check for price-based determination
            const pricePhraseMatch = answer.match(/the price is ([\d,\.]+)/i);
            if (pricePhraseMatch) {
                const currentPrice = parseFloat(pricePhraseMatch[1].replace(/,/g, ''));
                isYes = currentPrice > 50000;
            } else {
                // Check for explicit price comparisons
                isYes = answer.includes('above $50,000') || 
                       answer.includes('over $50,000') || 
                       answer.includes('trading above $50,000') ||
                       firstSentence.includes('trading above');
            }
        }

        return {
            question,
            sources,
            answer: isYes
        };

    } catch (error) {
        console.error('Error in question evaluation:', error);
        if (error.response) {
            console.error('API Response:', await error.response.text());
        }
        throw new Error(`Failed to evaluate question: ${error.message}`);
    }
} 