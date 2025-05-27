const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const canvas = require('canvas');
const faceapi = require('face-api.js');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup Multer for file uploads
const upload = multer({
  dest: 'uploads/', // Save to uploads/ folder
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'), false);
    }
    cb(null, true);
  }
});

// Face database (to store name and face descriptor)
let faceDB = []; // { name, descriptor }
let analysisDB = []; // { age, gender, timestamp }

// Initialize canvas with face-api.js
const { Canvas, Image } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image });

// Load face-api.js models
async function initModels() {
  const modelPath = path.join(__dirname, '../client/public/models'); // Make sure this folder has your models
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(`${modelPath}/ssd_mobilenetv1`);
  await faceapi.nets.ageGenderNet.loadFromDisk(`${modelPath}/age_gender_model`);
  console.log('✅ Face-api.js models loaded');
}

// Euclidean distance for face recognition
function euclideanDistance(d1, d2) {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    sum += Math.pow(d1[i] - d2[i], 2);
  }
  return Math.sqrt(sum);
}

// API: Register a face
app.post('/api/register-face', (req, res) => {
  const { name, descriptor } = req.body;

  if (!name || !descriptor) {
    return res.status(400).json({ success: false, error: 'Name and descriptor are required' });
  }

  if (faceDB.some(entry => entry.name === name)) {
    return res.status(409).json({ success: false, error: 'Name already registered' });
  }

  faceDB.push({ name, descriptor });
  console.log(`📌 Registered: ${name}`);
  res.json({
    success: true,
    message: `Face registered for ${name}`,
    count: faceDB.length
  });
});



// API: Recognize face from descriptor
app.post('/api/recognize-face', (req, res) => {
  const { descriptor } = req.body;

  if (!descriptor || !Array.isArray(descriptor)) {
    return res.status(400).json({
      recognized: false,
      error: 'Valid descriptor array required'
    });
  }

  let bestMatch = { name: null, distance: Infinity };

  faceDB.forEach(person => {
    const distance = euclideanDistance(descriptor, person.descriptor);
    if (distance < 0.6 && distance < bestMatch.distance) {
      bestMatch = { name: person.name, distance };
    }
  });

  res.json(bestMatch.name ? {
    recognized: true,
    name: bestMatch.name,
    confidence: 1 - (bestMatch.distance / 0.6)
  } : {
    recognized: false,
    message: 'No match found'
  });
});

// API: Upload a photo (optional standalone)
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }

  const filePath = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: 'Image uploaded successfully',
    filePath,
    originalName: req.file.originalname
  });
});

// API: Analyze face (age & gender) from uploaded photo
app.post('/api/analyze-face', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo uploaded' });
    }

    const imagePath = path.join(__dirname, req.file.path);
    console.log(`📸 Received photo: ${imagePath}`);

    // Load the image into canvas
    const image = await canvas.loadImage(imagePath);
    const detections = await faceapi.detectAllFaces(image).withAgeAndGender();

    if (!detections || detections.length === 0) {
      return res.status(400).json({ success: false, error: 'No face detected in the image.' });
    }

    // Take the first detected face
    const { age, gender, genderProbability } = detections[0];

    const analysisResult = {
      age: Math.floor(age),
      gender,
      confidence: +(genderProbability).toFixed(2)
    };

    analysisDB.push({
      ...analysisResult,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      analysis: analysisResult
    });

  } catch (err) {
    console.error('❌ Analysis error:', err);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// API: Stats & recent analysis
app.get('/api/data', (req, res) => {
  res.json({
    faceCount: faceDB.length,
    analysisCount: analysisDB.length,
    lastAnalysis: analysisDB[analysisDB.length - 1] || null
  });
});

// Start the server
initModels().then(() => {
  app.listen(PORT, () => {
    console.log(`🔥 Server is up at http://localhost:${PORT}`);
    console.log('🔧 Endpoints Available:');
    console.log('▶ POST /api/register-face');
    console.log('▶ POST /api/recognize-face');
    console.log('▶ POST /api/analyze-face (form-data with photo)');
    console.log('▶ POST /api/upload-photo (optional)');
    console.log('▶ GET  /api/data');
  });
});
