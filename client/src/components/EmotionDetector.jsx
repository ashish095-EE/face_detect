import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

const EmotionDetector = () => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [expressions, setExpressions] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [dominantEmotion, setDominantEmotion] = useState('neutral');

  // Emoji mapping
  const emojiMap = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲',
    neutral: '😐'
  };

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models/face_expression'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68')
        ]);
        startVideo();
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };

    loadModels();
  }, []);

  // Start webcam
  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ 
        video: { 
          width: 500, 
          height: 500,
          facingMode: 'user' 
        } 
      })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(console.error);
  };

  // Get dominant emotion
  const getDominantEmotion = (expressions) => {
    return Object.entries(expressions).reduce((a, b) => 
      a[1] > b[1] ? a : b
    )[0];
  };

  // Toggle detection
  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
  };

  // Detect face and emotion
  useEffect(() => {
    let interval;
    
    if (isDetecting) {
      interval = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused) return;

        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        // Clear and resize canvas
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        faceapi.matchDimensions(canvas, {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });

        // Draw detections
        const resized = faceapi.resizeResults(detections, {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });

        faceapi.draw.drawDetections(canvas, resized);
        faceapi.draw.drawFaceExpressions(canvas, resized);

        // Update state
        if (detections[0]?.expressions) {
          setExpressions(detections[0].expressions);
          setDominantEmotion(getDominantEmotion(detections[0].expressions));
        }
      }, 500);
    }

    return () => clearInterval(interval);
  }, [isDetecting]);

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-50 rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6">Emotion Detector</h2>
      
      {/* Detection Area */}
      <div className="relative w-full h-96 bg-gray-200 rounded-lg overflow-hidden mb-4">
        <video 
          ref={videoRef} 
          className="absolute top-0 left-0 w-full h-full object-cover"
          autoPlay 
          muted 
          playsInline
        />
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>

      {/* Controls */}
      <div className="flex justify-center mb-6">
        <button 
          onClick={toggleDetection}
          className={`px-6 py-2 rounded-full font-medium ${isDetecting 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
        >
          {isDetecting ? 'Stop Analysis' : 'Start Analysis'}
        </button>
      </div>

      {/* Results */}
      {expressions && (
        <div className="bg-white p-4 rounded-lg shadow">
          {/* Dominant Emotion */}
          <div className="text-center mb-4">
            <span className="text-6xl">{emojiMap[dominantEmotion]}</span>
            <h3 className="text-xl font-semibold mt-2 capitalize">
              {dominantEmotion} {(expressions[dominantEmotion] * 100).toFixed(1)}%
            </h3>
          </div>

          {/* Emotion Bars */}
          <div className="space-y-3">
            {Object.entries(expressions).map(([emotion, value]) => (
              <div key={emotion} className="flex items-center">
                <span className="w-24 flex items-center">
                  <span className="text-2xl mr-2">{emojiMap[emotion]}</span>
                  <span className="capitalize">{emotion}</span>
                </span>
                <div className="flex-1 bg-gray-200 h-4 rounded-full mx-2">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
                <span className="w-12 text-right">
                  {(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionDetector;