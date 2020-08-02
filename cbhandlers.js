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
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const socketIO = require('socket.io');
var globaldefs = require("./globaldefs");

function verifyJwtToken(req, res, next)
{
  const header = req.headers['authorization'];
  if(!header)
  {
    res.status(403).json({status: "fail", message: "Missing header"})
  }
  else {
    const bearer = header.split(' ');
    req.token = bearer[1];
    next();
  }
}

function getPasswordHash(password)
{
  var crypto = require('crypto');
  var salt = 'k/fG%jd?#)mjfd4563D%¤#"%+jF**7¤Sy6fd';

  var hashMd5 = crypto.createHash('md5').update(salt + password).digest("hex");
  var hasSha1 = crypto.createHash('sha1').update(hashMd5).digest("hex");
  return hasSha1;
}

function cacheUsernames() {
  globaldefs.clothingBotMysql.query("SELECT username FROM users", function(error, results, fields) {
    if(error)
    {
      console.log("FATAL ERROR, FAILED TO CACHE USERNAMES");
      console.log(error);
      globaldefs.mysqlErrors.push({type: "mysql", by: "root", at: "cacheUsernames", error: error, time: Date.now()});
    }
    else {
      results.forEach(result => {
        globaldefs.cachedUsernames.push(result.username);
      });
      console.log("Cached all usernames");
    }
  });
}

