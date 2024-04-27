require("dotenv").config();

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import fetch from "cross-fetch";
import { AnchorProvider } from "@coral-xyz/anchor";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import Decimal from "decimal.js";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  WhirlpoolContext,
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  swapQuoteByInputToken,
  IGNORE_CACHE,
} from "@orca-so/whirlpools-sdk";
import BN from "bn.js";
import DLMM from "@meteora-ag/dlmm";
import { Wallet } from "@project-serum/anchor";

const fs = require("fs");
const wallet_json = "wallet.json";

const RPC_ENDPOINT_URL =
  "https://boldest-palpable-pallet.solana-mainnet.quiknode.pro/e0a358167e7dfda9c51aec059814b4606f444852";
// const RPC_ENDPOINT_URL = "https://api.devnet.solana.com";
const COMMITMENT = "confirmed";

const wallet = [
  [
    98, 235, 42, 79, 205, 154, 213, 79, 255, 164, 58, 140, 13, 158, 1, 250, 77,
    229, 45, 190, 131, 24, 142, 76, 111, 59, 44, 68, 149, 0, 91, 93, 160, 93,
    91, 71, 55, 152, 134, 32, 9, 231, 116, 45, 187, 100, 234, 163, 173, 108, 28,
    107, 188, 161, 90, 131, 210, 150, 192, 197, 158, 0, 179, 181,
  ],
  [
    152, 153, 244, 62, 248, 183, 159, 87, 190, 24, 90, 68, 211, 143, 204, 56,
    129, 121, 221, 146, 126, 59, 160, 25, 131, 56, 203, 46, 110, 208, 185, 47,
    224, 120, 13, 113, 225, 161, 29, 109, 74, 132, 237, 217, 161, 110, 112, 158,
    195, 33, 133, 131, 11, 129, 83, 11, 218, 230, 189, 53, 141, 90, 27, 234,
  ],
  [
    158, 185, 75, 158, 82, 214, 134, 215, 122, 198, 85, 179, 115, 69, 173, 119,
    174, 230, 160, 213, 94, 100, 223, 94, 220, 68, 124, 126, 144, 209, 8, 187,
    170, 134, 246, 211, 84, 22, 41, 209, 50, 37, 55, 174, 6, 109, 242, 167, 97,
    136, 208, 198, 71, 158, 1, 214, 53, 160, 197, 143, 199, 253, 100, 195,
  ],
  [
    217, 101, 222, 148, 103, 254, 1, 73, 229, 201, 166, 1, 79, 227, 26, 176,
    118, 63, 246, 79, 118, 23, 206, 122, 47, 11, 213, 71, 188, 110, 21, 230, 99,
    182, 20, 117, 105, 247, 30, 99, 191, 3, 64, 39, 223, 106, 143, 81, 16, 218,
    60, 73, 17, 117, 198, 241, 156, 131, 175, 135, 241, 104, 59, 21,
  ],
  [
    180, 181, 229, 173, 48, 225, 174, 18, 125, 47, 67, 184, 78, 139, 96, 38,
    142, 254, 187, 7, 190, 60, 186, 103, 188, 108, 81, 13, 240, 0, 118, 50, 28,
    205, 25, 83, 202, 17, 118, 6, 197, 72, 118, 119, 168, 9, 43, 35, 154, 76,
    236, 106, 188, 192, 123, 80, 174, 57, 123, 172, 98, 94, 88, 110,
  ],
];
const wallet_count = 5;
let buy_sell_flag: boolean = true;

