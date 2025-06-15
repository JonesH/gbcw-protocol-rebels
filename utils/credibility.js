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
 * @returns {Promise<boolean>} True for yes, false for no
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

        // Log the citations if available
        console.log('\nResponse metadata:', JSON.stringify(completion.choices[0].message, null, 2));
        
        if (completion.choices[0].message.annotations && completion.choices[0].message.annotations.length > 0) {
            console.log('\nSources used:');
            completion.choices[0].message.annotations.forEach((annotation, index) => {
                if (annotation.type === 'url_citation') {
                    console.log(`\nSource ${index + 1}:`);
                    console.log(`Title: ${annotation.url_citation.title}`);
                    console.log(`URL: ${annotation.url_citation.url}`);
                    console.log(`Content range: ${annotation.url_citation.start_index} to ${annotation.url_citation.end_index}`);
                }
            });
        } else {
            console.log('\nNo source annotations found in the response');
            console.log('Available message properties:', Object.keys(completion.choices[0].message));
        }

        // Extract the answer from the response
        // First try to find explicit "yes" or "no" in the first sentence
        const firstSentence = answer.split('.')[0].toLowerCase();
        if (firstSentence.includes('yes') || firstSentence.includes('no')) {
            console.log('Found explicit yes/no in first sentence:', firstSentence);
            return firstSentence.includes('yes');
        }

        // Improved price extraction: look for 'the price is' or similar
        let currentPrice = null;
        const pricePhraseMatch = answer.match(/the price is ([\d,\.]+)/i);
        if (pricePhraseMatch) {
            currentPrice = parseFloat(pricePhraseMatch[1].replace(/,/g, ''));
            console.log('Found current price from phrase:', currentPrice);
        } else {
            // Fallback: extract all numbers and pick the largest (likely the current price)
            const allNumbers = Array.from(answer.matchAll(/([\d,]+(?:\.\d+)?)/g)).map(m => parseFloat(m[1].replace(/,/g, '')));
            if (allNumbers.length > 0) {
                currentPrice = Math.max(...allNumbers);
                console.log('Fallback: picked largest number as current price:', currentPrice);
            }
        }
        if (currentPrice !== null && !isNaN(currentPrice)) {
            return currentPrice > 50000;
        }

        // If we can't determine from price, look for any indication in the text
        console.log('Falling back to text analysis');
        const hasPriceAbove = answer.includes('above $50,000') || 
                             answer.includes('over $50,000') || 
                             answer.includes('trading above $50,000');
        
        if (hasPriceAbove) {
            console.log('Found explicit price comparison in text');
            return true;
        }

        // If all else fails, check if the first sentence contains "trading above"
        return firstSentence.includes('trading above');

    } catch (error) {
        console.error('Error in question evaluation:', error);
        if (error.response) {
            console.error('API Response:', await error.response.text());
        }
        throw new Error(`Failed to evaluate question: ${error.message}`);
    }
} 