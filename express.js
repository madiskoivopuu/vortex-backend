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
var cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const {Worker} = require('worker_threads');
const CryptoJS = require("crypto-js");

var anticaptcha = require('./anticaptcha')('6c8d4136e77f8b1207d8808c0a13930c');
anticaptcha.setWebsiteURL("https://www.roblox.com");
anticaptcha.setWebsiteKey("6LcpwSQUAAAAAPN5nICO6tHekrkrSIYvsl9jAPW4");
anticaptcha.setMinScore(0.3);
anticaptcha.setPageAction('link_page');
anticaptcha.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116");

/* EXPRESS */

const bot = new Discord.Client({disableEveryone: true});
bot.login(botconfig.token);
var app = express();

var server = http.createServer(app);
server.listen(5000, "0.0.0.0", () => console.log(`Listening on port 5000`));
const io = socketIO(server);
//var io = null;
var webhook = "https://discordapp.com/api/webhooks/538729073464180747/WAl2caPPD8Ov4iExpGivKNpL8ELRGBmXO6skDQNCVQzeCb8P2Z95V-Wb-wnxh5MhlP0E";

//Set html directory
app.use(express.static(path.join(__dirname, 'webfiles')))
app.use(cors());

//Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());

//View engine
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

//Global variables
/*app.use(function(req, res, next){
  res.locals.errors = null;
  next();
});*/

/*app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});*/

//Validator
app.use(expressValidator({
  errorFormatter: function(param, msg, value){
    var namespace = param.split('.'),
    root = namespace.shift(),
    formParam = root;
    while(namespace.length){
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param: formParam,
      msg: msg,
      value: value
    };
  }
}))

// Proxy
//app.set('trust proxy', true)

var globaldefs = require("./globaldefs");
var cbhandlers = require("./cbhandlers")(app);
//var fc_solver = new Worker("./fc_solver.js", {workerData: {app, io}})
var fc_solver = require("./fc_solver")(app, io);
app.listen(3000, '0.0.0.0', function(){
  console.log("Server started.");
});

// cache cookies
var cookiesForUser = {};
var apikey = "9df94002d0b3863a093168c34e3bed46c49b4269";
var proxypassword = "s7wzk5bjr3c8";
var cookies = fs.readFileSync("./cookies.txt").toString().split("\n")
globaldefs.sniperMysql.query("SELECT * FROM logininfo", function(err, results, fields){
  if(err) console.log("FAILED TO CACHE COOKIES FOR SNIPER USERS! ", err);

  results.forEach(result => {
    cookiesForUser[result.username] = [];
    for(var i = 0; i < 2000; ++i)
    {
      var index = Math.floor( Math.random()*cookies.length );
      var cookie = cookies.pop(index).trim();
      cookiesForUser[result.username].push(cookie);
    }
    cookiesForUser[result.username].push(apikey);
  });
})

// Chat (discord clone)

app.get("/api/images/:rpath/:imgname", function(req, res){
  res.status(200).sendFile(`webfiles/images/${req.params.rpath}/${req.params.imgname}`, {root: __dirname});
});

app.get("/api/avatars/:uname/:imgname", function(req, res){
  res.status(200).sendFile(`webfiles/avatars/${req.params.uname}/${req.params.imgname}`, {root: __dirname});
});

// Favourite Bot

app.post("/api/favbot/bool/killswitch", function(req, res){
  res.status(200).send(":)");
})

app.post("/api/favbot/login/whitelist", function(req, res){
  var username = req.body.username;
  var password = req.body.password;
      globaldefs.favbotMysql.query("SELECT * FROM logininfo WHERE username = ? AND password = ?", [username, password], function(error, results, fields){
        if(error)
        {
          res.status(400).send("_null_");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("__null_");
          }
          else {
            if(results[0].Expired === 0)
            {
              res.status(200).json({payouts: results[0].PayoutsEnabled, templates: results[0].TemplateChangerEnabled, cookies: results[0].UnlimitedCookies});
            }
            else {
              res.status(400).send("__null__");
            }
          }
        }
      });
})

// Ascension Bot API

/*app.get("/api/ascensionbot/version", function(req, res){
  res.send("1.0.9");
})*/

app.post("/api/vortex/version", function(req, res){
  var version = req.body.version;
  globaldefs.clothingBotMysql.query("SELECT allowed FROM versions WHERE version = ?", [version], function(error, results, fields){
    if(error)
    {
      return res.status(400).send("");
    }
    else {
      if(!results.length)
      {
        return res.status(400).send("");
      }

      if(results[0].allowed === 0)
      {
        return res.status(400).send("");
      }

      return res.status(200).send("");
    }
  });
})

app.get("/api/vortex/downloader/:os", function(req, res){
  var os = req.params.os;
  if(os === "windows")
  {
    res.status(200).sendFile("webfiles/files/VortexDownloaderWindows.zip", {root: __dirname});
  }
  else if(os === "linux") {
    res.status(200).sendFile("webfiles/files/VortexDownloaderLinux.zip", {root: __dirname});
  }
  else {
    res.json({message: "Invalid OS."})
  }
});

