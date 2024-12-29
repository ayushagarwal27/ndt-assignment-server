import express from "express";
import { ethers } from "ethers";
import pinataSDK from "@pinata/sdk";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const provider = new ethers.providers.JsonRpcProvider(
  "https://eth-sepolia.alchemyapi.io/v2/" + ALCHEMY_API_KEY
);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const pinata = pinataSDK(pinataApiKey, pinataSecretApiKey);

const contractOneAddress = "0xa2b736f4fbeE2E2332ac2880D9b932C49eb1fe01";
const contractTwoAddress = "0xa2b736f4fbeE2E2332ac2880D9b932C49eb1fe01";

let contractOne;
let contractTwo;

const loadContracts = async () => {
  const ContractOneABI = await import("./abis/ContractOne.json", {
    assert: { type: "json" },
  });
  const ContractTwoABI = await import("./abis/ContractTwo.json", {
    assert: { type: "json" },
  });

  contractOne = new ethers.Contract(
    contractOneAddress,
    ContractOneABI.default,
    wallet
  );
  contractTwo = new ethers.Contract(
    contractTwoAddress,
    ContractTwoABI.default,
    wallet
  );

  // Listen to NameChanged events from ContractTwo
  contractTwo.on("NameChanged", async (tokenId, newName) => {
    // Update metadata on Pinata
    const metadata = {
      name: newName,
      description: `This is NFT #${tokenId} with name ${newName}`,
      image: `https://gateway.pinata.cloud/ipfs/YOUR_IMAGE_HASH`,
    };

    const result = await pinata.pinJSONToIPFS(metadata);
    const tokenURI = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;

    // Update tokenURI on the smart contract
    const tx = await contractTwo.setTokenURI(tokenId, tokenURI);
    await tx.wait();
  });
};

loadContracts();

app.post("/mint", async (req, res) => {
  try {
    const { to } = req.body;
    const tx = await contractOne.mintNFT(to);
    await tx.wait();

    res
      .status(200)
      .send({ message: "NFT minted successfully", transactionHash: tx.hash });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
