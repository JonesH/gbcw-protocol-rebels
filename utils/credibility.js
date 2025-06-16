import { OpenAI } from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config();

// Initialize OpenAI client with proper error handling
let openai;
try {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  if (!openai || !openai.chat || !openai.chat.completions) {
    throw new Error("OpenAI client not properly initialized");
  }
  console.log("OpenAI client initialized successfully");
} catch (error) {
  console.error("Failed to initialize OpenAI client:", error.message);
  throw new Error(`Failed to initialize OpenAI client: ${error.message}`);
}

/**
 * Evaluates a yes/no question by analyzing web search results
 * @param {string} question - The yes/no question to evaluate
 * @returns {Promise<{question: string, sources: Array<{title: string, url: string}>, answer: boolean}>} Object containing question, sources, and answer
 */
export async function evaluateCredibility(question) {
  console.log("Starting credibility evaluation for question:", question);

  if (!openai) {
    console.error(
      "OpenAI client not initialized when evaluateCredibility was called",
    );
    throw new Error("OpenAI client not initialized");
  }

  if (!question || question.trim() === "") {
    console.error("Empty question provided to evaluateCredibility");
    throw new Error("Question cannot be empty");
  }

  try {
    console.log("Searching web for relevant information...");

    // Use web search to get real-time information
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-search-preview",
      web_search_options: {
        search_context_size: "high", // Use high context for more accurate results
      },
      messages: [
        {
          role: "user",
          content: `Based on the most recent information from the web, answer this yes/no question: "${question}".
                Focus on finding the most recent and reliable sources.
                For price-related questions, prioritize the most recent price information.
                Include specific price information in your response.

                REQUIRED: You MUST include at least 2-3 reliable sources with their URLs.
                Format your response exactly as follows:
                Answer: [yes/no]
                Current price: [price]
                Sources:
                - [source name](url)
                - [source name](url)
                - [source name](url)

                Make sure to use proper markdown link format [source name](url) for each source.
                Do not skip the Sources section.`,
        },
      ],
    });

    if (!completion?.choices?.[0]?.message?.content) {
      console.error("Invalid response from OpenAI");
      throw new Error("Invalid response from OpenAI");
    }

    const answer = completion.choices[0].message.content.trim().toLowerCase();
    console.log("Web search analysis complete. Full response:");
    console.log(completion.choices[0].message.content);

    // Extract sources from markdown links in the response
    const sources = [];
    const sourceRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while (
      (match = sourceRegex.exec(completion.choices[0].message.content)) !== null
    ) {
      sources.push({
        title: match[1],
        url: match[2],
      });
    }

    // If no sources were found in markdown format, try to extract URLs directly
    if (sources.length === 0) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      while (
        (match = urlRegex.exec(completion.choices[0].message.content)) !== null
      ) {
        sources.push({
          title: "Source",
          url: match[1],
        });
      }
    }

    // If still no sources found, add a default source
    if (sources.length === 0) {
      sources.push({
        title: "Web Search Results",
        url: "https://www.google.com/search?q=" + encodeURIComponent(question),
      });
    }

    // Extract the answer from the response
    const firstSentence = answer.split(".")[0].toLowerCase();
    let isYes = false;

    if (firstSentence.includes("yes") || firstSentence.includes("no")) {
      isYes = firstSentence.includes("yes");
    } else {
      // Check for price-based determination
      const pricePhraseMatch = answer.match(/the price is ([\d,\.]+)/i);
      if (pricePhraseMatch) {
        const currentPrice = parseFloat(pricePhraseMatch[1].replace(/,/g, ""));
        isYes = currentPrice > 50000;
      } else {
        // Check for explicit price comparisons
        isYes =
          answer.includes("above $50,000") ||
          answer.includes("over $50,000") ||
          answer.includes("trading above $50,000") ||
          firstSentence.includes("trading above");
      }
    }

    return {
      question,
      sources,
      answer: isYes,
    };
  } catch (error) {
    console.error("Error in question evaluation:", error);
    if (error.response) {
      console.error("API Response:", await error.response.text());
    }
    throw new Error(`Failed to evaluate question: ${error.message}`);
  }
}