app.post("/api/ascensionbot/dloader/check_os", function(req, res){
  var hwid = req.body.hwid;
  var username = req.body.username;
  var password = req.body.password;
  const systemOs = req.body.os;
  const type = req.body.type

  globaldefs.clothingBotMysql.query("SELECT username, password, hwid, Expired FROM logininfo WHERE username = ?", [username], function(error, results, fields){
    if(error)
    {
      res.status(400).send("");
    }
    else {
      if(!results.length)
      {
        res.status(400).send("");
      }
      else if(results[0].Expired === 1) {
        res.status(400).send("");
      }
      else if(password !== results[0].password) {
        res.status(400).send("");
      }
      else {
        if(!results[0].hwid)
        {
          if(type === "1")
          {
            globaldefs.clothingBotMysql.query("UPDATE logininfo SET hwid = ? WHERE username = ?", [hwid, username]);
            if(systemOs === "1")
            {
              res.status(200).sendFile("webfiles/files/Vortex_Windows.zip", {root: __dirname});
            }
            else if(systemOs === "0")
            {
              res.status(200).sendFile("webfiles/files/Vortex_Linux.zip", {root: __dirname});
            }
            else {
              res.status(400).send("Unsupported OS");
            }
          }
          else {
            globaldefs.clothingBotMysql.query("UPDATE logininfo SET hwid = ? WHERE username = ?", [hwid, username]);
            if(systemOs === "1")
            {
              res.status(200).sendFile("webfiles/files/beta/Vortex_Windows.zip", {root: __dirname});
            }
            else if(systemOs === "0")
            {
              res.status(200).sendFile("webfiles/files/beta/Vortex_Linux.zip", {root: __dirname});
            }
            else {
              res.status(400).send("Unsupported OS");
            }
          }
        }
        else {
          if(hwid !== results[0].hwid)
          {
            res.status(400).send("");
          }
          else {
            if(type === "1")
            {
              if(systemOs === "1")
              {
                res.status(200).sendFile("webfiles/files/Vortex_Windows.zip", {root: __dirname});
              }
              else if(systemOs === "0")
              {
                res.status(200).sendFile("webfiles/files/Vortex_Linux.zip", {root: __dirname});
              }
              else {
                res.status(400).send("Unsupported OS");
              }
            }
            else {
              if(systemOs === "1")
              {
                res.status(200).sendFile("webfiles/files/beta/Vortex_Windows.zip", {root: __dirname});
              }
              else if(systemOs === "0")
              {
                res.status(200).sendFile("webfiles/files/beta/Vortex_Linux.zip", {root: __dirname});
              }
              else {
                res.status(400).send("Unsupported OS");
              }
            }
          }
        }
      }
    }
  });
})

app.get("/api/ascensionbot/dloader/get_versions", function(req, res){
  // release|beta
  res.send("1.1.2|1.1.3");
})

app.post("/api/vortex/login/hwid", function(req, res){
  var hwid = req.body.hwid;
  var username = req.body.username;
      globaldefs.clothingBotMysql.query("SELECT hwid, Expired FROM logininfo WHERE username = ?", [username], function(error, results, fields){
        if(error)
        {
          res.status(400).send("1");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("2");
          }
          else {
            if(!results[0].hwid)
            {
              globaldefs.clothingBotMysql.query("UPDATE logininfo SET hwid = ? WHERE username = ?", [hwid, username]);
              var encrypted = CryptoJS.AES.encrypt(proxypassword, username);
              res.status(200).send(encrypted.toString());
            }
            else if(results[0].Expired === 1)
            {
              res.status(400).send("4");
            }
            else {
              if(hwid === results[0].hwid)
              {
                var encrypted = CryptoJS.AES.encrypt(proxypassword, username);
                res.status(200).send(encrypted.toString());
              }
              else
              {
                res.status(400).send("6");
              }
            }
          }
        }
      })
})

app.post("/api/vortex/login/whitelist", function(req, res){
  var username = req.body.username;
  var password = req.body.password;
      globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ? AND password = ?", [username, password], function(error, results, fields){
        if(error)
        {
          res.status(400).send("_null_");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("__null_");
          }
          else {
            if(results[0].Expired === 0)
            {
              res.status(200).json({payouts: true, cookies: results[0].UnlimitedCookies, templates: results[0].TemplateChangerEnabled});
            }
            else {
              res.status(400).send("__null__");
            }
          }
        }
      });
})

app.post("/api/vortex/bool/payoutsenabled", function(req, res){
  var username = req.body.username;
      globaldefs.clothingBotMysql.query("SELECT PayoutsEnabled FROM logininfo WHERE username = ?", [username], function(error, results, fields){
        if(error)
        {
          res.status(400).send("null");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("null");
          }
          else {
            if(results[0].PayoutsEnabled === 1)
            {
              res.status(200).send("null");
            }
            else {
              res.status(400).send("null");
            }
          }
        }
      })
})

app.post("/api/vortex/bool/templatechangerenabled", function(req, res){
  var username = req.body.username;
      globaldefs.clothingBotMysql.query("SELECT TemplateChangerEnabled FROM logininfo WHERE username = ?", [username], function(error, results, fields){
        if(error)
        {
          res.status(400).send("null");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("null");
          }
          else {
            if(results[0].TemplateChangerEnabled === 1)
            {
              res.status(200).send("null");
            }
            else {
              res.status(400).send("null");
            }
          }
        }
      })
})

app.post("/api/vortex/bool/unlimitedcookiesenabled", function(req, res){
  var username = req.body.username;
      globaldefs.clothingBotMysql.query("SELECT UnlimitedCookies FROM logininfo WHERE username = ?", [username], function(error, results, fields){
        if(error)
        {
          res.status(400).send("null");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("null");
          }
          else {
            if(results[0].UnlimitedCookies === 1)
            {
              res.status(200).send("null");
            }
            else {
              res.status(400).send("null");
            }
          }
        }
      })
})

app.post("/api/vortex/bypass_captcha", function(req, res){
  var cookie = req.cookies[".ROBLOSECURITY"]
  anticaptcha.getBalance(function (err, balance) {
    if (err) {
        return res.json({taskId: null, message: "Stage 3#1 failed to start."})
    }

    if (balance > 0) {
        anticaptcha.createTaskProxyless(function (err, taskId) {
            if (err) {
                return res.json({taskId: null, message: "Stage 3#2 failed to start."});
            }
            globaldefs.currentCaptchaTasks[taskId] = {"status": "processing", "response": null};
            res.json({taskId: taskId, message: ""});

            anticaptcha.getTaskSolution(taskId, function (err, taskSolution) {
                if (err) {
                    globaldefs.currentCaptchaTasks[taskId] = {"status": "fail", "response": "Stage 3#2 failed to finish."};
                    return;
                }

                try {
                    requests.post({
                    url: "https://api.roblox.com/sign-out/v1",
                    headers: {
                      "User-Agent": "Mozilla/5.0 (iPhone; iPhone10,4; CPU iPhone OS 12.0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Mobile/9B176 ROBLOX iOS App 2.359.249529 Hybrid",
					  "Cookie": `.ROBLOSECURITY=${cookie}`
                    },
                  }, function(error, response, body){
                    if(error)
                    {
                      globaldefs.currentCaptchaTasks[taskId] = {"status": "fail", "response": "Stage 3#3 failed to complete."};
                      return;
                    }

                    requests.post({
                      url: "https://api.roblox.com/captcha/validate/user",
                      headers: {
                        "User-Agent": "Mozilla/5.0 (iPhone; iPhone10,4; CPU iPhone OS 12.0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Mobile/9B176 ROBLOX iOS App 2.359.249529 Hybrid",
                        "X-CSRF-TOKEN": response.headers["x-csrf-token"],
						"Cookie": `.ROBLOSECURITY=${cookie}`
                      },
                      formData: {
                        "g-Recaptcha-Response": taskSolution,
                        "isInvisible": "true"
                      },
                    }, function(error, response, body){
                      if(response.statusCode == 200)
                      {
                        globaldefs.currentCaptchaTasks[taskId] = {"status": "success", "response": "Stage 3#3 complete."};
                      }
                      else {
                        globaldefs.currentCaptchaTasks[taskId] = {"status": "fail", "response": "Stage 3#3 failed to complete."};
                      }
                    });
                  });
                } catch (e) {
                  globaldefs.currentCaptchaTasks[taskId] = {"status": "fail", "response": "Stage 3#3 failed to complete."};
                }
                finally
                {
                  setTimeout((taskId) => {
                    delete globaldefs.currentCaptchaTasks[taskId];
                  }, 30000);
                }
            });
        });
    }
	else
	{
		return res.json({taskId: null, message: "Stage 3#1 failed to start."})
	}
  });
})

