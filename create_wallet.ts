// create_wallet_json.ts
import bs58 from "bs58";
import * as bip39 from "bip39";
import { Keypair } from "@solana/web3.js";
import { HDKey } from "micro-ed25519-hdkey";

const wallet_json = "wallet_history.log";

const generateWallets = async (walletCount: number) => {
  // write file
  const fs = require("fs");

  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic, ""); // (mnemonic, password)
  const hd = HDKey.fromMasterSeed(seed.toString("hex"));

  console.log(mnemonic);

  for (let i = 0; i < walletCount; i++) {
    const path = `m/44'/501'/${i}'/0'`;
    const keypair = Keypair.fromSeed(hd.derive(path).privateKey);

    fs.appendFileSync(wallet_json, `Public Key: ${keypair.publicKey.toString()}\n`);
    fs.appendFileSync(wallet_json, `Private Key: ${bs58.encode(Uint8Array.from(keypair.secretKey))}\n`);
    fs.appendFileSync(wallet_json, `Secret Key: [${keypair.secretKey}]\n`);

    console.log("Public Key:", keypair.publicKey.toString());
    console.log("Private Key:", bs58.encode(Uint8Array.from(keypair.secretKey)));
    console.log("Secret Key:", keypair.secretKey);
  }
};

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question("wallet counts:", (walletCount) => {
  readline.close();
  generateWallets(walletCount);
});
