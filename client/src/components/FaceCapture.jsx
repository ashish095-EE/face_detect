// FaceCapture.js
import React, { useRef, useEffect, useState } from 'react';
import Webcam from "react-webcam";
import * as faceapi from 'face-api.js';

const FaceCapture = () => {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models/face_recognition'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68')
        ]);
        setModelsLoaded(true);
      } catch (err) {
        setStatus("❌ Failed to load models.");
      }
    };
    loadModels();
  }, []);

  const captureAndSend = async () => {
    if (!name.trim()) {
      setStatus("⚠️ Please enter a name.");
      return;
    }

    const video = webcamRef.current?.video;
    if (!video) {
      setStatus("⚠️ Camera not ready.");
      return;
    }

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus("😕 No face detected. Try again.");
      return;
    }

    const descriptor = Array.from(detection.descriptor);

    try {
      const res = await fetch('http://localhost:3001/api/register-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, descriptor }),
      });

      const data = await res.json();
      setStatus(`✅ ${data.status}`);
      setCameraOn(false);
    } catch (err) {
      setStatus("❌ Registration failed.");
      setCameraOn(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-lg rounded-2xl border">
      <h2 className="text-2xl font-bold text-center mb-4">🎥 Face Registration</h2>

      <input
        type="text"
        placeholder="Enter your name"
        className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {!cameraOn && (
        <button
          onClick={() => setCameraOn(true)}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition mb-4"
          disabled={!modelsLoaded}
        >
          {modelsLoaded ? 'Turn On Camera' : 'Loading Models...'}
        </button>
      )}

      {cameraOn && (
        <div className="mb-4 flex justify-center">
          <Webcam
            ref={webcamRef}
            width={350}
            height={250}
            videoConstraints={{ facingMode: "user" }}
            className="rounded-lg border"
          />
        </div>
      )}

      {cameraOn && (
        <button
          onClick={captureAndSend}
          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
        >
          Register Face
        </button>
      )}

      {status && (
        <p className="mt-4 text-center text-sm text-gray-700">{status}</p>
      )}
    </div>
  );
};

export default FaceCapture;