import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import { evaluateCredibility, refute } from "./utils/credibility.js";
import { signWithAgent } from "@neardefi/shade-agent-js";
import submitToEth from "./utils/eth_submit.js";

const PORT = 3000;

import { getAgentAccount } from "@neardefi/shade-agent-js";

const app = new Hono();

app.use("/*", cors());

app.get("/api/address", async (c) => {
  console.log("Fetching agent account...");
  const res = await getAgentAccount();
  console.log("Agent account fetched:", res);
  return c.json(res);
});

app.get("/api/test-sign", async (c) => {
  console.log("Testing signature...");
  const path = "foo";
  const res = await signWithAgent(path, [
    ...(await createHash("sha256").update(Buffer.from("testing"))).digest(),
  ]);
  console.log("Signature test result:", res);
  return c.json(res);
});

app.post("/api/evaluate", async (c) => {
  try {
    console.log("Received evaluation request");
    const { question } = await c.req.json();
    console.log("Question received:", question);

    if (!question) {
      console.log("Error: Question is missing");
      return c.json({ error: "Question is required" }, 400);
    }

    // Evaluate the question
    console.log("Evaluating credibility...");
    const answer = await evaluateCredibility(question);
    console.log("Credibility evaluation result:", answer);

    // Create a hash of the question and answer for blockchain
    const data = JSON.stringify({ question, answer });
    const hash = await createHash("sha256").update(Buffer.from(data)).digest();
    console.log("Generated hash:", hash.toString("hex"));

    // Submit to Ethereum blockchain
    console.log("Submitting to Ethereum blockchain...");
    const ethResult = await submitToEth({
      question,
      sources: answer.sources || [],
      answer: answer.answer,
      hash: hash.toString("hex"),
    });
    console.log("Ethereum submission result:", ethResult);

    // Return the answer, hash, and Ethereum transaction details
    const response = {
      question,
      sources: answer.sources || [],
      answer: answer.answer,
      hash: hash.toString("hex"),
      status: "evaluated",
      tx_hash: ethResult.success ? ethResult.transactionHash : null,
      explorer_url: ethResult.success
        ? `https://sepolia.etherscan.io/tx/${ethResult.transactionHash}`
        : null,
    };
    console.log("Sending response:", response);
    return c.json(response);
  } catch (error) {
    console.error("Error in /api/evaluate:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/evaluate-local", async (c) => {
  try {
    console.log("Received local evaluation request");
    const { question } = await c.req.json();
    console.log("Question received:", question);

    if (!question) {
      console.log("Error: Question is missing");
      return c.json({ error: "Question is required" }, 400);
    }

    console.log("Evaluating credibility locally...");
    const answerBool = await evaluateCredibility(question);
    console.log("Local evaluation result:", answerBool);

    // Create a hash of the question and answer for blockchain
    const data = JSON.stringify({ question, answer: answerBool });
    console.log("Data to be hashed:", data);
    const hash = await createHash("sha256").update(Buffer.from(data)).digest();
    console.log("Generated hash:", hash.toString("hex"));

    const response = {
      question,
      sources: [], // Empty sources array for local evaluation
      answer: answerBool,
      hash: hash.toString("hex"),
      status: "evaluated",
    };
    console.log("Sending response:", response);
    return c.json(response);
  } catch (error) {
    console.error("Error in /api/evaluate-local:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/refute", async (c) => {
  try {
    console.log("Received refutation request");
    const { transactionHash } = await c.req.json();
    console.log("Transaction hash received:", transactionHash);

    if (!transactionHash) {
      console.log("Error: Transaction hash is missing");
      return c.json({ error: "Transaction hash is required" }, 400);
    }

    // Refute the original evaluation
    console.log("Refuting original evaluation...");
    const refutationResult = await refute(transactionHash);
    console.log("Refutation result:", refutationResult);

    // Submit refutation to Ethereum blockchain
    console.log("Submitting refutation to Ethereum blockchain...");
    const ethResult = await submitToEth(refutationResult.refutationData);
    console.log("Ethereum refutation submission result:", ethResult);

    // Return the refutation result with blockchain details
    const response = {
      originalQuestion: refutationResult.originalQuestion,
      originalAnswer: refutationResult.originalAnswer,
      refuteAnswer: refutationResult.refuteAnswer,
      sources: refutationResult.sources,
      originalSourceCount: refutationResult.originalSourceCount,
      refuteSourceCount: refutationResult.refuteSourceCount,
      originalTransactionHash: transactionHash,
      status: "refuted",
      refutation_tx_hash: ethResult.success ? ethResult.transactionHash : null,
      refutation_explorer_url: ethResult.success
        ? `https://sepolia.etherscan.io/tx/${ethResult.transactionHash}`
        : null,
    };
    console.log("Sending refutation response:", response);
    return c.json(response);
  } catch (error) {
    console.error("Error in /api/refute:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/api/refute-local", async (c) => {
  try {
    console.log("Received local refutation request");
    const { transactionHash } = await c.req.json();
    console.log("Transaction hash received:", transactionHash);

    if (!transactionHash) {
      console.log("Error: Transaction hash is missing");
      return c.json({ error: "Transaction hash is required" }, 400);
    }

    console.log("Refuting evaluation locally...");
    const refutationResult = await refute(transactionHash);
    console.log("Local refutation result:", refutationResult);

    const response = {
      originalQuestion: refutationResult.originalQuestion,
      originalAnswer: refutationResult.originalAnswer,
      refuteAnswer: refutationResult.refuteAnswer,
      sources: refutationResult.sources,
      originalSourceCount: refutationResult.originalSourceCount,
      refuteSourceCount: refutationResult.refuteSourceCount,
      originalTransactionHash: transactionHash,
      status: "refuted-local",
    };
    console.log("Sending local refutation response:", response);
    return c.json(response);
  } catch (error) {
    console.error("Error in /api/refute-local:", error);
    console.error("Error stack:", error.stack);
    return c.json({ error: error.message }, 500);
  }
});

console.log("Server starting...");
console.log("Server listening on port:", PORT);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: "0.0.0.0",
});
