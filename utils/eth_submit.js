import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const ethRpcUrl = 'https://sepolia.drpc.org';

const fetchAndDecodeTx = async (txHash, provider) => {
    try {
        console.log('Fetching transaction data...');
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            throw new Error('Transaction not found');
        }

        // Decode the data from UTF-8 bytes
        const decodedData = ethers.toUtf8String(tx.data);
        const parsedData = JSON.parse(decodedData);
        
        console.log('Decoded transaction data:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        return parsedData;
    } catch (error) {
        console.error('Error fetching/decoding transaction:', error.message);
        throw error;
    }
};

const submitToEth = async (data) => {
    let retries = 3;
    let lastError = null;
    let provider;

    while (retries > 0) {
        try {
            console.log('Initializing Ethereum connection...');
            
            // Configure Ethereum connection
            provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || ethRpcUrl);
            
            // Create wallet from seed phrase
            console.log('Creating wallet from seed phrase...');
            const mnemonic = 'chef episode cage forest decade column glare trick coil mouse ice million';
            const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider);
            
            console.log('Connected to Ethereum account:', wallet.address);

            // Prepare the data
            const messageData = {
                question: data.question,
                answer: data.answer,
                sources: data.sources || [],
                hash: data.hash
            };

            // Create the transaction
            console.log('Creating transaction...');
            const tx = {
                data: ethers.toUtf8Bytes(JSON.stringify(messageData)),
                gasLimit: 100000,
                maxFeePerGas: await provider.getFeeData().then(fee => fee.maxFeePerGas),
                maxPriorityFeePerGas: await provider.getFeeData().then(fee => fee.maxPriorityFeePerGas)
            };

            // Send the transaction
            console.log('Sending transaction...');
            const transaction = await wallet.sendTransaction(tx);
            console.log('Transaction sent:', transaction.hash);

            // Fetch and decode the transaction data
            await fetchAndDecodeTx(transaction.hash, provider);

            return {
                success: true,
                transactionHash: transaction.hash
            };
        } catch (error) {
            lastError = error;
            console.error(`Attempt failed (${retries} retries left):`, error.message);
            
            if (error.code === 'SERVER_ERROR') {
                retries--;
                if (retries > 0) {
                    console.log(`Retrying in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
            }
            
            // If it's not a server error or we're out of retries, throw the error
            throw error;
        }
    }

    // If we've exhausted all retries, return a failure response
    return {
        success: false,
        error: lastError?.message || 'Failed to submit transaction after multiple attempts',
        details: lastError
    };
};

export default submitToEth; 