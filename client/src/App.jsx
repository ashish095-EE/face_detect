import React from 'react'
import FaceCapture from './components/FaceCapture.jsx'
import FaceRecognition from './components/FaceRecognition.jsx'
import AgeGenderAnalysis from './components/AgeGenderAnalysis.jsx'
import EmotionDetector from './components/EmotionDetector.jsx'

const App = () => {
  return (
    <div>
      <FaceCapture/>
      <FaceRecognition/>
      <AgeGenderAnalysis/>
      <EmotionDetector/>
    </div>
  )
}

export default App

