// This is a custom implementation of NSFW.js
// Library in nsfwjs.min.js
// Github: https://github.com/infinitered/nsfwjs
// Used model: https://github.com/infinitered/nsfwjs/tree/master/example/nsfw_demo/public/model (model3)
// Web demo: https://nsfwjs.com/
// Descripción: detección de contenido NSFW en imágenes y videos.
// Made by: Crafy Holding (https://github.com/chijete/)

// [Requires] Tensorflow.js (https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest)

// [Requires] gifuct-js (https://cdn.jsdelivr.net/npm/gifuct-js/dist/gifuct-js.min.js)
// CDN docs: https://www.jsdelivr.com/package/npm/@fand/gifuct-js
// Github docs: https://github.com/matt-way/gifuct-js

// ADVERTENCIA ⚠
// Subir los archivos del modelo mediante FTP los corrompe.

class CrafyNSFWjs {
  // Requiere la URL a la carpeta que contiene los archivos del modelo, incluído model.json
  constructor(
    urlToModelFiles,
    indexeddbModelPathName='nsfwjs-model3',
    customPredictionConfig=false
  ) {
    this.indexeddbModelPath = 'indexeddb://'+indexeddbModelPathName;
    this.urlToModelFiles = urlToModelFiles;
    this.nsfwjsModel = false;
    this.predictionLocalConfig = {
      'acceptedImages': [
        'image/png',
        'image/jpg',
        'image/jpeg',
        'image/webp',
        'image/bmp',
      ],
      'acceptedVideos': [
        'video/mp4',
        'video/webm',
        'video/mpeg',
        'video/ogg',
        'video/x-msvideo',
        'video/quicktime',
        'video/mov',
      ],
      'acceptedGIFs': [
        'image/gif',
      ],
      'videoSeekDivisor': 2,
      'gifSeekDivisor': 2,
      'maxWidth': 800,
      'maxHeight': 800,
    };
    if (customPredictionConfig !== false) {
      for (const [key, value] of Object.entries(customPredictionConfig)) {
        this.predictionLocalConfig[key] = value;
      }
    }
    return true;
  }

  // Descarga un archivo en formato BLOB usando fetch()
  downloadFile(fileUrl) {
    return new Promise(function(resolve, reject) {
      fetch(fileUrl)
        .then(response => response.blob())
        .then(blobFile => {
          // Aquí tienes el archivo descargado en forma de BLOB
          var file_name_parts = fileUrl.split("/");
          var file_name = file_name_parts[file_name_parts.length-1];
          const file = new File([blobFile], file_name);
          resolve(file);
        })
        .catch(error => {
          console.error('[CrafyNSFWjs] downloadFile: Error downloading file:', error);
          reject(false);
        });
    });
  }

  // Descarga el modelo del servidor y lo guarda en IndexedDB
  async donwloadModel() {
    var filenamesToDownload = [
      'group1-shard1of6',
      'group1-shard2of6',
      'group1-shard3of6',
      'group1-shard4of6',
      'group1-shard5of6',
      'group1-shard6of6',
      'model.json',
    ];
    var filesToDownload = [];
    for (const filename of filenamesToDownload) {
      filesToDownload.push(this.urlToModelFiles + filename);
    }
    var downloadedFiles = {};
    for (const fileUrl of filesToDownload) {
      try {
        var fileUrlParts = fileUrl.split("/");
        var fileName = fileUrlParts[fileUrlParts.length-1];
        var blobFile = await downloadFile(fileUrl);
        downloadedFiles[fileName] = blobFile;
      } catch (error) {
        console.error('[CrafyNSFWjs] donwloadModel: Downloading file error:', error);
        return false;
      }
    }
    var browserFilesInstance = tf.io.browserFiles([
      downloadedFiles['model.json'],
      downloadedFiles['group1-shard1of6'],
      downloadedFiles['group1-shard2of6'],
      downloadedFiles['group1-shard3of6'],
      downloadedFiles['group1-shard4of6'],
      downloadedFiles['group1-shard5of6'],
      downloadedFiles['group1-shard6of6'],
    ]);
    try {
      const model = await tf.loadLayersModel(browserFilesInstance);
      await model.save(this.indexeddbModelPath);
      model.dispose();
    } catch (error) {
      console.error('[CrafyNSFWjs] donwloadModel: Loading model error:', error);
      return false;
    }

    // Liberar memoria
    downloadedFiles = null;
    browserFilesInstance = null;

    return true;
  }