/**
 * Extracts sources from OpenAI response with markdown links
 * @param {string} content - Response content
 * @returns {Array<{title: string, url: string}>} Extracted sources
 */
function extractSourcesFromResponse(content) {
  const sources = [];
  const sourceRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = sourceRegex.exec(content)) !== null) {
    sources.push({
      title: match[1],
      url: match[2],
    });
  }

  // If no markdown sources found, try to extract URLs directly
  if (sources.length === 0) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    while ((match = urlRegex.exec(content)) !== null) {
      sources.push({
        title: "Source",
        url: match[1],
      });
    }
  }

  return sources;
}

/**
 * Refutes a previous evaluation by finding counter-evidence
 * @param {Object} originalData - Original evaluation data {question, answer, sources}
 * @returns {Promise<{originalQuestion: string, originalAnswer: boolean, refuteAnswer: boolean, sources: Array, originalSourceCount: number, refuteSourceCount: number}>}
 */
export async function refute(originalData) {
  console.log("Starting refutation for original data:", originalData);

  if (!openai) {
    console.error("OpenAI client not initialized when refute was called");
    throw new Error("OpenAI client not initialized");
  }

  if (!originalData || !originalData.question) {
    console.error("Invalid original data provided to refute");
    throw new Error("Original evaluation data is required");
  }

  try {
    // Extract original question, answer, and sources from provided data
    const {
      question: originalQuestion,
      answer: originalAnswer,
      sources: originalSources = [],
    } = originalData;

    const originalSourceCount = originalSources.length;
    const minimumRequiredSources = originalSourceCount + 1;

    console.log(`Original evaluation: ${originalAnswer ? "YES" : "NO"}`);
    console.log(`Original sources: ${originalSourceCount}`);
    console.log(
      `Minimum required sources for refutation: ${minimumRequiredSources}`,
    );

    // Generate opposite stance prompt
    const refutePrompt = `Find evidence to REFUTE the following claim: "${originalQuestion}".
    The original evaluation concluded: ${originalAnswer ? "YES" : "NO"}.

    Your task is to find evidence supporting the OPPOSITE conclusion (${originalAnswer ? "NO" : "YES"}).
    You MUST find MORE than ${originalSourceCount} reliable sources.
    Minimum required sources: ${minimumRequiredSources}

    Search for recent contradictory evidence, alternative perspectives, counter-arguments, and opposing viewpoints.
    Focus on finding the most credible sources that challenge the original conclusion.

    REQUIRED: You MUST include at least ${minimumRequiredSources} reliable sources with their URLs.
    Format your response exactly as follows:
    Answer: [yes/no] (opposite of original)
    Refutation summary: [brief explanation]
    Sources:
    - [source name](url)
    - [source name](url)
    - [source name](url)
    [continue with more sources]

    Make sure to use proper markdown link format [source name](url) for each source.
    Do not skip the Sources section.`;

    console.log("Searching for refutation evidence...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      web_search_options: {
        search_context_size: "high",
      },
      messages: [
        {
          role: "user",
          content: refutePrompt,
        },
      ],
    });

    if (!completion?.choices?.[0]?.message?.content) {
      console.error("Invalid response from OpenAI for refutation");
      throw new Error("Invalid response from OpenAI");
    }

    const refutationContent = completion.choices[0].message.content;
    console.log("Refutation analysis complete. Full response:");
    console.log(refutationContent);

    // Extract sources and validate count exceeds original
    const refuteSources = extractSourcesFromResponse(refutationContent);
    const refuteAnswer = refuteSources.length > originalSourceCount;
    if (refuteAnswer) {
      console.log(
        `Successfully found ${refuteSources.length} sources for refutation (required: ${minimumRequiredSources})`,
      );
    }

    return {
      originalQuestion,
      originalAnswer,
      refuteAnswer,
      sources: refuteSources,
      originalSourceCount,
      refuteSourceCount: refuteSources.length,
    };
  } catch (error) {
    console.error("Error in refutation:", error);
    if (error.response) {
      console.error("API Response:", await error.response.text());
    }
    throw new Error(`Failed to refute evaluation: ${error.message}`);
  }
}
