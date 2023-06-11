const express = require('express');
const router = express.Router();

const Stake = require("./Stake");

router.use("/stake", Stake);

module.exports = router;
