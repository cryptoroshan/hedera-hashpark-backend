const mongoose = require('mongoose');
const stakedNftsSchema = new mongoose.Schema({
  accountId: { type: String, default: "" },
  token_id: { type: String, default: "" },
  serial_number: { type: Number, default: -1 },
  imageUrl: { type: String, default: "" },
  name: { type: String, default: "" },
  reward_amount: { type: Number, default: 0 },
  currentLockoutPeriod: { type: Number, default: 14 }
}, { timestamps: true });

module.exports = stakedNfts = mongoose.model('stakedNfts', stakedNftsSchema);