app.post("/api/vortex/bypass_result", function(req, res){
  var taskId = req.body.taskId;
  if(taskId in globaldefs.currentCaptchaTasks)
  {
    return res.json(globaldefs.currentCaptchaTasks[taskId]);
  }
  else {
    return res.json({"status": "fail", "response": "Stage 3#0 failed to start."})
  }
})

app.post("/api/vortex/bool/killswitch", function(req, res){
  res.status(200).send(":)");
})

/* Ascension Sniper API */

app.get("/api/ascensionsniper/version", function(req, res){
  res.send("1.0.0");
})

app.post("/api/ascensionsniper/dloader/check_os", function(req, res){
  const systemOs = req.body.os;
  if(systemOs === "windows")
  {
    res.status(200).sendFile("webfiles/files/Titan_Windows.zip", {root: __dirname});
  }
  else if(systemOs === "linux")
  {
    res.status(200).sendFile("webfiles/files/Titan_Linux.zip", {root: __dirname});
  }
  else {
    res.status(400).send("Unsupported OS");
  }
})

app.post("/api/ascensionsniper/login/hwid", function(req, res){
  var hwid = req.body.hwid;
  var username = req.body.username;
      globaldefs.sniperMysql.query("SELECT hwid, Expired FROM logininfo WHERE username = ?", [username], function(error, results, fields){
        if(error)
        {
          res.status(400).send("1");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("2");
          }
          else {
            if(!results[0].hwid)
            {
              globaldefs.sniperMysql.query("UPDATE logininfo SET hwid = ? WHERE username = ?", [hwid, username]);
              res.status(200).send("3");
            }
            else if(results[0].Expired === 1)
            {
              res.status(400).send("4");
            }
            else {
              if(hwid === results[0].hwid)
              {
                res.status(200).send("5");
              }
              else
              {
                res.status(400).send("6");
              }
            }
          }
        }
      })
})

app.post("/api/ascensionsniper/login/whitelist", function(req, res){
  var username = req.body.username;
  var password = req.body.password;
      globaldefs.sniperMysql.query("SELECT username, password, Expired FROM logininfo WHERE username = ? AND password = ?", [username, password], function(error, results, fields){
        if(error)
        {
          res.status(400).send("_null_");
        }
        else {
          if(!results.length)
          {
            res.status(400).send("__null_");
          }
          else {
            if(results[0].Expired === 0)
            {
              res.status(200).send(cookiesForUser[results[0].username]);
            }
            else {
              res.status(400).send("__null__");
            }
          }
        }
      });
})

app.post("/api/ascensionsniper/bool/killswitch", function(req, res){
  res.status(200).send(":)");
})

/* DISCORD */

setInterval(checkWhitelists, 21600000); //21600000
setInterval(checkTitanWhitelists, 21620000)

var blockedHwidResetUsers = {};
var blockedGetroleUsers = {};

bot.on("ready", () => {
  console.log(`${bot.user.username} is online!`);
  setInterval(checkWhitelists, 21600000); //21600000
  setInterval(checkTitanWhitelists, 21620000)
});

bot.on("error", console.error);