  // true si el modelo está descargado y false si no
  isModelLoadedInIndexeddb() {
    var indexeddbModelPathLocalSave = this.indexeddbModelPath;
    return new Promise(function(resolve, reject) {
      tf.io.listModels().then(function(models) {
        if (indexeddbModelPathLocalSave in models) {
          resolve(true);
        } else {
          resolve(false);
        }
      }).catch(function(error) {
        console.error('[CrafyNSFWjs] isModelLoadedInIndexeddb: tf.io.listModels error:', error);
        resolve(0);
      });
    });
  }

  // Carga el modelo NSFWjs en this.nsfwjsModel
  async loadModel() {
    var isModelLoaded = await this.isModelLoadedInIndexeddb();
    if (isModelLoaded != 0) {
      if (!isModelLoaded) {
        await this.donwloadModel();
      }
      try {
        this.nsfwjsModel = await nsfwjs.load(this.indexeddbModelPath, {size: 299});
        return true;
      } catch (error) {
        console.error('[CrafyNSFWjs] loadModel: Loading model error:', error);
      }
    }
    return false;
  }

  // Realiza la clasificación de una imagen
  async makePrediction(img) {
    if (this.nsfwjsModel !== false) {
      try {
        var initTime = Date.now();
        var prediction = await this.nsfwjsModel.classify(img);
        var endTime = Date.now();
        var totalTime = (endTime - initTime) / 1000;
        return {
          'prediction': prediction,
          'time': totalTime
        };
      } catch (error) {
        console.error('[CrafyNSFWjs] makePrediction: classify error:', error);
      }
    }
    return false;
  }

  // Carga el modelo si no fue cargado y realiza la clasificación de una imagen
  async makePredictionWithLoads(img) {
    var modelLoad = true;
    if (this.nsfwjsModel === false) {
      modelLoad = await this.loadModel();
    }
    if (modelLoad) {
      return this.makePrediction(img);
    }
    return false;
  }

  // Obtiene un Blob de una URL blob:
  async getBlobFromURL(blobUrl) {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return blob;
  }