const swap_orca = async (buy_sell_flag: boolean, rand: number) => {
  fs.writeFileSync(wallet_json, `[${wallet[rand]}]`);

  // Create WhirlpoolClient
  const provider = AnchorProvider.env();
  const ctx = WhirlpoolContext.withProvider(
    provider,
    ORCA_WHIRLPOOL_PROGRAM_ID
  );
  const client = buildWhirlpoolClient(ctx);
  console.log("Wallet Address:", ctx.wallet.publicKey.toBase58());

  // Token definition
  // devToken specification
  const USDC = {
    mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: 6,
  };
  const YAKU = {
    mint: new PublicKey("AqEHVh8J2nXH9saV2ciZyYwPpqWFRfD2ffcq5Z8xxqm5"),
    decimals: 9,
  };

  // WhirlpoolsConfig account
  // devToken ecosystem / Orca Whirlpools
  const DEVNET_WHIRLPOOLS_CONFIG = new PublicKey(
    "H8NMV5QR1rp6p5PFGjfe5yEamwb3EQbhBTkfTkzc2mt3"
  );

  const inToken = buy_sell_flag ? USDC : YAKU;
  const outToken = buy_sell_flag ? YAKU : USDC;
  // Get outToken/inToken whirlpool
  // Whirlpools are identified by 5 elements (Program, Config, mint address of the 1st token,
  // mint address of the 2nd token, tick spacing), similar to the 5 column compound primary key in DB
  const tick_spacing = 64;
  const whirlpool_pubkey = PDAUtil.getWhirlpool(
    ORCA_WHIRLPOOL_PROGRAM_ID,
    DEVNET_WHIRLPOOLS_CONFIG,
    outToken.mint,
    inToken.mint,
    tick_spacing
  ).publicKey;
  const whirlpool = await client.getPool(whirlpool_pubkey);

  // Swap x inToken for outToken
  const amount_in = !buy_sell_flag
    ? new Decimal("100" /* YAKU */)
    : new Decimal("1" /* USDC */);

  // Obtain swap estimation (run simulation)
  const quote = await swapQuoteByInputToken(
    whirlpool,
    // Input token and amount
    inToken.mint,
    DecimalUtil.toBN(amount_in, inToken.decimals),
    // Acceptable slippage (10/1000 = 1%)
    Percentage.fromFraction(10, 1000),
    ctx.program.programId,
    ctx.fetcher,
    IGNORE_CACHE
  );

  if (!buy_sell_flag) {
    // Output the estimation
    console.log(
      "Selling",
      DecimalUtil.fromBN(quote.estimatedAmountIn, inToken.decimals).toString(),
      "YAKU for",
      DecimalUtil.fromBN(
        quote.estimatedAmountOut,
        outToken.decimals
      ).toString(),
      "USDC"
    );
  } else {
    // Output the estimation
    console.log(
      "Buying",
      DecimalUtil.fromBN(
        quote.estimatedAmountOut,
        outToken.decimals
      ).toString(),
      "YAKU with",
      DecimalUtil.fromBN(quote.estimatedAmountIn, inToken.decimals).toString(),
      "USDC"
    );
  }

  // Send the transaction
  const tx = await whirlpool.swap(quote);
  const signature = await tx.buildAndExecute();

  // Wait for the transaction to complete
  const latest_blockhash = await ctx.connection.getLatestBlockhash();
  await ctx.connection.confirmTransaction(
    { signature, ...latest_blockhash },
    "confirmed"
  );
  console.log("Transaction Confirmed!");

  // Get token balance
  const connection = new Connection(RPC_ENDPOINT_URL, COMMITMENT);
  const keypair = Keypair.fromSecretKey(new Uint8Array(wallet[rand]));

  const accounts = await connection.getTokenAccountsByOwner(keypair.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  const token_defs = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
      name: "USDC",
      decimals: 6,
    },
    AqEHVh8J2nXH9saV2ciZyYwPpqWFRfD2ffcq5Z8xxqm5: {
      name: "YAKU",
      decimals: 9,
    },
  };

  // Deserialize token account data
  for (let i = 0; i < accounts.value.length; i++) {
    const value = accounts.value[i];

    // Deserialize
    const parsed_token_account = unpackAccount(value.pubkey, value.account);
    // Use the mint address to determine which token account is for which token
    const mint = parsed_token_account.mint;
    const token_def = token_defs[mint.toBase58()];
    // Ignore non-devToken accounts
    if (token_def === undefined) continue;

    // The balance is "amount"
    const amount = parsed_token_account.amount;
    // The balance is managed as an integer value, so it must be converted for UI display
    const ui_amount = DecimalUtil.fromBN(
      new BN(amount.toString()),
      token_def.decimals
    );

    if (mint.toBase58() == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
      console.log("USDC Balance: ", ui_amount.toString());
    if (mint.toBase58() == "AqEHVh8J2nXH9saV2ciZyYwPpqWFRfD2ffcq5Z8xxqm5")
      console.log("YAKU Balance: ", ui_amount.toString());
  }
};

