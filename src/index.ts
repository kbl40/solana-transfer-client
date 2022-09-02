import * as Web3 from '@solana/web3.js'
import * as spl from '@solana/spl-token'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

async function initializeKeypair(connection: Web3.Connection): Promise<Web3.Keypair> {
    if(!process.env.PRIVATE_KEY) {
        console.log("Creating .env file")
        const signer = Web3.Keypair.generate()
        fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`)
        await airdropSolIfNeeded(signer, connection)

        return signer
    }

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecret = Web3.Keypair.fromSecretKey(secretKey)
    await airdropSolIfNeeded(keypairFromSecret, connection)

    return keypairFromSecret
}

async function sendSomeSol(connection: Web3.Connection, payer: Web3.Keypair, receiver: Web3.Keypair) {
    //Create a transaction, Create an instruction for the transaction, then add instruction
    const transaction = new Web3.Transaction().add(
        Web3.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: receiver.publicKey,
            lamports: Web3.LAMPORTS_PER_SOL / 100,
        }),
    );

    const transactionSignature = await Web3.sendAndConfirmTransaction(connection, transaction, [payer])

    console.log(
        `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )

    // Display new balances
    const fromBalance = await connection.getBalance(payer.publicKey)
    console.log("New sender balance is", fromBalance / Web3.LAMPORTS_PER_SOL)

    const toBalance = await connection.getBalance(receiver.publicKey)
    console.log("New receiver balance is", toBalance / Web3.LAMPORTS_PER_SOL)
}

async function main() {
    const connection = new Web3.Connection(Web3.clusterApiUrl('devnet'))
    const from = await initializeKeypair(connection)
    console.log("From Public Key:" , from.publicKey.toBase58())

    const to = Web3.Keypair.generate()
    console.log("To Public Key", to.publicKey.toBase58())

    await sendSomeSol(connection, from, to)
}

async function airdropSolIfNeeded(signer: Web3.Keypair, connection: Web3.Connection) {
    const balance = await connection.getBalance(signer.publicKey)
    console.log("Current balance is", balance / Web3.LAMPORTS_PER_SOL)

    if (balance / Web3.LAMPORTS_PER_SOL < 0.5) {
        console.log("Airdropping 1 SOL...")
        const airdropSignature = await connection.requestAirdrop(
            signer.publicKey,
            Web3.LAMPORTS_PER_SOL
        )

        const latestBlockhash = await connection.getLatestBlockhash()

        await connection.confirmTransaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: airdropSignature
        })

        const newBalance = await connection.getBalance(signer.publicKey)
        console.log("New balance is", newBalance / Web3.LAMPORTS_PER_SOL)
    }
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
