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


var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.listen(port, '0.0.0.0', function(){
  console.log("Server started.");
});
app.post("/api/internal/predict_img", function(req, res) {
  if(req.body.secret !== globaldefs.internalAPIsecret) return;

  var buf = Buffer.from(req.body.image.toString(), "base64");
  try {
      var tensorImg = tf.node.decodeImage(buf);
      var predictthis = tf.stack([tensorImg]);
      
      var tensor = model.predict(predictthis);
      var prediction = tensor.arraySync()[0][1];

      // clean crap
      tf.dispose(tensorImg);
      tf.dispose(predictthis);
      tf.dispose(tensor);
  } catch(e) {
	  console.log(e);
    tf.dispose(tensorImg);
    tf.dispose(predictthis);
    tf.dispose(tensor);
    return res.json({status: "fail", message: "Internal server error."});
  }

  return res.json({status: "success", message: prediction});
})
