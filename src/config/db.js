const mongoose = require('mongoose');
const dbConfig = require('./config');

const db = {};
db.mongoose = mongoose;
db.url = dbConfig.url;

module.exports = db;
