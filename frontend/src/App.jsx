import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Background from './components/Background';
import HomePage from './pages/HomePage';
import JsonFormatterPage from './pages/JsonFormatterPage';
import TikzEditorPage from './pages/TikzEditorPage';
import TexToPdfPage from './pages/TexToPdfPage';
import PdfToolsPage from './pages/PdfToolsPage';
import LatexToJsonPage from './pages/LatexToJsonPage';

const HtmlEditorPage = lazy(() => import('./pages/HtmlEditorPage'));
const JsonToWordPage = lazy(() => import('./pages/JsonToWordPage'));
const WordShufflePage = lazy(() => import('./pages/WordShufflePage'));

export default function App() {
  return (
    <BrowserRouter>
      <Background />
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/word-shuffle" element={<Suspense fallback={<main className="main-content">Đang mở Trộn đề Word…</main>}><WordShufflePage /></Suspense>} />
        <Route path="/json-formatter" element={<JsonFormatterPage />} />
        <Route path="/tikz-editor" element={<TikzEditorPage />} />
        <Route path="/tex-to-pdf" element={<TexToPdfPage />} />
        <Route path="/pdf-tools" element={<PdfToolsPage />} />
        <Route path="/latex-to-json" element={<LatexToJsonPage />} />
        <Route path="/json-to-word" element={<Suspense fallback={<main className="main-content">Đang mở JSON to Word…</main>}><JsonToWordPage /></Suspense>} />
        <Route path="/edit-html" element={<Suspense fallback={<main className="main-content"><div className="tool-page">Đang mở trình soạn thảo…</div></main>}><HtmlEditorPage /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
