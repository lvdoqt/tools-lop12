import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Background from './components/Background';
import HomePage from './pages/HomePage';
import PdfToWordPage from './pages/PdfToWordPage';
import DriveDownloaderPage from './pages/DriveDownloaderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Background />
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pdf-to-word" element={<PdfToWordPage />} />
        <Route path="/drive-downloader" element={<DriveDownloaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
