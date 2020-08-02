const fs = require("fs")
const Jimp = require("jimp");
var tf = require('@tensorflow/tfjs-node');
const {parentPort, workerData} = require('worker_threads');

const learningRate = 0.0001;
const optimizer = tf.train.adam(learningRate);
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

parentPort.on("message", async data => {
  data.buffer = Buffer.from(data.buffer);
  if(data.single) {
      var tensorImg = tf.node.decodeImage(data.buffer);
      var predictthis = tf.stack([tensorImg]);
            
      var tensor = model.predict(predictthis);
      var probability = tensor.arraySync()[0][1];
  
      // cleanup
      tf.dispose(tensorImg);
      tf.dispose(predictthis);
      tf.dispose(tensor);
  
      parentPort.postMessage({taskId: data.taskId, prediction: probability});
      return;
  } else {
    var imgs = [];
    for(var rot = 1; rot <= data.rotations; rot++)
    {
      var jimp_image = null;
      try {
         jimp_image = await Jimp.read(data.buffer);
      } catch(error) {
        continue;
      }
      var imageBuffer = await new Promise((resolve, reject) => {
        jimp_image.rotate(data.angle*rot)
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
  
      imgs.push({rot: rot, probability: probability});
    }

    parentPort.postMessage({taskId: data.taskId, imgs: imgs});
    return;
  }
})