bot.on("message", async message => {
  if(message.author.bot) return;
  //if(message.channel.type === "dm") return message.channel.send(`I don't do commands through direct messages, ${message.author}.`);

  let prefix = botconfig.prefix;
  let sniperprefix = "t!"
  const args = message.content.trim().split(' ');
  const cmd = args.shift().toLowerCase();

	if(cmd === "banmultiple")
	{
		if(!args.length)
		{
			var purgeUsage = new Discord.RichEmbed();
			purgeUsage.setTitle("missing args");
			//noServersFoundEmbed.setDescription("No servers with that hostname were found.");
			purgeUsage.setColor(0x00FFFF);
			return message.channel.send(purgeUsage);
		}
		message.guild.fetchMembers().then(guild => {
			guild.members.forEach(member => {
				console.log(member.user.username);
				if(member.user.username === args[0])
				{
					console.log("EQUALS")
					member.ban({days: 7, reason: "spambot"});
				}
			})
		});
	}
    if(cmd === `${prefix}purge`)
    {
      if(!args.length)
      {
        var purgeUsage = new Discord.RichEmbed();
          purgeUsage.setTitle("Missing 1 argument. Usage: cb!purge <number>");
          //noServersFoundEmbed.setDescription("No servers with that hostname were found.");
          purgeUsage.setColor(0x00FFFF);
          return message.channel.send(purgeUsage);
      }
      if(!message.member.hasPermission('MANAGE_MESSAGES'))
      {
        var noPermissionsToUsePurge = new Discord.RichEmbed();
          noPermissionsToUsePurge.setTitle("Error:");
          noPermissionsToUsePurge.setDescription("You don't have permission to use this command.");
          noPermissionsToUsePurge.setColor(0xFF0000);
          return message.channel.send(noPermissionsToUsePurge);
      }
      var messageCount = parseInt(args);
      if(messageCount === 0)
      {
        var cantDeleteZeroMsgs = new Discord.RichEmbed();
          cantDeleteZeroMsgs.setTitle("Error:");
          cantDeleteZeroMsgs.setDescription("You can't delete 0 messages...");
          cantDeleteZeroMsgs.setColor(0xFF0000);
          return message.channel.send(cantDeleteZeroMsgs);
      }
      if(messageCount > 100)
      {
        var tooMuchMsgsToPurge = new Discord.RichEmbed();
          tooMuchMsgsToPurge.setTitle("Error:");
          tooMuchMsgsToPurge.setDescription("Maximum amount of messages that can be deleted is 100, this is a DiscordAPI limitation.");
          tooMuchMsgsToPurge.setColor(0xFF0000);
          return message.channel.send(tooMuchMsgsToPurge);
      }
      var messagesPurged = message.channel.bulkDelete(messageCount, true)
      .then(messages => message.channel.send(`${message.author}, successfully deleted ${messages.size} messages.`))
      .catch(console.error);
      return 1;
    }

    else if(cmd === `${prefix}wladd`)
    {
      currentTime = Date.now();
      expirationTime = currentTime + 2678400000;
      var randPassword = Array(18).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to add people to the whitelist.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      if(typeof args[1] === "undefined")
      {
        return message.channel.send(`${message.author}, refer to #site-info (missing 2nd argument).`);
      }
      if(typeof args[2] === "undefined")
      {
        return message.channel.send(`${message.author}, refer to #site-info (missing 3rd argument).`);
      }
      if(/^\d+$/.test(args[1])) {
        if(args[2] === "0" || args[2] === "1") {
        //proceed with rest of code
          message.channel.send(`Adding ${args[0]} to the whitelist...`);
          //connection.query(`INSERT INTO hwid (computerid, associatedWhitelist, Expired) VALUES (?, ?, 0)`, [args[2], args[0]], function(error, results, fields){
            //if(error){
            //  connection.release();
              //return message.channel.send(`:x: Failed to add ${args[0]} to whitelist (#1). ${error}`);
            //}
            //else {
          globaldefs.clothingBotMysql.query(`INSERT INTO logininfo (username, password, discordId, timeOfPurchase, timeOfExpiration, Expired, PayoutsEnabled) VALUES (?, ?, ?, ?, ?, 0, ?)`, [args[0], randPassword, args[1], currentTime, expirationTime, args[2]], function(error2, results2, fields2){
            if(error2) return message.channel.send(`:x: Failed to add ${args[0]} to whitelist (#2). ${error2}`);

            message.channel.send(`:white_check_mark: Successfully added ${args[0]} to whitelist. The password for his account will be sent to him in the DMs.`);

			var role = message.guild.roles.find('name', 'Clothing Bot')
            var buyer = message.guild.members.get(args[1]);
			buyer.addRole(role);
            if(typeof buyer === "undefined")
            {
              message.channel.send(`:x: Whoopsies, seems like I was unable to send him/her a message. Please send the login details to him/her manually.`);
              return message.author.send(`Send this to the buyer. **Whitelist username: ${args[0]} | Whitelist password: ${randPassword}**`)
            }

            buyer.send(`:wave: Hello there! Thank you for purchasing the program. Your whitelist username is **${args[0]}** and the password is **${randPassword}**. Don't hesitate to contact the owner if you're having problems.`);
            return 1;
          });
            //}
          //});
        }
        else {
          return message.channel.send(`${message.author}, payouts value can only be 0 (disabled) or 1 (enabled)`);
        }
      }
      else {
        return message.channel.send(`${message.author}, a discord user ID only consists of numbers.`);
      }

    }
    else if(cmd === `${prefix}wlrenew`)
    {
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to renew someone's whitelist.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      globaldefs.clothingBotMysql.getConnection(function(err, connection){
        if(err) return message.channel.send(`${message.author}, unable to add user to whitelist due to MySQL error. ${err}`);
        if(/^\d+$/.test(args[0])){
          message.channel.send(`Renewing whitelist... (by discord ID)`);
          connection.query(`SELECT * FROM logininfo WHERE discordId = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided discord ID.`);
            }

            message.channel.send(`Found a whitelist with the provided discord ID, continuing...`);

            if(Date.now() > results[0].timeOfExpiration)
            {
              expirationTime = Date.now() + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired =0  WHERE discordId=?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Clothing Bot whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }
            else {
              expirationTime = results[0].timeOfExpiration + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired = 0 WHERE discordId = ?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Clothing Bot whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }

          });
        }
        else {
          message.channel.send(`Renewing whitelist... (by username)`);
          connection.query(`SELECT * FROM logininfo WHERE username = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided username.`);
            }

            message.channel.send(`Found a whitelist with the provided username, continuing...`);

            if(Date.now() > results[0].timeOfExpiration)
            {
              expirationTime = Date.now() + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired = 0 WHERE username = ?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error2){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Clothing Bot whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }
            else {
              expirationTime = results[0].timeOfExpiration + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, DayNotification = 0, ThreeDayNotification = 0, Expired = 0 WHERE username = ?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error2){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Clothing Bot whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }

          });
        }
      });
    }
	else if(cmd === `${prefix}getrole`)
	{
		if(blockedGetroleUsers[message.author.id] > Date.now())
		{
			return message.channel.send(`[${message.author}] You've already used this command!`);
		}
		message.channel.send(`[${message.author}] Checking for roles...`);
		globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE discordid = ? AND Expired = 0`, [message.author.id],  function(error, results, fields){
            if(error){
              return message.channel.send(`[${message.author}] Failed to get role info.`);
            }

            if(!results.length){
              return message.channel.send(`[${message.author}] You have no roles.`);
			         blockedGetroleUsers[message.author.id] = Date.now() + 86400;;
            }

			var role = message.guild.roles.find('name', 'Clothing Bot');
      if(!message.member) message.channel.send(`[${message.author}] Cannot give role because your status is invisible (proceeding in this state would crash the bot). Change your status to online and use the command again.`);

      blockedGetroleUsers[message.author.id] = Date.now() + 86400;
			message.member.addRole(role);
			message.channel.send(`[${message.author}] Buyer role given.`);

        });
	}
  else if(cmd === `${prefix}getdetails`)
  {
    message.channel.send(`[${message.author}] Getting whitelist details...`);
    globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE discordid = ?`, [message.author.id],  function(error, results, fields){
      if(error)
      {
        return message.channel.send(`[${message.author}] MySQL error, please try using the command again later.`)
      }
      else {
        if(!results.length)
        {
          return message.channel.send(`[${message.author}] You have no whitelists associated with your Discord ID.`);
        }
        else {
          sendStr = "\n";
          results.forEach(result => {
            sendStr += `\`${result.username}:${result.password}\` | Expired: ${(result.Expired ? "true" : "false")}\n`
          });
          message.channel.send(`[${message.author}] Whitelist details have been sent to you in a DM.`);
          return message.author.send(`Here are all of your whitelist details: ${sendStr}`);
        }
      }
    });
  }
    else if(cmd === `${prefix}resethwid`)
    {
		if(blockedHwidResetUsers[message.author.id] > Date.now())
		{
			return message.channel.send(`[${message.author}] You can only reset hwid once per hour.`);
		}


          message.channel.send(`[${message.author}] Resetting hwid...`);
          globaldefs.clothingBotMysql.query(`SELECT * FROM logininfo WHERE discordid = ? AND Expired = 0`, [message.author.id],  function(error, results, fields){
            if(error){
              return message.channel.send(`[${message.author}] Failed to reset hwid. (#1). ${error}`);
            }

            if(!results.length){

              return message.channel.send(`[${message.author}] Failed to find any whitelists associated with your account.`);
            }

			blockedHwidResetUsers[message.author.id] = Date.now() + 86400;
			results.forEach(result => {
				globaldefs.clothingBotMysql.query("UPDATE logininfo SET hwid = NULL WHERE username = ?", [result.username], function(error2, results2, fields2){
				if(error2)
				{
					 message.channel.send(`[${message.author}] MySQL Error: ${error}`);
				}
				else
				{
					message.channel.send(`[${message.author}] Successfully reset hwid for ${result.username}`);
				}
			})
		  });

        });
    }
    else if(cmd === `${prefix}wlenabletemplatechanger`)
    {
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to enable template changer.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      globaldefs.clothingBotMysql.getConnection(function(err, connection){
        if(err) return message.channel.send(`${message.author}, MySQL error. ${err}`);
        if(/^\d+$/.test(args[0])){
          message.channel.send(`Enabling template changer for whitelist... (by discord ID)`);
          connection.query(`SELECT * FROM logininfo WHERE discordId = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to enable template changer for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided discord ID.`);
            }

            message.channel.send(`Found a whitelist with the provided discord ID, continuing...`);



			     connection.query("UPDATE logininfo SET TemplateChangerEnabled = 1 WHERE username = ?", [results[0].username], function(error2, results2, fields2){
				         connection.release();
				         if(error2)
				         {
					              message.channel.send(`MySQL Error: ${error}`);
				         }
				         else
				         {
					            message.channel.send(`:white_check_mark: Successfully enabled template changer for ${results[0].username}`);
				         }
			        })

          });
        }
        else {
          message.channel.send(`Enabling template changer for whitelist... (by username)`);
          connection.query(`SELECT * FROM logininfo WHERE username = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to enable template changer for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided username.`);
            }

            message.channel.send(`Found a whitelist with the provided username, continuing...`);



           connection.query("UPDATE logininfo SET TemplateChangerEnabled = 1 WHERE username = ?", [results[0].username], function(error2, results2, fields2){
                 connection.release();
                 if(error2)
                 {
                        message.channel.send(`MySQL Error: ${error}`);
                 }
                 else
                 {
                      message.channel.send(`:white_check_mark: Successfully enabled template changer for ${results[0].username}`);
                 }
              })

          });
        }
      });
    }

    else if(cmd === `${prefix}wlenableunlimitedcookies`)
    {
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to enable unlimited cookies.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      globaldefs.clothingBotMysql.getConnection(function(err, connection){
        if(err) return message.channel.send(`${message.author}, MySQL error. ${err}`);
        if(/^\d+$/.test(args[0])){
          message.channel.send(`Enabling unlimited cookies for whitelist... (by discord ID)`);
          connection.query(`SELECT * FROM logininfo WHERE discordId = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to unlimited cookies for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided discord ID.`);
            }

            message.channel.send(`Found a whitelist with the provided discord ID, continuing...`);



			     connection.query("UPDATE logininfo SET UnlimitedCookies = 1 WHERE username = ?", [results[0].username], function(error2, results2, fields2){
				         connection.release();
				         if(error2)
				         {
					              message.channel.send(`MySQL Error: ${error}`);
				         }
				         else
				         {
					            message.channel.send(`:white_check_mark: Successfully enabled unlimited cookies for ${results[0].username}`);
				         }
			        })

          });
        }
        else {
          message.channel.send(`Enabling unlimited cookies for whitelist... (by username)`);
          connection.query(`SELECT * FROM logininfo WHERE username = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to enable unlimited cookies for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find a whitelist with the provided username.`);
            }

            message.channel.send(`Found a whitelist with the provided username, continuing...`);



           connection.query("UPDATE logininfo SET UnlimitedCookies = 1 WHERE username = ?", [results[0].username], function(error2, results2, fields2){
                 connection.release();
                 if(error2)
                 {
                        message.channel.send(`MySQL Error: ${error}`);
                 }
                 else
                 {
                      message.channel.send(`:white_check_mark: Successfully enabled unlimited cookies for ${results[0].username}`);
                 }
              })

          });
        }
      });
    }

    else if(cmd === `${prefix}wlactive`)
    {
	  if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to check one's whitelist status.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info`)
      }
      globaldefs.clothingBotMysql.getConnection(function(err, connection){
        if(err) return message.channel.send(`${message.author}, unable to check if whitelist is active due to MySQL connection error. ${err}`);

        if(/^\d+$/.test(args[0])){
          connection.query(`SELECT Expired FROM logininfo WHERE discordId = ?`, [args[0]], function(error, results, fields){
            if(error) return message.channel.send(`${message.author}, unable to check if whitelist is active due to MySQL error. ${err}`);
            else
            {
              if(!results.length) return message.channel.send(`:x: Failed to find a whitelist with the specified discord ID.`);
              else {
                if(results[0].Expired === 0)
                {
                  return message.channel.send(`Whitelist for ${args[0]} is active.`);
                }
                else {
                  return message.channel.send(`Whitelist for ${args[0]} is inactive.`);
                }
              }
            }

          });
        }
        else {
          connection.query(`SELECT Expired FROM logininfo WHERE username = ?`, [args[0]], function(error, results, fields){
            if(error) return message.channel.send(`${message.author}, unable to check if whitelist is active due to MySQL error. ${err}`);
            else
            {
              if(!results.length) return message.channel.send(`:x: Failed to find a whitelist with the specified discord ID.`);
              else {
                if(results[0].Expired === 0)
                {
                  return message.channel.send(`Whitelist for ${args[0]} is active.`);
                }
                else {
                  return message.channel.send(`Whitelist for ${args[0]} is inactive.`);
                }
              }
            }

          });
        }
      });
    }

    /*else if(cmd === `${prefix}purchase`)
    {
      if(!args.length) return message.channel.send("Cannot purchase without a license key! Use `cb!purchase license-key`");

      message.delete();
      message.channel.send(`[${message.author}] Validating license key...`);
      globaldefs.clothingBotMysql.query("SELECT * FROM purchasecodes WHERE code = ?", [args[0]], function(error, results, fields){
        if(error) return message.channel.send(`[${message.author}] Failed to validate the license key due to an error, try again later.`);

        if(!results.length) return message.channel.send(`[${message.author}] Invalid license key.`);

        if(results[0].usedByDiscordId != null && results[0].usedByDiscordId != message.author.id) return message.channel.send(`[${message.author}] This license key does not belong to you.`);

        if(results[0].used === 1) return message.channel.send(`[${message.author}] This license key has already been used.`);

        // Lock the code for one user...
        globaldefs.clothingBotMysql.query("UPDATE purchasecodes SET usedByDiscordId = ?", [message.author.id]);

        // Detect the type of the license key
        try {
          purchaseHandlers[args[0][0]](message);
        } catch (e) {
          return;
        }
      });
    }*/

    else if(cmd === `${sniperprefix}wladd`)
    {
      currentTime = Date.now();
      expirationTime = currentTime + 2678400000;
      var randPassword = Array(18).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
      console.log(randPassword)
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to add people to the whitelist.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      if(typeof args[1] === "undefined")
      {
        return message.channel.send(`${message.author}, refer to #site-info (missing 2nd argument).`);
      }
      if(/^\d+$/.test(args[1])) {
          globaldefs.sniperMysql.query(`INSERT INTO logininfo (username, password, discordId, timeOfPurchase, timeOfExpiration, Expired) VALUES (?, ?, ?, ?, ?, 0)`, [args[0], randPassword, args[1], currentTime, expirationTime], function(error2, results2, fields2){
            if(error2) return message.channel.send(`:x: Failed to add ${args[0]} to whitelist (#2). ${error2}`);

            message.channel.send(`:white_check_mark: Successfully added ${args[0]} to whitelist. The password for his account will be sent to him in the DMs.`);

            buyer = message.guild.members.get(args[1]);
            if(typeof buyer === "undefined")
            {
              message.channel.send(`:x: Whoopsies, seems like I was unable to send him/her a message. Please send the login details to him/her manually.`);
              return message.author.send(`Send this to the buyer. **Whitelist username: ${args[0]} | Whitelist password: ${randPassword}**`)
            }

            buyer.send(`:wave: Hello there! Thank you for purchasing Titan Limiteds Sniper. Your whitelist username is **${args[0]}** and the password is **${randPassword}**. Don't hesitate to contact the owner if you're having problems.`);
            return 1;
          });
      }
      else {
        return message.channel.send(`${message.author}, a discord user ID only consists of numbers.`);
      }

    }

    else if(cmd === `${sniperprefix}wlrenew`)
    {
      if(!message.member.hasPermission("ADMINISTRATOR"))
      {
        return message.channel.send(`${message.author}, you don't have permission to renew someone's whitelist.`);
      }
      if(!args.length)
      {
        return message.channel.send(`${message.author}, refer to #site-info.`);
      }
      globaldefs.sniperMysql.getConnection(function(err, connection){
        if(err) return message.channel.send(`${message.author}, unable to add user to whitelist due to MySQL error. ${err}`);
        if(/^\d+$/.test(args[0])){
          message.channel.send(`Renewing Titan Limiteds Sniper whitelist... (by discord ID)`);
          connection.query(`SELECT * FROM logininfo WHERE discordId = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to renew Titan Limiteds Sniper whitelist for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find an Titan Limiteds Sniper whitelist with the provided discord ID.`);
            }

            message.channel.send(`Found an Titan Limiteds Sniper whitelist with the provided discord ID, continuing...`);

            if(Date.now() > results[0].timeOfExpiration)
            {
              expirationTime = Date.now() + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, Expired = 0  WHERE discordId=?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew Titan Limiteds Sniper whitelist for ${args[0]} (#2). ${error2}`);
               }

               message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

               buyer = message.guild.members.get(results[0].discordId);
               if(typeof buyer !== "undefined")
               {
                 return buyer.send(`Your Titan Limiteds Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }
            else {
              expirationTime = results[0].timeOfExpiration + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, Expired = 0 WHERE discordId = ?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

               message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

               buyer = message.guild.members.get(results[0].discordId);
               if(typeof buyer !== "undefined")
               {
                 return buyer.send(`Your Titan Limiteds Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Ascension Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
                  }
                })
              });
            }

          });
        }
        else {
          message.channel.send(`Renewing Titan Limiteds Sniper whitelist... (by username)`);
          connection.query(`SELECT * FROM logininfo WHERE username = ?`, [args[0]],  function(error, results, fields){
            if(error){
              connection.release();
              return message.channel.send(`:x: Failed to renew Titan Limiteds Sniper whitelist for ${args[0]} (#1). ${error}`);
            }

            if(!results.length){
              connection.release()
              return message.channel.send(`:x: Failed to find an Titan Limiteds Sniper whitelist with the provided discord ID.`);
            }

            message.channel.send(`Found an Titan Limiteds Sniper whitelist with the provided discord ID, continuing...`);

            if(Date.now() > results[0].timeOfExpiration)
            {
              expirationTime = Date.now() + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, Expired = 0  WHERE username=?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew Titan Limiteds Sniper whitelist for ${args[0]} (#2). ${error2}`);
               }

               message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

               buyer = message.guild.members.get(results[0].discordId);
               if(typeof buyer !== "undefined")
               {
                 return buyer.send(`Your Titan Limiteds Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your whitelist has been renewed. Enjoy another month of botting!`);
                  }
                })
              });
            }
            else {
              expirationTime = results[0].timeOfExpiration + 2678400000;
              connection.query(`UPDATE logininfo SET timeOfExpiration = ?, Expired = 0 WHERE username = ?`, [expirationTime, args[0]],  function(error2, results2, fields2){
                if(error){
                  connection.release();
                  return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#2). ${error2}`);
               }

               message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

               buyer = message.guild.members.get(results[0].discordId);
               if(typeof buyer !== "undefined")
               {
                 return buyer.send(`Your Titan Limiteds Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
               }

                message.channel.send(`1st part successfully complete, now onto 2nd part.`);
                connection.query(`UPDATE hwid SET Expired = 0 WHERE associatedWhitelist = ?`, [results[0].username],  function(error3, results3, fields3){
                  connection.release()
                  if(error3) return message.channel.send(`:x: Failed to renew whitelist for ${args[0]} (#3). ${error2}`);

                  message.channel.send(`:white_check_mark: Whitelist successfully renewed!`);

                  buyer = message.guild.members.get(results[0].discordId);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`Your Ascension Sniper whitelist has been renewed. Enjoy another month of sniping limiteds!`);
                  }
                })
              });
            }

          });
        }
      });
    }

    else if(cmd === `${prefix}discordid`)
    {
      var mention = message.mentions.members.first();
      if(!mention)
      {
        return message.channel.send(`Your discord ID is ${message.author.id}`);
      }
      else {
        return message.channel.send(`${mention}'s discord ID is ${mention.id}`);
      }
    }
    else if(cmd === `${prefix}ping`) {
      return message.channel.send(`pong`);
    }
});



