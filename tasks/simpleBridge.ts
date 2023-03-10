import { task } from "hardhat/config";
import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import { ethers } from 'ethers';

export default task("simpleBridge", "Execute xTransfer on the Simple Bridge with TEST tokens")
  .addParam("destinationDomain", "The domain ID of the receiving chain")
  .addParam("contractAddress", "The address of the Transfer contract")
  .addParam("tokenAddress", "The address of the TestERC20 on the origin domain")
  .addParam("amount", "The amount to send")
  .addOptionalParam("recipient", "The recipient address")
  .addOptionalParam("slippage", "The acceptable slippage")
  .addOptionalParam("relayerFee", "The fee paid to relayers")
  .setAction(
    async (
      { 
        destinationDomain, 
        contractAddress, 
        tokenAddress, 
        amount,
        recipient,
        slippage,
        relayerFee
      }
    ) => {
      const contractABI = [
        "function xTransfer(address recipient, uint32 destinationDomain, address token, uint256 amount, uint256 slippage, uint256 relayerFee)"
      ];
      
      const tokenABI = [
        "function mint(address account, uint256 amount)",
        "function approve(address spender, uint256 amount)"
      ]
     
      const provider = new ethers.providers.JsonRpcProvider(process.env.ORIGIN_RPC_URL);
      const wallet = new ethers.Wallet(String(process.env.PRIVATE_KEY), provider);
      const transfer = new ethers.Contract(contractAddress, contractABI, wallet);
      const token = new ethers.Contract(tokenAddress, tokenABI, wallet);

      // 1) mint some tokens 
      async function mint() {
        let unsignedTx = await token.populateTransaction.mint(
          wallet.address,
          amount
        );
        let txResponse = await wallet.sendTransaction(unsignedTx);
        return await txResponse.wait();
      }

      // 2) approve the token transfer
      async function approve() {
        let unsignedTx = await token.populateTransaction.approve(
          contractAddress,
          amount
        );
        let txResponse = await wallet.sendTransaction(unsignedTx);
        return await txResponse.wait();
      }
                  
      // 3) transfer the tokens 
      async function executeTransfer() {
        let unsignedTx = await transfer.populateTransaction.xTransfer(
          recipient ?? wallet.address,
          destinationDomain,
          tokenAddress,
          amount,
          slippage ?? 10000,
          relayerFee ?? 0
        );
        unsignedTx.gasLimit = ethers.BigNumber.from("2000000"); 
        let txResponse = await wallet.sendTransaction(unsignedTx);
        return await txResponse.wait();
      }

      let minted = await mint();
      console.log(minted.status == 1 ? "Successful mint" : "Failed mint");
      let approved = await approve();
      console.log(approved.status == 1 ? "Successful approve" : "Failed approve");
      let transferred = await executeTransfer();
      console.log(transferred.status == 1 ? "Successful transfer" : "Failed transfer"); 
      console.log(`Transaction hash: `, transferred.transactionHash); 
    });
