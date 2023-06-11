const { receiveAllowancedNfts, sendNfts, claimReward } = require('../chainAction');

const StakedNfts = require('../../models/stakedNfts')
const RewardInfo = require('../../models/rewardInfo')

const NFT_COUNT = 600;

exports.stakeNewNfts = async (req_, res_) => {
    try {
        if (!req_.body.accountId || !req_.body.nftList)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.body.accountId;
        const _nftList = JSON.parse(req_.body.nftList);

        const _tsxResult = await receiveAllowancedNfts(_accountId, _nftList);
        if (!_tsxResult)
            return res_.send({ result: false, error: 'Error! The transaction was rejected, or failed! Please try again!' });

        let _newStakedNft

        for (let i = 0; i < _nftList.length; i++) {
            _newStakedNft = new StakedNfts({
                accountId: _accountId,
                token_id: _nftList[i].token_id,
                serial_number: _nftList[i].serial_number,
                imageUrl: _nftList[i].imageUrl,
                name: _nftList[i].name
            });
            await _newStakedNft.save();
        }

        // add reward info
        const _oldRewardInfo = await RewardInfo.findOne({ accountId: _accountId });
        if (!_oldRewardInfo) {
            let _dailyRewardAmount = 0
            if (_nftList.length == 1)
                _dailyRewardAmount = 22
            else if (_nftList.length == 2)
                _dailyRewardAmount = 27
            else if (_nftList.length >= 3)
                _dailyRewardAmount = 32

            const _newRewardInfo = new RewardInfo({
                accountId: _accountId,
                stakedNftCount: _nftList.length,
                daily_reward: _dailyRewardAmount
            });
            await _newRewardInfo.save();
        }
        else {
            let _dailyRewardAmount = 0
            if (_oldRewardInfo.stakedNftCount + _nftList.length == 1)
                _dailyRewardAmount = 22
            else if (_oldRewardInfo.stakedNftCount + _nftList.length == 2)
                _dailyRewardAmount = 27
            else if (_oldRewardInfo.stakedNftCount + _nftList.length >= 3)
                _dailyRewardAmount = 32

            await RewardInfo.findOneAndUpdate(
                { accountId: _accountId },
                {
                    stakedNftCount: _oldRewardInfo.stakedNftCount + _nftList.length,
                    daily_reward: _dailyRewardAmount
                }
            );
        }

        setDaysTimeout(stakeTimerOut, 1, _newStakedNft._id);

        return res_.send({ result: true, data: "NFTs successfully staked!" });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.loadStakeRatio = async (req_, res_) => {
    try {
        const _stakedNfts = await StakedNfts.find({});
        const _totalStakerInfo = await RewardInfo.find({})

        return res_.send({ result: true, data: { stakeRatio: _stakedNfts.length / NFT_COUNT * 100, stakedNFTCount: _stakedNfts.length, totalNFTCount: NFT_COUNT, totalStakerCount: _totalStakerInfo.length } });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.loadStakedNfts = async (req_, res_) => {
    try {
        if (!req_.query.accountId)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.query.accountId;

        const _stakedNfts = await StakedNfts.find({ accountId: _accountId });

        let _stakedNftInfo = [];
        for (let i = 0; i < _stakedNfts.length; i++) {
            _stakedNftInfo.push({
                token_id: _stakedNfts[i].token_id,
                serial_number: _stakedNfts[i].serial_number,
                imageUrl: _stakedNfts[i].imageUrl,
                name: _stakedNfts[i].name,
                currentLockoutPeriod: _stakedNfts[i].currentLockoutPeriod,
                selected: false,
            })
        }

        return res_.send({ result: true, data: _stakedNftInfo });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.getRewardAmount = async (req_, res_) => {
    try {
        if (!req_.query.accountId)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.query.accountId;

        const _stakedNfts = await StakedNfts.find({ accountId: _accountId });

        let _amount = 0
        for (let i = 0; i < _stakedNfts.length; i++)
            _amount += _stakedNfts[i].reward_amount

        const _rewardData = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardData)
            _amount += _rewardData.amount

        return res_.send({ result: true, data: _amount });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.unstakeNftList = async (req_, res_) => {
    try {
        if (!req_.body.accountId)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.body.accountId;
        const _nftList = JSON.parse(req_.body.nftList);

        const tsxResult = await sendNfts(_accountId, _nftList);
        if (!tsxResult)
            return res_.send({ result: false, error: 'Error! The transaction was rejected, or failed! Please try again!' });

        let _rewardAmount = 0
        for (let i = 0;i < _nftList.length;i++) {
            const _stakedNFTInfo = await StakedNfts.findOne({ accountId: _accountId, token_id: _nftList[i].token_id, serial_number: _nftList[i].serial_number })
            if (_stakedNFTInfo.reward_amount > 0)
                _rewardAmount += _stakedNFTInfo.reward_amount
        }

        const _rewardInfo = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardInfo) {
            await RewardInfo.findOneAndUpdate(
                { accountId: _accountId },
                {
                    stakedNftCount: _rewardInfo.stakedNftCount - _nftList.length,
                    amount: _rewardInfo.amount + _rewardAmount,
                }
            )
        }

        for (let i = 0; i < _nftList.length; i++)
            await StakedNfts.findOneAndDelete({ accountId: _accountId, token_id: _nftList[i].token_id, serial_number: _nftList[i].serial_number });

        return res_.send({ result: true, data: "Unstake success!" });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.claimReward = async (req_, res_) => {
    try {
        if (!req_.query.accountId)
            return res_.send({ result: false, error: 'Invalid get data!' });

        const _accountId = req_.query.accountId;

        const _stakedNfts = await StakedNfts.find({ accountId: _accountId });

        let _amount = 0
        for (let i = 0; i < _stakedNfts.length; i++)
            _amount += _stakedNfts[i].reward_amount

        const _rewardData = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardData)
            _amount += _rewardData.amount

        if (_amount === 0)
            return res_.send({ result: false, error: "No reward!" });

        const tsxResult = await claimReward(_accountId, _amount);
        if (!tsxResult)
            return res_.send({ result: false, error: 'Error! The transaction was rejected, or failed! Please try again!' });

        return res_.send({ result: true, data: _amount });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.setClaimReward = async (req_, res_) => {
    try {
        if (!req_.body.accountId)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.body.accountId;

        const _rewardInfo = await RewardInfo.findOne({ accountId: _accountId });
        if (!_rewardInfo)
            return res_.send({ result: false, error: "Invalid user!" });
        await RewardInfo.findOneAndUpdate(
            { accountId: _accountId },
            { amount: 0 }
        )
        await StakedNfts.updateMany(
            { accountId: _accountId },
            { reward_amount: 0 }
        )
        return res_.send({ result: true });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

const stakeTimerOut = async (id_) => {
    console.log("stakeTimerOut", id_);
    // check existing
    const _findStakedNftInfo = await StakedNfts.findOne({ _id: id_ });
    if (_findStakedNftInfo === null) return;

    const _rewardInfo = await RewardInfo.findOne({ accountId: _findStakedNftInfo.accountId });

    if (_findStakedNftInfo.currentLockoutPeriod === 0) {
        await StakedNfts.findOneAndUpdate(
            { _id: id_ },
            {
                reward_amount: _findStakedNftInfo.reward_amount + _rewardInfo.daily_reward
            }
        );
    } else {
        await StakedNfts.findOneAndUpdate(
            { _id: id_ },
            {
                reward_amount: _findStakedNftInfo.reward_amount + _rewardInfo.daily_reward,
                currentLockoutPeriod: _findStakedNftInfo.currentLockoutPeriod - 1
            }
        );
    }

    setDaysTimeout(stakeTimerOut, 1, id_);
}

function setDaysTimeout(callback, days, id_) {
    // 86400 seconds in a day
    let msInDay = 86400 * 1000;
    // let msInDay = 300 * 1000;

    let dayCount = 0;
    let timer = setInterval(function () {
        dayCount++;  // a day has passed

        if (dayCount === days) {
            clearInterval(timer);
            callback(id_);
        }
    }, msInDay);
}

const initStakeTimer = async () => {
    console.log(Date.now())
    const _findStakedNftInfo = await StakedNfts.find({}).sort({ accountId: -1 });
    for (let i = 0; i < _findStakedNftInfo.length; i++) {
        const _remainTime = (Date.now() - _findStakedNftInfo[i].createdAt) % 86400000;

        setTimeout(stakeTimerOut, _remainTime, _findStakedNftInfo[i]._id);
    }
}

initStakeTimer();