module.exports = function(app) {
  cacheUsernames();
  var purchaseHandler = require("./purchaseHandlers")(app);

  var transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
          user: 'vortex.verify@gmail.com',
          pass: 'kd6s8SNxmaSS72LYh6MGnct34'
      }
  });

  app.post("/api/login", function(req, res){
    req.checkBody('username', '').notEmpty();
    req.checkBody('password', '').notEmpty();

    var {username, password, rtoken} = req.body;

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Username or password cant be empty."});
    }

    if(!rtoken) return res.json({status: "fail", message: "Invalid captcha."});

    requests.post({
      url: "https://www.google.com/recaptcha/api/siteverify",
      qs: {
        secret: globaldefs.reCAPTCHAsecret,
        response: rtoken
      }
    }, function(error, response, body) {
      if(error)
      {
        res.json({status: "fail", message: "Server error, try logging in later."});
        globaldefs.mysqlErrors.push({type: "request", by: username, at: "/api/login", error: error, time: Date.now()});
      }
      else {
        var json = JSON.parse(body);
        if(json.success === true)
        {
          var hash = getPasswordHash(password);
          globaldefs.clothingBotMysql.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, hash], function(error, results, fields){
            if(error)
            {
              res.json({status: "fail", message: "Server error, try logging in later."});
              globaldefs.mysqlErrors.push({type: "mysql", by: username, at: "/api/login", error: error, time: Date.now()});
            }
            else {
              if(!results.length)
              {
                res.json({status: "fail", message: "Invalid username/password"});
              }
              else if(results[0].verified === 0)
              {
                res.json({status: "fail", message: "Verify your account to log in."});
              }
              else {
                const token = jwt.sign({
                  username: results[0].username,
                  email: results[0].email
                }, globaldefs.jwtSecret, {expiresIn: '1d'});
                res.json({status: "success", message: token});
              }
            }
          });
        }
        else {
          res.json({status: "fail", message: "Invalid captcha."});
        }
      }
    });
  });

  app.post("/api/register", function(req, res){
    req.checkBody('username', '').notEmpty();
    req.checkBody('password', '').notEmpty();
    req.checkBody('email', '').notEmpty();

    var {email, username, password, rtoken} = req.body;

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Email, username or password cant be empty."});
    }

    if(!rtoken) return res.json({status: "fail", message: "Invalid captcha."});

    if(globaldefs.cachedUsernames.includes(username)) return res.json({status: "fail", message: "Username is taken."});

    requests.post({
      url: "https://www.google.com/recaptcha/api/siteverify",
      qs: {
        secret: globaldefs.reCAPTCHAsecret,
        response: rtoken
      }
    }, function(error, response, body) {
      if(error)
      {
        res.json({status: "fail", message: "Server error, try registering later."});
        globaldefs.mysqlErrors.push({type: "request", by: username, at: "/api/register", error: error, time: Date.now()});
      }
      else {
        var json = JSON.parse(body);
        if(json.success === true)
        {
          var unique_hash = Array(64).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
          var hash = getPasswordHash(password);
          globaldefs.clothingBotMysql.query("INSERT INTO users (email, username, password, unique_hash) VALUES (?, ?, ?, ?)", [email, username, hash, unique_hash], function(error, results, fields) {
            if(error)
            {
              res.json({status: "fail", message: "Server error, try registering later."});
              globaldefs.mysqlErrors.push({type: "mysql", by: username, at: "/api/register", error: error, time: Date.now()});
            }
            else {
              var mailOptions = {
                from: 'vortex.verify@gmail.com', // sender address
                to: email, // list of receivers
                subject: 'Vortex - Verify Registration', // Subject line
                html: `${username}, please verify your registration by visiting the following link: https://vortex-b.xyz/api/verify/${encodeURIComponent(unique_hash)}`
              };
              transporter.sendMail(mailOptions, function (err, info) {
                if(err)
                {
                  globaldefs.mysqlErrors.push({type: "nodemailer", by: username, at: "/api/register", error: err, time: Date.now()});
                }
                });
              res.json({status: "success", message: "Registration success. A confirmation email has been sent to your email."});
            }
          });
        }
        else {
          res.json({status: "fail", message: "Invalid captcha."});
        }
      }
    });
  });

  app.post("/api/forgot_password", function(req, res){
    req.checkBody('username', '').notEmpty();

    var {username} = req.body;

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Username or password cant be empty."});
    }

    globaldefs.clothingBotMysql.query("SELECT * FROM users WHERE username = ?", [username], function(error, results, fields){
      if(error)
      {
        res.json({status: "fail", message: "Server error, try requesting for a password reset later. (#1)"});
        globaldefs.mysqlErrors.push({type: "mysql", by: username, at: "/api/forgot_password", error: error, time: Date.now()});
        return;
      }
      else {
        if(!results.length)
        {
          return res.json({status: "fail", message: "Invalid username/password"});
        }

        if((Date.now() - results[0].lastResetRequest) < 3600000) {
          return res.json({status: "fail", message: "You can only request for a password reset once per hour."});
        }
        
        var currentTime = Date.now();
        var unique_hash = Array(64).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
        globaldefs.clothingBotMysql.query("UPDATE users SET unique_hash = ?, lastResetRequest = ? WHERE username = ?", [unique_hash, currentTime, username], function(error2, results2, fields2) {
          if(error2) {
            res.json({status: "fail", message: "Server error, try requesting for a password reset later. (#2)"});
            globaldefs.mysqlErrors.push({type: "mysql", by: username, at: "/api/forgot_password", error: error2, time: Date.now()});
            return;
          }

          var mailOptions = {
            from: 'vortex.verify@gmail.com', // sender address
            to: results[0].email, // list of receivers
            subject: 'Vortex - Password reset request', // Subject line
            html: `${username}, you can use the following link to reset your password: https://vortex-b.xyz/reset_password?id=${encodeURIComponent(unique_hash)}`
          };
          transporter.sendMail(mailOptions, function (err, info) {
            if(err)
            {
              globaldefs.mysqlErrors.push({type: "nodemailer", by: username, at: "/api/forgot_password", error: err, time: Date.now()});
            }
            });

          res.json({status: "success", message: ""});
        });
      }
    });
  });

  app.post("/api/reset_password", function(req, res){
    req.checkBody('reset_id', '').notEmpty(); // this shouldnt be empty anyways
    req.checkBody('password', '').notEmpty();

    var {reset_id, password} = req.body;

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Password/Reset ID field cant be empty."});
    }

    // change unique hash so the user can't use same link to reset password
    var unique_hash = Array(64).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
    var password_hash = getPasswordHash(password);
    globaldefs.clothingBotMysql.query("UPDATE users SET unique_hash = ?, password = ? WHERE unique_hash = ?", [unique_hash, password_hash, reset_id], function(error, results, fields){
      if(error) {
        res.json({status: "fail", message: "Server error, try changing your password later."});
        globaldefs.mysqlErrors.push({type: "mysql", by: username, at: "/api/reset_password", error: error, time: Date.now()});
        return;
      }

      res.json({status: "success", message: ""})
    });
  });

  app.get("/api/verify/:id", function(req, res){

    var id = req.params.id;

    if(!id)
    {
      res.redirect("https://vortex-b.xyz/verify_fail");
    }

    globaldefs.clothingBotMysql.query("SELECT * FROM users WHERE unique_hash = ? AND verified = 0", [id], function(error, results, fields){
      if(error)
      {
        globaldefs.mysqlErrors.push({type: "mysql", by: data.username, at: "/api/verify/:id", error: error, time: Date.now()});
        res.redirect("https://vortex-b.xyz/verify_fail");
      }
      else {
        if(!results.length)
        {
          res.redirect("https://vortex-b.xyz/verify_fail");
        }
        else {
          globaldefs.clothingBotMysql.query("UPDATE users SET verified = 1 WHERE unique_hash = ?", [id], function(error2, results2, fields2){
            if(error2)
            {
              globaldefs.mysqlErrors.push({type: "mysql", by: data.username, at: "/api/verify/:id", error: error2, time: Date.now()});
              res.redirect("https://vortex-b.xyz/verify_fail");
            }
            else {
              //disc.userRegistered(results[0].username);
              res.redirect("https://vortex-b.xyz/verify_success");
            }
          });
        }
      }
    })
  });

  app.get("/api/vortex/getwhitelists", verifyJwtToken, function(req, res){
      jwt.verify(req.token, globaldefs.jwtSecret, (err, data) => {
        if(err)
        {
          res.status(403).json({status: "fail", message: "Expired token"});
        }
        else
        {
          globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE associatedUser = ?", [data.username], function(error, results, fields){
            if(error)
            {
              globaldefs.mysqlErrors.push({type: "mysql", by: data.username, at: "/api/vortex/getwhitelists", error: error, time: Date.now()});
              res.json({status: "fail", message: "Internal server error, try reloading the page later."});
            }
            else {
              whitelists = [];
              results.forEach(result => {
                whitelists.push({whitelistName: result.username, whitelistPassword: result.password, expires: result.timeOfExpiration, templateChanger: result.TemplateChangerEnabled, unlimitedCookies: result.UnlimitedCookies})
              });
              res.json({status: "success", message: whitelists});
            }
          });
        }
      });
  });

  app.post("/api/vortex/whitelist/resethwid", verifyJwtToken, function(req, res){
    req.checkBody('whitelistName', '').notEmpty();

    var {whitelistName} = req.body;

    var errors = req.validationErrors();
    if(errors)
    {
      return res.json({status: "fail", message: "Missing parameters."});
    }

      jwt.verify(req.token, globaldefs.jwtSecret, (err, data) => {
        if(err)
        {
          res.status(403).json({status: "fail", message: "Expired token"});
        }
        else
        {
          globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE username = ? AND associatedUser = ?`, [whitelistName, data.username],  function(error, results, fields){
            if(error)
            {
              globaldefs.mysqlErrors.push({type: "mysql", by: data.username, at: "/api/vortex/whitelist/resethwid", error: error, time: Date.now()});
              res.json({status: "fail", message: "Internal server error, try resetting hwid again later."});
            }
            else {
              if(!results.length)
              {
                res.json({status: "fail", message: "That's not your whitelist..."});
              }
              else if(results[0].lastHwidReset > Date.now()) {
                res.json({status: "fail", message: `Hwid reset for ${whitelistName} has already been performed in the past hour, please try again later.`});
              }
              else {
                var date = Date.now() + 3600000;
                globaldefs.clothingBotMysql.query("UPDATE logininfo SET hwid = NULL, lastHwidReset = ? WHERE username = ?", [date, whitelistName], function(error2, results, fields){
                  if(error2)
                  {
                    globaldefs.mysqlErrors.push({type: "mysql", by: data.username, at: "/api/vortex/whitelist/resethwid", error: error2, time: Date.now()});
                    res.json({status: "fail", message: "Internal server error, try resetting hwid again later."});
                  }
                  else {
                    res.json({status: "success", message: `Hwid reset successful for ${whitelistName}.`});
                  }
                });
              }
            }
          });
        }
      });
  });

  app.post("/api/checktoken", verifyJwtToken, function(req, res){
      jwt.verify(req.token, globaldefs.jwtSecret, (err, data) => {
        if(err)
        {
          res.status(403).json({status: 0, message: "Expired token"});
        }
        else
        {
          globaldefs.clothingBotMysql.query("SELECT * FROM users WHERE username = ?", [data.username], function(error, results, fields){
            if(error)
            {
              res.json({status: 1, userData: data});
            }
            else {
              res.json({status: 1, userData: data, isBuyer: results[0].isBuyer});
            }
          });
        }
      });
  });
}

function secondsToHms(d) {
    d = Number(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    return h + " hours, " + ('' + m).slice(-2) + " minutes, " + ('' + s).slice(-2) + " seconds."; //('' + h).slice(-2)
}
