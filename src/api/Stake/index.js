const express = require('express');
const router = express.Router();
const stake = require("./controller");

router.get('/load_staked_nfts', stake.loadStakedNfts);
router.get('/load_stake_ratio', stake.loadStakeRatio);
router.get('/get_reward_amount', stake.getRewardAmount);
router.get('/claim_reward', stake.claimReward);

router.post('/stake_new_nfts', stake.stakeNewNfts);
router.post('/unstake_nftlist', stake.unstakeNftList);
router.post('/set_claim_reward', stake.setClaimReward);

module.exports = router;