const swap_meteora = async () => {
  const user = Keypair.fromSecretKey(
    new Uint8Array(bs58.decode(process.env.USER_PRIVATE_KEY))
  );
  const RPC =
    process.env.RPC ||
    "https://boldest-palpable-pallet.solana-mainnet.quiknode.pro/e0a358167e7dfda9c51aec059814b4606f444852";
  const connection = new Connection(RPC, "finalized");

  const devnetPool = new PublicKey(
    "3W2HKgUa96Z69zzG3LK1g8KdcRAWzAttiLiHfYnKuPw5"
  ); // You can get your desired pool address from the API https://dlmm-api.meteora.ag/pair/all

  const dlmmPool = await DLMM.create(connection, devnetPool);

  const swapAmount = new BN(100);
  // Swap quote
  const swapYtoX = true;
  const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);
  const swapQuote = await dlmmPool.swapQuote(
    swapAmount,
    swapYtoX,
    new BN(10),
    binArrays
  );

  // Swap
  const swapTx = await dlmmPool.swap({
    inToken: dlmmPool.tokenX.publicKey,
    binArraysPubkey: swapQuote.binArraysPubkey,
    inAmount: swapAmount,
    lbPair: dlmmPool.pubkey,
    user: user.publicKey,
    minOutAmount: swapQuote.minOutAmount,
    outToken: dlmmPool.tokenY.publicKey,
  });

  try {
    const swapTxHash = await sendAndConfirmTransaction(connection, swapTx, [
      user,
    ]);
    console.log("swapTxHash:", swapTxHash);
  } catch (error) {
    console.log("error:", JSON.parse(JSON.stringify(error)));
  }
};

const swap_jupiter = async () => {
  // It is recommended that you use your own RPC endpoint.
  // This RPC endpoint is only for demonstration purposes so that this example will run.
  //   const connection = new Connection(
  //     "https://neat-hidden-sanctuary.solana-mainnet.discover.quiknode.pro/2af5315d336f9ae920028bbb90a73b724dc1bbed/"
  //   );
  const connection = new Connection("https://api.devnet.solana.com");

  const wallet = new Wallet(
    Keypair.fromSecretKey(bs58.decode(process.env.USER_PRIVATE_KEY || ""))
  );
  console.log(wallet);

  // Swapping SOL to USDC with input 0.1 SOL and 0.5% slippage
  const quoteResponse = await (
    await fetch(
      "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000000&slippageBps=50"
    )
  ).json();
  console.log({ quoteResponse });

  // get serialized transactions for the swap
  const { swapTransaction } = await (
    await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // quoteResponse from /quote api
        quoteResponse,
        // user public key to be used for the swap
        userPublicKey: wallet.publicKey.toString(),
        // auto wrap and unwrap SOL. default is true
        wrapAndUnwrapSol: true,
        // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
        // feeAccount: "fee_account_public_key"
      }),
    })
  ).json();

  // deserialize the transaction
  const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
  var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  console.log(transaction);

  // sign the transaction
  transaction.sign([wallet.payer]);

  // Execute the transaction
  const rawTransaction = transaction.serialize();
  console.log(rawTransaction);
  const txid = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 2,
  });
  await connection.confirmTransaction(txid);
  console.log(`https://solscan.io/tx/${txid}`);
};

async function main() {
  while (true) {
    const rand = Math.floor(Math.random() * wallet_count);

    await swap_orca(buy_sell_flag, rand);
    // await swap_meteora();
    // await swap_jupiter();
    buy_sell_flag = !buy_sell_flag;
  }
}

main();