  // Obtiene el Blob de un elemento DOM
  getBlobFromDOMElement(element) {
    var savedThis = this;
    return new Promise(function(resolve, reject) {
      var source = element.src;
      if (source !== undefined && source !== null && source.length > 0) {
        if (source.split(":")[0] == 'blob') {
          savedThis.getBlobFromURL(source).then(function(myBlob) {
            resolve(myBlob);
          }).catch(function(error) {
            console.error('[CrafyNSFWjs] getFiletypeFromDOMElement:', error);
            reject(error);
          });
        } else {
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }

  // Obtiene los frames de un GIF
  getGIFFrames(gifBlob) {
    return new Promise(function(resolve, reject) {
      const fileReader = new FileReader();
      fileReader.onload = async function() {
        try {
          const arrayBuffer = this.result;
          const gif = new GIF(arrayBuffer);
          const frames = await gif.decompressFrames(true);
          resolve(frames);
        } catch (error) {
          reject(error);
        }
      };
      fileReader.readAsArrayBuffer(gifBlob);
    });
  }

  // Convierte un frame de un GIF a Blob image/png
  convertGIFFrameToBlob(frame) {
    return new Promise(function(resolve, reject) {
      const rgbaData = frame.patch;
      const canvas = document.createElement('canvas');
      canvas.width = frame.dims.width;
      canvas.height = frame.dims.height;
      const context = canvas.getContext('2d');
      const imageData = new ImageData(rgbaData, frame.dims.width, frame.dims.height);
      context.putImageData(imageData, 0, 0);
      canvas.toBlob(function(blob) {
        resolve(blob);
      });
    });
  }

  // Obtiene un frame de un video como Blob image/png
  // Ej: seekDivisor = 2 => mitad del video
  // Ej: seekDivisor = 1 => final del video
  getVideoFrame(videoBlob, seekSeconds=0, seekDivisor=false) {
    return new Promise(function(resolve, reject) {
      const videoElement = document.createElement('video');
      const canvasElement = document.createElement('canvas');
      const context = canvasElement.getContext('2d');
      videoElement.addEventListener('loadedmetadata', function() {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        videoElement.addEventListener('seeked', function() {
          context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
          canvasElement.toBlob(function(blob) {
            resolve(blob);
          });
        });
        if (seekDivisor !== false) {
          videoElement.currentTime = videoElement.duration / seekDivisor;
        } else {
          videoElement.currentTime = seekSeconds;
        }
      });
      videoElement.src = URL.createObjectURL(videoBlob);
    });
  }

  // Retorna un elemento DOM img con src loaded
  blobToImageElement(blob) {
    return new Promise(function(resolve, reject) {
      var imageElement = document.createElement('img');
      imageElement.src = URL.createObjectURL(blob);
      imageElement.onload = function() {
        resolve(imageElement);
      };
    });
  }

  // Redimensiona una imagen
  resizeImageFromBlob(blob, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const img = new Image();
  
      img.onload = function() {
        let width = img.width;
        let height = img.height;
  
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
  
          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
  
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
  
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
  
        canvas.width = width;
        canvas.height = height;
  
        ctx.drawImage(img, 0, 0, width, height);
  
        canvas.toBlob(
          blob => {
            resolve(blob);
          },
          'image/png'
        );
      };
  
      img.onerror = function() {
        reject(new Error('Error al cargar la imagen.'));
      };
  
      img.src = URL.createObjectURL(blob);
    });
  }

  // Realiza la clasificación de una imagen, video o GIF
  async makeMagicPrediction(domElement, customConfig=false) {
    var localConfig = this.predictionLocalConfig;
    if (customConfig !== false) {
      for (const [key, value] of Object.entries(customConfig)) {
        localConfig[key] = value;
      }
    }
    var modelLoad = true;
    if (this.nsfwjsModel === false) {
      modelLoad = await this.loadModel();
    }
    if (modelLoad) {

      const blobElement = await this.getBlobFromDOMElement(domElement);
      var imageBlob;

      if (localConfig['acceptedVideos'].includes(blobElement.type)) {
        imageBlob = await this.getVideoFrame(blobElement, false, localConfig['videoSeekDivisor']);
      } else if (localConfig['acceptedGIFs'].includes(blobElement.type)) {
        var gifFrames = await this.getGIFFrames(blobElement);
        var selectedFrameIndex = 0;
        if (gifFrames.length > 2) {
          selectedFrameIndex = Math.round((gifFrames.length-1) / localConfig['gifSeekDivisor']);
        }
        imageBlob = await this.convertGIFFrameToBlob(gifFrames[selectedFrameIndex]);
      } else if (localConfig['acceptedImages'].includes(blobElement.type)) {
        imageBlob = blobElement;
      } else {
        return false;
      }

      imageBlob = await this.resizeImageFromBlob(imageBlob, localConfig['maxWidth'], localConfig['maxHeight']);
      var imageElement = await this.blobToImageElement(imageBlob);
      var predictionResult = await this.makePrediction(imageElement);
      return {
        'predictionResult': predictionResult,
        'imageElement': imageElement,
        'inputType': blobElement.type,
        'analicedImageBlob': imageBlob
      };

    }
    return false;
  }

  getAllAcceptedFiletypes() {
    return this.predictionLocalConfig['acceptedImages'].concat(this.predictionLocalConfig['acceptedGIFs'], this.predictionLocalConfig['acceptedVideos']);
  }
}