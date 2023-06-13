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
            if (_nftList.length == 0)
                _dailyRewardAmount = 0
            else
                _dailyRewardAmount = 22 + (_nftList.length - 1) * 5

            const _newRewardInfo = new RewardInfo({
                accountId: _accountId,
                stakedNftCount: _nftList.length,
                daily_reward: _dailyRewardAmount
            });
            await _newRewardInfo.save();
        }
        else {
            let _dailyRewardAmount = 0
            if (_oldRewardInfo.stakedNftCount + _nftList.length == 0)
                _dailyRewardAmount = 0
            else
                _dailyRewardAmount = 22 + (_oldRewardInfo.stakedNftCount + _nftList.length - 1) * 5

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

        let _dailyReward = 0
        const _rewardInfo = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardInfo)
            _dailyReward = _rewardInfo.daily_reward

        return res_.send({ result: true, data: _stakedNftInfo, dailyReward: _dailyReward });
    } catch (error) {
        return res_.send({ result: false, error: 'Error detected in server progress!' });
    }
}

exports.getRewardAmount = async (req_, res_) => {
    try {
        if (!req_.query.accountId)
            return res_.send({ result: false, error: 'Invalid post data!' });

        const _accountId = req_.query.accountId;

        let _amount = 0
        const _rewardData = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardData)
            _amount = _rewardData.amount

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

        for (let i = 0; i < _nftList.length; i++) {
            const _stakedNFTInfo = await StakedNfts.findOne({ accountId: _accountId, token_id: _nftList[i].token_id, serial_number: _nftList[i].serial_number })
            const _rewardInfo = await RewardInfo.findOne({ accountId: _accountId })
            if (_stakedNFTInfo.serial_number === _rewardInfo.checkSerialNumber) {
                await RewardInfo.findOneAndUpdate(
                    { accountId: _accountId },
                    { checkSerialNumber: 0 }
                )
            }
        }

        const _rewardInfo = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardInfo) {
            if (_rewardInfo.stakedNftCount - _nftList.length == 0)
                await RewardInfo.findOneAndDelete({ accountId: _accountId })
            else {
                await RewardInfo.findOneAndUpdate(
                    { accountId: _accountId },
                    {
                        stakedNftCount: _rewardInfo.stakedNftCount - _nftList.length,
                        daily_reward: 22 + (_rewardInfo.stakedNftCount - _nftList.length - 1) * 5
                    }
                )
            }
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

        let _amount = 0

        const _rewardData = await RewardInfo.findOne({ accountId: _accountId })
        if (_rewardData)
            _amount = _rewardData.amount

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
    // check existing
    const _findStakedNftInfo = await StakedNfts.findOne({ _id: id_ });
    if (_findStakedNftInfo === null) return;

    const _rewardInfo = await RewardInfo.findOne({ accountId: _findStakedNftInfo.accountId });
    if (_findStakedNftInfo.currentLockoutPeriod < 14) {
        if (_rewardInfo.checkSerialNumber == 0 || _rewardInfo.checkSerialNumber == _findStakedNftInfo.serial_number) {
            await RewardInfo.findOneAndUpdate(
                { accountId: _findStakedNftInfo.accountId },
                {
                    amount: _rewardInfo.amount + _rewardInfo.daily_reward,
                    checkSerialNumber: _findStakedNftInfo.serial_number
                }
            );
        }
    }

    if (_findStakedNftInfo.currentLockoutPeriod !== 0) {
        await StakedNfts.findOneAndUpdate(
            { _id: id_ },
            { currentLockoutPeriod: _findStakedNftInfo.currentLockoutPeriod - 1 }
        );
    }

    setDaysTimeout(stakeTimerOut, 1, id_);
}

function setDaysTimeout(callback, days, id_) {
    // 86400 seconds in a day
    let msInDay = 86400 * 1000;
    // let msInDay = 10 * 1000;

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
    const _findStakedNftInfo = await StakedNfts.find({}).sort({ accountId: -1 });
    for (let i = 0; i < _findStakedNftInfo.length; i++) {
        const _count = Math.floor((Date.now() - _findStakedNftInfo[i].createdAt) / 86400000);
        const _remainTime = (Date.now() - _findStakedNftInfo[i].createdAt) % 86400000;

        await StakedNfts.findOneAndUpdate(
            { _id: _findStakedNftInfo[i]._id },
            { currentLockoutPeriod: 14 - _count }
        )

        const _stakedNftInfo = await StakedNfts.find({ accountId: _findStakedNftInfo[i].accountId })

        // calculate daily reward amount
        let _dailyRewardAmount = 0
        if (_stakedNftInfo.length == 0)
            _dailyRewardAmount = 0
        else
            _dailyRewardAmount = 22 + (_stakedNftInfo.length - 1) * 5

        await RewardInfo.findOneAndUpdate(
            { accountId: _findStakedNftInfo[i].accountId },
            {
                stakedNftCount: _stakedNftInfo.length,
                daily_reward: _dailyRewardAmount
            }
        );

        setTimeout(stakeTimerOut, _remainTime, _findStakedNftInfo[i]._id);
    }
}

initStakeTimer();