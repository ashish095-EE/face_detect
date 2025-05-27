import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import axios from 'axios';

const AgeGenderAnalysis = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadedResult, setUploadedResult] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(`${MODEL_URL}/tiny_face_detector`),
          faceapi.nets.faceLandmark68Net.loadFromUri(`${MODEL_URL}/face_landmark_68`),
          faceapi.nets.ageGenderNet.loadFromUri(`${MODEL_URL}/age_gender_model`)
        ]);
        setModelsLoaded(true);
        setStatus('✅ Models loaded successfully!');
      } catch (err) {
        console.error(err);
        setStatus('❌ Failed to load models.');
      }
    };
    loadModels();
  }, []);

  const drawBox = useCallback((detection) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current.video;
    if (!canvas || !video) return;

    const dims = faceapi.matchDimensions(canvas, video);
    const resized = faceapi.resizeResults(detection, dims);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    resized.forEach(result => {
      const { age, gender, genderProbability, detection } = result;
      const box = detection.box;
      const label = `Age: ${Math.round(age)}, Gender: ${gender} (${Math.round(genderProbability * 100)}%)`;
      new faceapi.draw.DrawBox(box, {
        label,
        lineWidth: 2,
        boxColor: gender === 'male' ? '#3498db' : '#e91e63'
      }).draw(canvas);
    });
  }, []);

  const analyzeFace = async () => {
    setStatus('');
    setLoading(true);
    setAnalysisResult(null);

    const video = webcamRef.current.video;
    if (!video) {
      setStatus('❌ Webcam not ready.');
      setLoading(false);
      return;
    }

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withAgeAndGender();

      if (!detections.length) {
        setStatus('⚠️ No face detected. Try adjusting the camera.');
        setLoading(false);
        return;
      }

      const { age, gender, genderProbability } = detections[0];

      setAnalysisResult({
        age: Math.round(age),
        gender,
        confidence: genderProbability
      });

      drawBox(detections);
      setStatus('✅ Analysis complete!');
    } catch (err) {
      console.error(err);
      setStatus('❌ Face analysis error.');
    }

    setLoading(false);
  };

  const resetAnalysis = () => {
    setCameraOn(false);
    setAnalysisResult(null);
    setImagePreview(null);
    setUploadedResult(null);
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setStatus('');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('📤 Uploading and analyzing...');
    setLoading(true);
    setUploadedResult(null);
    setImagePreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const { data } = await axios.post('http://localhost:3001/api/analyze-face', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedResult(data);
      setStatus('✅ Photo analyzed!');
    } catch (err) {
      console.error(err);
      setStatus('❌ Failed to analyze photo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4 py-6">
      <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-md relative">
        <h2 className="text-xl font-bold text-center mb-6 text-gray-800">Age & Gender Analysis</h2>

        <div className="mb-4">
          <label className="block mb-1 font-medium text-gray-700">Upload a Photo</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {imagePreview && (
          <img src={imagePreview} alt="Preview" className="rounded shadow w-full max-h-64 object-contain mb-4" />
        )}

        {uploadedResult && (
          <div className="mt-4 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-center mb-2">Uploaded Image Results</h3>
            <p><strong>Age:</strong> {uploadedResult.analysis.age}</p>
            <p><strong>Gender:</strong> {uploadedResult.analysis.gender}</p>
            <p><strong>Confidence:</strong> {Math.round(uploadedResult.analysis.confidence * 100)}%</p>
          </div>
        )}

        {!cameraOn ? (
          <button
            onClick={() => setCameraOn(true)}
            disabled={!modelsLoaded}
            className={`w-full py-2 rounded-lg font-semibold text-white transition-all duration-200 ${modelsLoaded ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
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
                screenshotFormat="image/jpeg"
                className="rounded-lg shadow"
                videoConstraints={{ width: 350, height: 250, facingMode: 'user' }}
              />
              <canvas
                ref={canvasRef}
                width={350}
                height={250}
                className="absolute top-0 left-0"
              />
            </div>

            <button
              onClick={analyzeFace}
              disabled={loading}
              className={`mt-5 w-full py-2 rounded-lg font-semibold text-white transition-all duration-200 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? 'Analyzing...' : 'Analyze Face'}
            </button>
          </>
        )}

        {status && <p className="text-center mt-4 text-sm text-gray-700 font-medium">{status}</p>}

        {analysisResult && (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-center mb-2">Analysis Results</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 p-3 rounded">
                <p className="text-sm font-medium text-gray-600">Age</p>
                <p className="text-xl font-bold">{analysisResult.age}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm font-medium text-gray-600">Gender</p>
                <p className="text-xl font-bold capitalize">{analysisResult.gender}</p>
              </div>
              <div className="col-span-2 bg-purple-50 p-3 rounded">
                <p className="text-sm font-medium text-gray-600">Confidence</p>
                <p className="text-xl font-bold capitalize">{Math.round(analysisResult.confidence * 100)} %</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div 
                    className="bg-purple-600 h-2.5 rounded-full" 
                    style={{ width: `${Math.round(analysisResult.confidence * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={resetAnalysis}
          className="mt-5 w-full py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default AgeGenderAnalysis;
