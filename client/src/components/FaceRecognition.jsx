import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const FaceRecognition = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(`${MODEL_URL}/tiny_face_detector`),
          faceapi.nets.faceLandmark68Net.loadFromUri(`${MODEL_URL}/face_landmark_68`),
          faceapi.nets.faceRecognitionNet.loadFromUri(`${MODEL_URL}/face_recognition`),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error('Model loading failed:', error);
        setStatus('❌ Failed to load models.');
      }
    };
    loadModels();
  }, []);

  // Draw face box
  const drawBox = useCallback((detection) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current.video;

    faceapi.matchDimensions(canvas, {
      width: video.videoWidth,
      height: video.videoHeight,
    });

    const resized = faceapi.resizeResults(detection, {
      width: video.videoWidth,
      height: video.videoHeight,
    });

    faceapi.draw.drawDetections(canvas, resized);
  }, []);

  // Face Recognition Handler
  const recognizeFace = async () => {
    setStatus('');
    setLoading(true);

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('⚠️ No face detected. Please try again.');
        setLoading(false);
        return;
      }

      drawBox(detection);

      const descriptor = Array.from(detection.descriptor);

      const res = await fetch('http://localhost:3001/api/recognize-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
      });

      const data = await res.json();

      if (data.recognized) {
        setStatus(`✅ Attendance Marked for: ${data.name}`);
      } else {
        setStatus('❌ Face not recognized.');
      }
      setCameraOn(false);
    } catch (error) {
      console.error(error);
      setStatus('❌ Error during face recognition.');
      setCameraOn(false);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4 py-6">
      <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-md relative">
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">Face Attendance System</h2>

        {!cameraOn ? (
          <button
            onClick={() => setCameraOn(true)}
            disabled={!modelsLoaded}
            className={`w-full py-2 rounded-lg font-semibold text-white transition-all duration-200 ${
              modelsLoaded ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {modelsLoaded ? 'Turn On Camera' : 'Loading Models...'}
          </button>
        ) : (
          <>
            <div className="relative w-full mt-4">
              <Webcam
                ref={webcamRef}
                audio={false}
                width={350}
                height={250}
                className="rounded-lg shadow"
                videoConstraints={{
                  width: 350,
                  height: 250,
                  facingMode: 'user',
                }}
              />
              <canvas
                ref={canvasRef}
                width={350}
                height={250}
                className="absolute top-0 left-0"
              />
            </div>

            <button
              onClick={recognizeFace}
              disabled={loading}
              className={`mt-5 w-full py-2 rounded-lg font-semibold text-white transition-all duration-200 ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Recognizing...' : 'Mark Attendance'}
            </button>
          </>
        )}

        {status && (
          <p className="text-center mt-4 text-sm text-gray-700 font-medium">{status}</p>
        )}
      </div>
    </div>
  );
};

export default FaceRecognition;