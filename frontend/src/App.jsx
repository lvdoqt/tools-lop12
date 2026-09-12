import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Background from './components/Background';
import HomePage from './pages/HomePage';
import JsonFormatterPage from './pages/JsonFormatterPage';
import TikzEditorPage from './pages/TikzEditorPage';
import TexToPdfPage from './pages/TexToPdfPage';
import PdfToolsPage from './pages/PdfToolsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Background />
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/json-formatter" element={<JsonFormatterPage />} />
        <Route path="/tikz-editor" element={<TikzEditorPage />} />
        <Route path="/tex-to-pdf" element={<TexToPdfPage />} />
        <Route path="/pdf-tools" element={<PdfToolsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
