const fs = require("fs")
var tf = require('@tensorflow/tfjs-node');
const BDAFaker = require("./includes/faker/bda");
const UserAgent = require("./includes/faker/user-agent");
const requests = require("request-promise");
var globaldefs = require("./globaldefs");
var {spawn} = require("child_process");
var path = require("path");

const learningRate = 0.0001;
const optimizer = tf.train.adam(learningRate);
const ABUSE_WEBHOOK = "https://discordapp.com/api/webhooks/728945077619261461/122-AvlacQHx3THq68CUhEfPrGv0J4-iP78RTqB5d72pcFvW3YjbshaZS3zgWBaeyGAX";
const MAX_PREDICT_THREADS = 1;
const PREDICT_PORT_START = 4000;
const COLLECT_IMAGE_DATA = true; // enable when new fc images need to be collected

var model = null;
var vortexTasks = {};
var fcSolverTasks = {};
var fcClients = {};
var fcTasksForEachWorker = {};
var taskIdToUsername = {};
var crowdedWorkerUsers = [];
var tasksForEachUser = {};

// new solver
var imagesForGame = {};
var botInfoForWhitelist = {
  ClothingBot: {
  }
}
var abuseReportTimes = {};

var predictPorts = [];
for(var i = 1; i <= MAX_PREDICT_THREADS; i++) {
  var port = PREDICT_PORT_START+i;
  var ls = spawn(process.argv[0], [path.join(__dirname, "predict_thread.js"), port]);
  ls.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  ls.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  predictPorts.push(port);
}

function sendAbuseReport(reason, whitelistInfo) {
  // store the time when abuse report was sent
  // also create object for whitelist name if it's
  // not in abuseReportTimes
  if(!abuseReportTimes.hasOwnProperty(whitelistInfo.username)) abuseReportTimes[whitelistInfo.username] = {}
  if(!abuseReportTimes[whitelistInfo.username].hasOwnProperty(reason)) abuseReportTimes[whitelistInfo.username][reason] = Date.now();
  if( (Date.now() - abuseReportTimes[whitelistInfo.username][reason]) < 300000 ) return;
  
  var abuseEmbed = {
    color: 2237013,
    fields: [
      {
        name: "Abuse Report",
        value: `Abuse detected for whitelist **${whitelistInfo.username}** on instance \`${whitelistInfo.instanceID}\` - ${reason}`,
        inline: false
      }
    ]
  };
  // build the additional field that will be added to embed later
  var instances = Object.keys(botInfoForWhitelist[whitelistInfo.type][whitelistInfo.username].instances);
  var instancesField = {
    name: `Instances (${instances.length})`,
    value: "",
    inline: false
  }
  instances.forEach(instanceID => {
    var accounts = botInfoForWhitelist[whitelistInfo.type][whitelistInfo.username].instances[instanceID].accountCount;
    instancesField.value += `\`${instanceID}\` - ${accounts} account${accounts > 1 ? "s" : ""}\n`;
  });

  abuseEmbed.fields.push(instancesField);

  abuseReportTimes[whitelistInfo.username][reason] = Date.now();
  requests.post({url: ABUSE_WEBHOOK, json: {embeds: [abuseEmbed]}}).catch(e => {});
}

