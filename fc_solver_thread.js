const fs = require("fs");
const {FunCaptcha} = require("./includes/funcaptcha/funcaptcha");
const bodyParser = require("body-parser")
const requests = require("request-promise");
const Jimp = require("jimp");
var tf = require('@tensorflow/tfjs-node');
var globaldefs = require('./globaldefs');
const express = require("express")

// load model
const learningRate = 0.0001;
const optimizer = tf.train.adam(learningRate);
const port = parseInt(process.argv[2]);
var model = null;
async function loadModel() {
  model = await tf.loadLayersModel("file://./model/model.json");
	model.compile({
		optimizer: optimizer,
		loss: 'categoricalCrossentropy',
		metrics: ['accuracy']
  });
}
loadModel()

function removeTaskFromList(taskId) {
  requests.post({
    url: "http://localhost:3000/api/internal/remove_task_from_list",
    form: {secret: globaldefs.internalAPIsecret, taskId: taskId, port: port},
    json: true
  }).catch(error => {})
}
function updateTaskProgress(taskId, status, message, token) {
  requests.post({
    url: "http://localhost:3000/api/internal/update_task_progress",
    form: {secret: globaldefs.internalAPIsecret, taskId: taskId, status: status, message: message, token: token},
    json: true
  }).catch(error => {})
}
function updateTaskImages(taskId, images) {
  requests.post({
    url: "http://localhost:3000/api/internal/update_task_images",
    form: {secret: globaldefs.internalAPIsecret, taskId: taskId, images: images},
    json: true
  }).catch(error => {})
}

async function captchaTask(taskId, proxy, fc_data) {
  if(!fc_data) {
    var fc = new FunCaptcha("action");
  } else {
    var fc = new FunCaptcha("login"); 
    Object.keys(fc_data).forEach(key => {
      // replace Class FunCaptcha state
      fc[key] = fc_data[key];
    });
  }

  var image_names = [];
  
  try {
    var init_response = await fc.InitCaptcha(proxy);
    if(init_response.status === "fail") {
      updateTaskProgress(taskId, init_response.status, init_response.message, "");
      return removeTaskFromList(taskId);
    }

    if(init_response.solved) {
      updateTaskProgress(taskId, "success", "Successfully solved Funcaptcha.", fc.full_token);
      return removeTaskFromList(taskId);
    }

    var game_data = await fc.GetGameData();
    if(game_data.status === "fail") {
      updateTaskProgress(taskId, game_data.status, game_data.message, "");
      return removeTaskFromList(taskId);
    }

    updateTaskImages(taskId, game_data.images);
	// check if there are no images, then mark the captcha as solved
    if(game_data.images === 0) {
      updateTaskProgress(taskId, "success", "Successfully solved Funcaptcha.", fc.full_token);
      return removeTaskFromList(taskId);
    }
	
	// check if we are getting 20 rotation images
    if(fc.angle <= 18) {
      updateTaskProgress(taskId, "fail", "Too many image rotations given to solve correctly, generating new BDA.", "");
      return removeTaskFromList(taskId);
    }

    var decryption_data = await fc.GetDecryptionKey();
    if(decryption_data.status === "fail") {
      updateTaskProgress(taskId, decryption_data.status, decryption_data.message, "");
      return removeTaskFromList(taskId);
    }

    waveLoop:
    while(fc.currentWave-1 <= game_data.images) {
      var imgs = [];
      var randomName = Array(8).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function(x) { return x[Math.floor(Math.random() * x.length)] }).join('');
      var image = await fc.DecryptImage();
      if(image.status === "fail") {
        updateTaskProgress(taskId, image.status, image.message, "");
        break;
      }

      for(var rot = 1; rot <= fc.rotations; rot++)
      {
        var jimp_image = null;
        try {
          jimp_image = await Jimp.read(image.image);
        } catch(error) {
          image_names.forEach(img => {
            fs.unlinkSync(img);
          });
          continue waveLoop;
        }
        var imageBuffer = await new Promise((resolve, reject) => {
          jimp_image.rotate(fc.angle*rot)
          .autocrop()
          .resize(110, 110)
          .getBuffer("image/png", (err, buf) => {
            if(err) reject();
            resolve(buf);
          });
        });

        // predict image
        var tensorImg = tf.node.decodeImage(imageBuffer);
        var predictthis = tf.stack([tensorImg]);
        
        var tensor = model.predict(predictthis);
        var probability = tensor.arraySync()[0][1];

        // cleanup
        tf.dispose(tensorImg);
        tf.dispose(predictthis);
        tf.dispose(tensor);

        imgs.push({rot: rot, image: jimp_image, probability: probability});
      }

      // sort predictions
      imgs.sort(function(a, b){
        return b.probability - a.probability;
      })

      imgs.forEach((image, num) => {
        if(num === 0) {
          image.image.write(`./new_data/images/true/${randomName}_${image.rot}.png`);
          image_names.push(`./new_data/images/true/${randomName}_${image.rot}.png`);
        } else {
          image.image.write(`./new_data/images/false/${randomName}_${image.rot}.png`);
          image_names.push(`./new_data/images/false/${randomName}_${image.rot}.png`);
        }
      });

      var successful_submit = false, submit_response = null;
      for(var n = 0; n < 3; n++) {
        // randomize selection angle
        var num = Math.floor(Math.random() * Math.floor(2));
        var angle = 0;
        if(num === 0) {
          angle = -1 * fc.angle * imgs[0].rot;
        } else {
          angle = (fc.rotations-imgs[0].rot) * fc.angle;
        }

        submit_response = await fc.SubmitCaptchaAnswer(angle);
        if(submit_response.status === "fail") continue;
        successful_submit = true;
        if (submit_response.status === "continue") break;
        else {
          if(submit_response.solved) {
            updateTaskProgress(taskId, "success", "Successfully solved Funcaptcha.", fc.full_token);
            image_names.forEach(img => {
              try {
                fs.unlinkSync(img);
              } catch (error) {
                
              }
            });
            return removeTaskFromList(taskId);
          }
          else {
            updateTaskProgress(taskId, "fail", "Failed to solve FunCaptcha", fc.full_token);
            return removeTaskFromList(taskId);
          }
        }
      }
      if(!successful_submit) {
        updateTaskProgress(taskId, "fail", `${submit_response.message}`, "");
        return removeTaskFromList(taskId);
      }
    }
  } catch (error) {
console.error(error);    
updateTaskProgress(taskId, "fail", "Internal server error occured while trying to solve captcha.", "");
  }
  return removeTaskFromList(taskId);
}

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.listen(port, '0.0.0.0', function(){
  console.log("Server started.");
});
app.post("/api/internal/create_captcha_task", function(req, res) {
  if(req.body.secret !== globaldefs.internalAPIsecret) return;
  if(req.body.fc) {
    req.body.fc = JSON.parse(req.body.fc);
  }

  captchaTask(req.body.taskId, req.body.proxy, req.body.fc);

  res.send("");
})