function checkWhitelists()
{
  console.log("Starting to check whitelists.")
  var currentUsername, currentDiscordID;
  var whitelistAmounts = {};
    globaldefs.clothingBotMysql.query("SELECT * FROM logininfo", function(error, results, fields){
      if(error)
      {
        console.log(`Error while sending 1st query to MySQL server. ${error}`);
      }
      else {
        for(var i = 0; i < results.length; i++)
        {
		    try {
          currentUsername = results[i].username;
		       currentDiscordID = results[i].discordId;

           if(!whitelistAmounts.hasOwnProperty(currentDiscordID)) { whitelistAmounts[currentDiscordID] = {expired: 0, all: 0}; }
           whitelistAmounts[currentDiscordID].all += 1

          if(results[i].Expired === 0)
          {
            console.log(`Onto whitelist number ${i}: ${currentUsername}`);
            currentTime = Date.now();
            timeLeft = results[i].timeOfExpiration - currentTime;
            if(timeLeft < 0)
            {
              whitelistAmounts[currentDiscordID].expired += 1
              console.log(`Whitelist ${currentUsername} has expired, disabling it.`);
              globaldefs.clothingBotMysql.query(`UPDATE logininfo SET Expired = 1 WHERE username = ?`, [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Error while sending 1st query to MySQL server. ${error2}`);
                }
                else {
                  console.log(`Whitelist login for ${currentUsername} has been disabled. Disabling all hwid whitelists associated with that username.`);
                  globaldefs.clothingBotMysql.query(`UPDATE hwid SET Expired = 1 WHERE associatedWhitelist = ?`, [currentUsername], function(error3, results3, fields3){
                    if(error3)
                    {
                      console.log(`Error while disabling hwid whitelist for the current user. ${error3}`);
                    }
                    else{
                      console.log(`Successfully disabled whitelist for ${currentUsername}`);
                      console.log(`Sending him a notification on discord....`);

                      buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                      if(typeof buyer !== "undefined")
                      {
                        return buyer.send(`:x: Your Clothing Bot whitelist (\`${currentUsername}\`) has expired. Contact the owner if you wish to renew it.`);
                      }
                      else {
                        console.log(`FAILED TO SEND NOTIFICATION (Whitelist expired). Discord ID: ${currentDiscordID}`);
                      }

                    }
                  });
                }
              });
            }
            else if(timeLeft < 86400000 && results[i].DayNotification === 0)
            {
              console.log(`Whitelist ${currentUsername} expires in under a day, notifying the owner and disabling further 1 day notifications.`);
              globaldefs.clothingBotMysql.query("UPDATE logininfo SET DayNotification = 1 WHERE username = ?", [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Failed to disable 1 day notifications for the current user. ${error2}`);
                }
                else
                {
                  console.log(`Disabled 1 day notifications for ${currentUsername}. Sending him a notification.`);
                  buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`:alarm_clock: Your Clothing Bot whitelist (\`${currentUsername}\`) will expire in a day. Contact the owner if you wish to renew it.`);
                  }
                  else {
                    console.log(`FAILED TO SEND NOTIFICATION (1 day left). Discord ID: ${currentDiscordID}`);
                  }
                }
              });
            }
            else if(timeLeft < 259200000 && results[i].ThreeDayNotification === 0)
            {
              console.log(`Whitelist ${currentUsername} expires in 3 days, notifying the owner and disabling further 3 day notifications.`);
              globaldefs.clothingBotMysql.query("UPDATE logininfo SET ThreeDayNotification = 1 WHERE username = ?", [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Failed to disable 3 day notifications for the current user. ${error2}`);
                }
                else
                {
                  console.log(`Disabled 3 day notifications for ${currentUsername}. Sending him a notification.`);
                  buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`:alarm_clock: Your Clothing Bot whitelist (\`${currentUsername}\`) will expire in three days. Contact the owner if you wish to renew it.`);
                  }
                  else {
                    console.log(`FAILED TO SEND NOTIFICATION (3 day left). Discord ID: ${currentDiscordID}`);
                  }
                }
              });
            }
            else {
              console.log(`Whitelist ${currentUsername} won't expire anytime soon, skipping.`);
            }
          }
          else {
            console.log(`Whitelist ${currentUsername} is expired, skipping.`);
            whitelistAmounts[currentDiscordID].expired += 1
          }
        }
		catch(e)
		{
			console.log("Backend exception!");
			console.log(e);
		}
		}
    /* now loop all keys in whitelistAmounts */
    Object.keys(whitelistAmounts).forEach(key => {
      if(whitelistAmounts[key].expired == whitelistAmounts[key].all)
      {
          globaldefs.clothingBotMysql.query("UPDATE users SET isBuyer = 1 WHERE username = ?", [key]);

          var guild = bot.guilds.get(globaldefs.publicGuildId);
          var role = guild.roles.find('name', 'Clothing Bot')
          var buyer = guild.members.get(key);
          if(buyer) buyer.removeRole(role);
      }
    })
      }
      });
}

