const express = require("express")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser");
const expressValidator = require("express-validator")
const path = require("path")
const fs = require("fs")
const paypal = require("paypal-rest-sdk")
const botconfig = require("./botconfig.json");
const Discord = require("discord.js");
const mysql = require("mysql");
const base58 = require("base-58")
const requests = require("request");
var rl = require("readline");

var currentCaptchaTasks = {};

var clothingBotMysql = mysql.createPool({
  host: "95.217.227.179",
  user: "root",
  password: "9KvjJYYn",
  database: "ascensionbot"
});

var sniperMysql = mysql.createPool({
  host: "95.217.227.179",
  user: "root",
  password: "9KvjJYYn",
  database: "ascensionsniper"
});
var favbotMysql = mysql.createPool({
  host: "95.217.227.179",
  user: "root",
  password: "9KvjJYYn",
  database: "favbot"
});
var fcSolverMysql = mysql.createPool({
  host: "95.217.227.179",
  user: "root",
  password: "9KvjJYYn",
  database: "fcsolver"
});

var referralPercent = 0.3;
var publicGuildId = "621954768302112769";
var jwtSecret = "&%LA)74!rjF?3!.-1ha&483?¤7#öiK";
var internalAPIsecret = "(&/jdh6RAR&%¤bjstd%&SRaxdas";
var reCAPTCHAsecret = "6LfeT7gUAAAAAMZ9MbU8j7MZD_kKxbPj46zpeBXD";
var mysqlErrors = [];
var cachedUsernames = [];

module.exports = {
  clothingBotMysql,
  sniperMysql,
  favbotMysql,
  currentCaptchaTasks,
  publicGuildId,
  internalAPIsecret,
  jwtSecret,
  reCAPTCHAsecret,
  mysqlErrors,
  cachedUsernames,
  fcSolverMysql
}
