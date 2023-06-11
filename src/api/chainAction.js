require('dotenv').config('../../../env');
const {
  Client,
  AccountId,
  PrivateKey,
  TokenId,
  TransactionId,
  TransferTransaction,
  TokenAssociateTransaction,
  Hbar,
  NftId,
  AccountAllowanceApproveTransaction,
} = require('@hashgraph/sdk');

const axios = require('axios');

const operatorId = AccountId.fromString(process.env.TREASURY_ID);
const operatorKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);
const client = Client.forMainnet().setOperator(operatorId, operatorKey);

const POOFS_TOKEN_ID = "0.0.2106774"
const POOFS_DECIMAL = 4

exports.receiveAllowancedNfts = async (sender_, nftList_) => {
  try {
    const nftSendTx = new TransferTransaction()

    for (let i = 0; i < nftList_.length; i++) {
      const _nft = new NftId(TokenId.fromString(nftList_[i].token_id), nftList_[i].serial_number);
      nftSendTx.addApprovedNftTransfer(_nft, AccountId.fromString(sender_), operatorId);
    }

    nftSendTx.setTransactionId(TransactionId.generate(operatorId)).freezeWith(client);
    const nftSendSign = await nftSendTx.sign(operatorKey);
    const nftSendSubmit = await nftSendSign.execute(client);
    const nftSendRx = await nftSendSubmit.getReceipt(client);
    if (nftSendRx.status._code != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.sendNfts = async (receiverId_, nftList_) => {
  try {
    const transferTx = await new TransferTransaction();
    for (let i = 0; i < nftList_.length; i++)
      transferTx.addNftTransfer(TokenId.fromString(nftList_[i].token_id), nftList_[i].serial_number, operatorId, AccountId.fromString(receiverId_))
    transferTx.freezeWith(client).sign(operatorKey);

    const transferSubmit = await transferTx.execute(client);
    const transferRx = await transferSubmit.getReceipt(client);

    if (transferRx.status._code !== 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.sendHbarToBorrower = async (lender, borrower, hbarAmount) => {
  try {
    const sendHbarBal = new Hbar(hbarAmount); // Spender must generate the TX ID or be the client

    const nftSendTx = new TransferTransaction()
      .addApprovedHbarTransfer(AccountId.fromString(lender), sendHbarBal.negated())
      .addHbarTransfer(borrower, sendHbarBal);

    nftSendTx.setTransactionId(TransactionId.generate(operatorId)).freezeWith(client);
    const nftSendSign = await nftSendTx.sign(operatorKey);
    const nftSendSubmit = await nftSendSign.execute(client);
    const nftSendRx = await nftSendSubmit.getReceipt(client);
    if (nftSendRx.status._code != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.receiveAllowanceNftAndHbar = async (sender, tokenId, serialNumber, hbarAmount) => {
  try {
    const sendHbarBal = new Hbar(hbarAmount); // Spender must generate the TX ID or be the client
    const _nft = new NftId(TokenId.fromString(tokenId), serialNumber);

    const nftSendTx = new TransferTransaction()
      .addApprovedHbarTransfer(AccountId.fromString(sender), sendHbarBal.negated())
      .addHbarTransfer(operatorId, sendHbarBal)
      .addApprovedNftTransfer(_nft, AccountId.fromString(sender), operatorId)
      .setTransactionId(TransactionId.generate(operatorId))
      .freezeWith(client);

    const nftSendSign = await nftSendTx.sign(operatorKey);
    const nftSendSubmit = await nftSendSign.execute(client);
    const nftSendRx = await nftSendSubmit.getReceipt(client);
    if (nftSendRx.status._code != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.receiveAllowanceHbar = async (sender, hbarAmount) => {
  try {
    const sendHbarBal = new Hbar(hbarAmount); // Spender must generate the TX ID or be the client

    const nftSendTx = new TransferTransaction()
      .addApprovedHbarTransfer(AccountId.fromString(sender), sendHbarBal.negated())
      .addHbarTransfer(operatorId, sendHbarBal);

    nftSendTx.setTransactionId(TransactionId.generate(operatorId)).freezeWith(client);
    const nftSendSign = await nftSendTx.sign(operatorKey);
    const nftSendSubmit = await nftSendSign.execute(client);
    const nftSendRx = await nftSendSubmit.getReceipt(client);
    if (nftSendRx.status._code != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.sendHbar = async (receiverId, amount) => {
  console.log('sendHbar log - 1 : ', receiverId, amount);
  try {
    const transferTx = await new TransferTransaction()
      .addHbarTransfer(operatorId, new Hbar(-amount))
      .addHbarTransfer(AccountId.fromString(receiverId), new Hbar(amount))
      .freezeWith(client)
      .sign(operatorKey);
    const transferSubmit = await transferTx.execute(client);
    const transferRx = await transferSubmit.getReceipt(client);

    if (transferRx.status._code !== 22)
      return false;

    return true;
  } catch (error) {
    return false;
  }
}

exports.sendNft = async (receiverId, token_id, serial_number) => {
  try {
    const transferTx = await new TransferTransaction()
      .addNftTransfer(TokenId.fromString(token_id), serial_number, operatorId, AccountId.fromString(receiverId))
      .freezeWith(client)
      .sign(operatorKey);
    const transferSubmit = await transferTx.execute(client);
    const transferRx = await transferSubmit.getReceipt(client);

    if (transferRx.status._code !== 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.claimReward = async (_accountId, _poofsAmount) => {
  try {
    const sendPoofsBal = parseFloat(_poofsAmount) * 10 ** POOFS_DECIMAL

    const transaction = new AccountAllowanceApproveTransaction();
    transaction.approveTokenAllowance(POOFS_TOKEN_ID, operatorId, AccountId.fromString(_accountId), sendPoofsBal);
    transaction.freezeWith(client);

    const signTx = await transaction.sign(operatorKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    if (receipt.status._code !== 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.associateCheck = async (tokenId) => {
  try {
    const checkingTokenId = tokenId;
    let tokenAssociatedFlag = false;

    let response = await axios.get(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${process.env.TREASURY_ID}/tokens`);
    let nextLink = response.data.links.next;
    while (1) {

      const nftData = response.data.tokens;

      for (let i = 0; i < nftData.length; i++) {
        if (nftData[i].token_id === checkingTokenId) {
          tokenAssociatedFlag = true;
          break;
        }
      }

      if (nextLink === null) break;
      response = await axios.get(`https://mainnet-public.mirrornode.hedera.com${nextLink}`);
      nextLink = response.data.links.next;
    }

    if (tokenAssociatedFlag)
      return true;

    return false;
  } catch (error) {
    return false;
  }
}

exports.setAssociate = async (tokenId) => {
  console.log("setAssociate log - 1 : ", tokenId);
  try {
    const checkingTokenId = tokenId;
    //Associate a token to an account and freeze the unsigned transaction for signing
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(operatorId)
      .setTokenIds([TokenId.fromString(checkingTokenId)])
      .freezeWith(client);

    const signTx = await transaction.sign(operatorKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;
    console.log("transactionStatus log", `Associate ${transactionStatus.toString()}!`);
    return true;
  } catch (error) {
    return false;
  }
}

exports.transferNFT = async (_sellerId, _buyerId, _nftInfo) => {
  try {
    console.log(_sellerId, _buyerId, _nftInfo.token_id, _nftInfo.serial_number);
    const _nft = new NftId(TokenId.fromString(_nftInfo.token_id), parseInt(_nftInfo.serial_number));
    const approvedSendTx = new TransferTransaction()
      .addApprovedNftTransfer(_nft, AccountId.fromString(_sellerId), AccountId.fromString(_buyerId))
      .setTransactionId(TransactionId.generate(operatorId)) // Spender must generate the TX ID or be the client
      .freezeWith(client);
    const approvedSendSign = await approvedSendTx.sign(operatorKey);
    const approvedSendSubmit = await approvedSendSign.execute(client);
    const approvedSendRx = await approvedSendSubmit.getReceipt(client);

    console.log(approvedSendRx.status._code);
    if (approvedSendRx.status._code != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}

exports.allowanceNft = async (_accountId, _tokenId, _serialNumber) => {
  try {
    const _nft = new NftId(TokenId.fromString(_tokenId), _serialNumber);

    const transaction = new AccountAllowanceApproveTransaction();
    transaction.approveTokenNftAllowance(_nft, operatorId, AccountId.fromString(_accountId));
    transaction.freezeWith(client);

    const signTx = await transaction.sign(operatorKey);
    const txResponse = await signTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const transactionStatus = receipt.status;

    if (transactionStatus != 22)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