function checkTitanWhitelists()
{
  console.log("Starting to check whitelists.")
  var currentUsername, associatedUser;
  var whitelistAmounts = {};
    globaldefs.sniperMysql.query("SELECT * FROM logininfo", function(error, results, fields){
      if(error)
      {
        console.log(`Error while sending 1st query to MySQL server. ${error}`);
      }
      else {
        for(var i = 0; i < results.length; i++)
        {
		try {
          currentUsername = results[i].username;
		  associatedUser = results[i].associatedUser;
      if(!whitelistAmounts.hasOwnProperty(associatedUser)) { whitelistAmounts[associatedUser] = {expired: 0, all: 0, discordId: results[i].discordId}; }
      whitelistAmounts[associatedUser].all += 1

          if(results[i].Expired === 0)
          {
            console.log(`Titan: Onto whitelist number ${i}: ${currentUsername}`);
            currentTime = Date.now();
            timeLeft = results[i].timeOfExpiration - currentTime;
            if(timeLeft < 0)
            {
              whitelistAmounts[associatedUser].expired += 1
              console.log(`Titan: Whitelist ${currentUsername} has expired, disabling it.`);
              globaldefs.sniperMysql.query(`UPDATE logininfo SET Expired = 1 WHERE username = ?`, [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Titan: Error while sending 1st query to MySQL server. ${error2}`);
                }
                else {
                  console.log(`Titan: Whitelist login for ${currentUsername} has been disabled. Disabling all hwid whitelists associated with that username.`);
                  globaldefs.sniperMysql.query(`UPDATE hwid SET Expired = 1 WHERE associatedWhitelist = ?`, [currentUsername], function(error3, results3, fields3){
                    if(error3)
                    {
                      console.log(`Titan: Error while disabling hwid whitelist for the current user. ${error3}`);
                    }
                    else{
                      console.log(`Titan: Successfully disabled whitelist for ${currentUsername}`);
                      console.log(`Titan: Sending him a notification on discord....`);

                      buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                      if(typeof buyer !== "undefined")
                      {
						            var guild = bot.guilds.get(globaldefs.publicGuildId);
						            var role = guild.roles.find('name', 'Clothing Bot')
						            if(buyer) buyer.removeRole(role);
                        return buyer.send(`:x: Your Titan whitelist (\`${currentUsername}\`) has expired. Contact the owner if you wish to renew it.`);
                      }
                      else {
                        console.log(`Titan: FAILED TO SEND NOTIFICATION (Whitelist expired). Discord ID: ${currentDiscordID}`);
                      }

                    }
                  });
                }
              });
            }
            else if(timeLeft < 86400000 && results[i].DayNotification === 0)
            {
              console.log(`Titan: Whitelist ${currentUsername} expires in under a day, notifying the owner and disabling further 1 day notifications.`);
              globaldefs.sniperMysql.query("UPDATE logininfo SET DayNotification = 1 WHERE username = ?", [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Titan: Failed to disable 1 day notifications for the current user. ${error2}`);
                }
                else
                {
                  console.log(`Titan: Disabled 1 day notifications for ${currentUsername}. Sending him a notification.`);
                  buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`:alarm_clock: Your Titan whitelist (\`${currentUsername}\`) will expire in a day. Contact the owner if you wish to renew it.`);
                  }
                  else {
                    console.log(`Titan: FAILED TO SEND NOTIFICATION (1 day left). Discord ID: ${currentDiscordID}`);
                  }
                }
              });
            }
            else if(timeLeft < 259200000 && results[i].ThreeDayNotification === 0)
            {
              console.log(`Titan: Whitelist ${currentUsername} expires in 3 days, notifying the owner and disabling further 3 day notifications.`);
              globaldefs.sniperMysql.query("UPDATE logininfo SET ThreeDayNotification = 1 WHERE username = ?", [currentUsername], function(error2, results2, fields2){
                if(error2)
                {
                  console.log(`Titan: Failed to disable 3 day notifications for the current user. ${error2}`);
                }
                else
                {
                  console.log(`Titan: Disabled 3 day notifications for ${currentUsername}. Sending him a notification.`);
                  buyer = bot.guilds.get(globaldefs.publicGuildId).members.get(currentDiscordID);
                  if(typeof buyer !== "undefined")
                  {
                    return buyer.send(`:alarm_clock: Your Titan whitelist (\`${currentUsername}\`) will expire in three days. Contact the owner if you wish to renew it.`);
                  }
                  else {
                    console.log(`Titan: FAILED TO SEND NOTIFICATION (3 day left). Discord ID: ${currentDiscordID}`);
                  }
                }
              });
            }
            else {
              console.log(`Titan: Whitelist ${currentUsername} won't expire anytime soon, skipping.`);
            }
          }
          else
		  {
        console.log(`Titan: Whitelist ${currentUsername} is expired, skipping.`);
        whitelistAmounts[associatedUser].expired += 1
		  }
        }
		catch(e)
		{
			console.log("Backend exception!");
			console.log(e);
		}
		}
    /* now loop all keys in whitelistAmounts */
    Object.keys(whitelistAmounts).forEach(key => {
        if(whitelistAmounts[key].expired == whitelistAmounts[key].all)
        {
          globaldefs.clothingBotMysql.query("UPDATE users SET isBuyer = 0 WHERE username = ?", [key]);

          var guild = bot.guilds.get(globaldefs.publicGuildId);
          var role = guild.roles.find('name', 'Clothing Bot')
          var buyer = guild.members.get(whitelistAmounts[key].discordId);
          if(buyer) buyer.removeRole(role);
        }
      })
    }
  });
}

function secondsToHms(d) {
    d = Number(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    return h + " hours, " + ('' + m).slice(-2) + " minutes, " + ('' + s).slice(-2) + " seconds."; //('' + h).slice(-2)
}
