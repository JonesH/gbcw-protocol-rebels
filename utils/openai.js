const { Configuration, OpenAIApi } = require('openai');

if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
}

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

/**
 * Makes a simple completion request to OpenAI API
 * @param {string} prompt - The prompt to send to OpenAI
 * @param {Object} options - Additional options for the completion
 * @returns {Promise<Object>} The completion response
 */
async function getCompletion(prompt, options = {}) {
    try {
        const completion = await openai.createCompletion({
            model: options.model || "text-davinci-003",
            prompt: prompt,
            max_tokens: options.max_tokens || 150,
            temperature: options.temperature || 0.7,
            ...options
        });

        return completion.data;
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        throw error;
    }
}

module.exports = {
    getCompletion
};
