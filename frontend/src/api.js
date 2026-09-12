const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export function validatePdfFiles(files) {
  if (files.length > 30) throw new Error('Chỉ có thể chọn tối đa 30 file mỗi lần.');
  if (files.some(file => !file.name.toLowerCase().endsWith('.pdf') || !file.size)) {
    throw new Error('Hãy chọn file PDF không rỗng.');
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_PDF_BYTES) {
    throw new Error('Tổng dung lượng PDF mỗi lần tối đa 4 MB.');
  }
}

async function checkResponse(res, fallback) {
  if (res.ok) return;
  const error = await res.json().catch(() => ({}));
  const detail = typeof error.detail === 'string' ? error.detail : null;
  throw new Error(detail || (res.status === 413 ? 'Dữ liệu vượt quá giới hạn dung lượng. Hãy giảm kích thước file hoặc DPI.' : fallback));
}

export function releaseResult(result) {
  new Set(result?.objectUrls || []).forEach(url => URL.revokeObjectURL(url));
}

export const api = {
  // ===== TikZ Endpoints =====
  renderTikz: async (source, dpi = 180) => {
    const res = await fetch(`${API_BASE}/tikz/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, dpi }),
    });
    await checkResponse(res, 'Không thể biên dịch mã TikZ.');
    const data = await res.json();
    const downloads = {};
    const objectUrls = [];
    try {
      for (const [format, type] of Object.entries({ png: 'image/png', pdf: 'application/pdf', tex: 'application/x-tex' })) {
        const bytes = Uint8Array.from(atob(data.assets[format]), char => char.charCodeAt(0));
        downloads[format] = URL.createObjectURL(new Blob([bytes], { type }));
        objectUrls.push(downloads[format]);
      }
    } catch (error) {
      releaseResult({ objectUrls });
      throw error;
    }
    return { output_id: data.output_id, preview_url: downloads.png, pdf_preview_url: downloads.pdf, downloads, objectUrls };
  },

  pdfTool: async (operation, files, dpi = 180, pageRanges = null) => {
    validatePdfFiles(files);
    const formData = new FormData();
    if (operation === 'merge') files.forEach(file => formData.append('files', file));
    else formData.append('file', files[0]);
    if (operation === 'png') formData.append('dpi', String(dpi));
    if (operation === 'split' && pageRanges) formData.append('ranges', JSON.stringify(pageRanges));
    const endpoint = operation === 'split' && pageRanges ? 'split-ranges' : operation;
    const res = await fetch(`${API_BASE}/pdf-tools/${endpoint}`, { method: 'POST', body: formData });
    await checkResponse(res, 'Không thể xử lý PDF.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return {
      pages: Number(res.headers.get('X-PDF-Pages')),
      files: Number(res.headers.get('X-PDF-Files')),
      filename: blob.type === 'application/pdf' ? 'pdf-output.pdf' : 'pdf-output.zip',
      download_url: url,
      objectUrls: [url],
    };
  },
  getPdfToolInfo: async (file) => {
    validatePdfFiles([file]);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/pdf-tools/info`, { method: 'POST', body: formData });
    await checkResponse(res, 'Không thể đọc số trang PDF.');
    return res.json();
  },

  // ===== Health =====
  healthCheck: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
};
