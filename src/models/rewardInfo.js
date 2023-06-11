const mongoose = require('mongoose');
const rewardInfoSchema = new mongoose.Schema({
  accountId: { type: String, default: "" },
  stakedNftCount: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  daily_reward: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = rewardInfo = mongoose.model('rewardInfo', rewardInfoSchema);