module.exports = function(app, io) {
  async function loadModel() {
    model = await tf.loadLayersModel("file://./model/model.json");
    model.compile({
      optimizer: optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
  }
  loadModel();

  // FC solver
  io.use((socket, next) => {
    var {username, password, hwid, accounts, id, type} = socket.request.headers;
    // this check isn't supposed to pass unless someone manually tinkers with backend
    /*if(!botInfoForWhitelist.hasOwnProperty(type)) {
      socket.errormsg = "Backend error, product doesn't exist. Update your bot to fix this issue.";
      return next();
    }*/
    if(!type) type = "ClothingBot";
    socket.userinfo = {
      username,
      password,
      hwid,
      instanceID: id,
      type
    }

	
    globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [username], (error, results, _) => {
      if(error) {
        socket.errormsg = "Internal server error while authenticating.";
        return next();
        //return socket.disconnect();
      }
      if(!results.length) {
        socket.errormsg = "Whitelist doesn't exist in the database.";
        return next();
        //return socket.disconnect();
      } 
      if(results[0].password !== password) {
        socket.errormsg = "Failed to authenticate.";
        return next();
        //return socket.disconnect();
      }
      if(results[0].hwid !== hwid) {
        socket.errormsg = "Failed to authenticate.";
        return next();
        //return socket.disconnect();
      }
      if(results[0].Expired === 1) {
        socket.errormsg = "Whitelist has expired.";
        return next();
        //return socket.disconnect();
      }

      // successful connection, update botInfoForWhitelist
      if(!botInfoForWhitelist[socket.userinfo.type].hasOwnProperty(socket.userinfo.username)) {
        botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username] = {
          instances: {},
          activeAccounts: {},
          addons: {
            unlimitedCookies: results[0].UnlimitedCookies
          }
        }
      }
      // check if instance is stored in instances
      if(!botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].instances.hasOwnProperty(id)) botInfoForWhitelist[type][socket.userinfo.username].instances[id] = {accountCount: accounts};

      socket.authenticated = true;
      next();
    })
  }).on("connection", socket => {
    socket.BDAGen = new BDAFaker();
    socket.clearImagesTimeout = null;

    socket.interval = setInterval((socket) => {
      globaldefs.clothingBotMysql.query("SELECT * FROM logininfo WHERE username = ?", [socket.userinfo.username], (error, results, _) => {
        if(error) {
          return;
          //return socket.disconnect();
        }
  
        if(!results.length) {
          socket.authenticated = false;
          socket.errormsg = "Account doesn't exist in the database.";
          return;
        } 
        if(results[0].password !== socket.userinfo.password) {
          socket.authenticated = false;
          socket.errormsg = "Failed to authenticate.";
          return;
        }
        if(results[0].hwid !== socket.userinfo.hwid) {
          socket.authenticated = false;
          socket.errormsg = "Failed to authenticate.";
          return;
        }
        if(results[0].Expired === 1) {
          socket.authenticated = false;
          socket.errormsg = "Whitelist has expired.";
          return;
        }
        
        if(botInfoForWhitelist[socket.userinfo.type].hasOwnProperty(socket.userinfo.username))
          botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].addons.unlimitedCookies = results[0].UnlimitedCookies;

        socket.authenticated = true;
      });
    }, 5*6*1000, socket);

    socket.on("bottingAccount", (account, accountCount, consoleID) => {
      if(!botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].instances.hasOwnProperty(socket.userinfo.instanceID)) botInfoForWhitelist[type][socket.userinfo.username].instances[socket.userinfo.instanceID] = {accountCount: 0};
      botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].instances[socket.userinfo.instanceID].accountCount = accountCount;

      if(botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts.hasOwnProperty(account.cookie)) {
        // check if the instance id is same as it is for the cookie
        if(botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie].runningOnInstanceID !== socket.userinfo.instanceID) {
          // block the socket
          // send abuse report
          sendAbuseReport("running multiple instances with the same ROBLOX account.", socket.userinfo);
        }

        clearTimeout(botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie].timeout);
        botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie].timeout = setTimeout((socket, account) => {
          delete botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie];
        }, 30000, socket, account)
      } else {
        // store what instance the cookie is running on
        // clear it after 5 minutes of no updates
        botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie] = {
          runningOnInstanceID: socket.userinfo.instanceID,
          initialConsoleID: consoleID,
          timeout: null
        };
        botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie].timeout = setTimeout((socket, account) => {
          delete botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie];
        }, 30000, socket, account)
      }

      // check if someone is using more than 3 cookies with the unlimited cookies addon
      var activeAccountsTotal = Object.keys(botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts).length;
      if(activeAccountsTotal > 3 && !botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].addons.unlimitedCookies) {
        sendAbuseReport("running more than 3 accounts across multiple instances without Unlimited Cookies addon.", socket.userinfo);
      }

      // check if someone is running 1 cookie multiple times on the same instance
      if(botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].activeAccounts[account.cookie].initialConsoleID !== consoleID) {
        sendAbuseReport("running the same cookie in multiple consoles.", socket.userinfo);
      }

    }).on("newBda", () => {
      if(!socket.authenticated) return socket.emit("disconnected", {status: "fail", message: socket.errormsg, ua: ""});

      var user_agent = new UserAgent({os: "Win32"});
      socket.BDAGen.GenerateBDA(user_agent);

      return socket.emit("newBda", {status: "success", message: socket.BDAGen.bda, ua: user_agent.data.userAgent});
    }).on("predict", (image, rot, image_name, token) => {
      if(!socket.authenticated) return socket.emit("disconnected", {status: "fail", message: socket.errormsg, rot: rot, image_name: image_name});

      requests.post({
        url: `http://localhost:${predictPorts[Math.floor(Math.random() * predictPorts.length)]}/api/internal/predict_img`,
        form: {secret: globaldefs.internalAPIsecret, image: image},
        json: true,
        timeout: 7000
      }).then(response => {
        if(COLLECT_IMAGE_DATA) {
          if(!imagesForGame.hasOwnProperty(token)) imagesForGame[token] = {};
          if(!imagesForGame[token].hasOwnProperty(image_name)) imagesForGame[token][image_name] = [];
          imagesForGame[token][image_name].push({percent: response.message, rot: rot, image: image});
  
          // if the timeout still exists for the token, reset it
          if(socket.clearImagesTimeout) clearTimeout(socket.clearImagesTimeout);
          socket.clearImagesTimeout = setTimeout((token) => {
              delete imagesForGame[token];
          }, 15000, token);
        }

        return socket.emit("predict", {...response, rot: rot, image_name: image_name});
      }).catch(error => {
        return socket.emit("predict", {status: "fail", message: "Internal server error", rot: rot, image_name: image_name});
      })
    }).on("notSolved", token => {
      if(!COLLECT_IMAGE_DATA) return;
      if(!imagesForGame.hasOwnProperty(token)) return;

      Object.keys(imagesForGame[token]).forEach(img_name => {
        // if there are less than 7 images, don't save them (there is a missing rotation)
        if(imagesForGame[token][img_name].length < 6) return;

        // sort image array
        imagesForGame[token][img_name].sort(function(a, b){
          return b.percent - a.percent;
        });
        // save all the images
        imagesForGame[token][img_name].forEach((prediction, posInArray) => {
          console.log(prediction);
          // 1st element is the correct image
          if(posInArray === 0) fs.writeFileSync(`./new_data/images/true/${img_name}_${prediction.rot}.png`, Buffer.from(prediction.image.toString(), "base64"));
          else fs.writeFileSync(`./new_data/images/false/${img_name}_${prediction.rot}.png`, Buffer.from(prediction.image.toString(), "base64"))
        });
      });
    }).on("disconnect", () => {
      // clear interval & instance
      clearInterval(socket.interval);

      delete botInfoForWhitelist[socket.userinfo.type][socket.userinfo.username].instances[socket.userinfo.instanceID];
    }).on("error", (error) => {
	    socket.errormsg = error.message;
    });

  });
}
