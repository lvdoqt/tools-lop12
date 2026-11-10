export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
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
  renderTikz: async (source, dpi = 180, options = {}) => {
    const res = await fetch(`${API_BASE}/tikz/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, dpi, ...options }),
    });
    await checkResponse(res, 'Không thể biên dịch mã TikZ.');
    const data = await res.json();
    const downloads = {};
    const objectUrls = [];
    try {
      for (const [format, type] of Object.entries({ png: 'image/png', pdf: 'application/pdf', tex: 'application/x-tex', svg: 'image/svg+xml' })) {
        if (!data.assets[format]) continue;
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

  pdfTool: async (operation, files, dpiOrOptions = 180, pageRanges = null) => {
    validatePdfFiles(files);
    const formData = new FormData();
    if (operation === 'merge') files.forEach(file => formData.append('files', file));
    else formData.append('file', files[0]);
    if (operation === 'png') formData.append('dpi', String(dpiOrOptions));
    if (operation === 'split' && pageRanges) formData.append('ranges', JSON.stringify(pageRanges));
    if (operation === 'header') {
      const opts = typeof dpiOrOptions === 'object' && dpiOrOptions !== null ? dpiOrOptions : {};
      Object.entries(opts).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, String(val));
      });
    }
    const endpoint = operation === 'split' && pageRanges ? 'split-ranges' : operation;
    const res = await fetch(`${API_BASE}/pdf-tools/${endpoint}`, { method: 'POST', body: formData });
    await checkResponse(res, 'Không thể xử lý PDF.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    let filename = blob.type === 'application/pdf' ? 'pdf-output.pdf' : 'pdf-output.zip';
    if (operation === 'header' && files[0]?.name) {
      filename = files[0].name.replace(/\.pdf$/i, '') + '-header.pdf';
    }
    return {
      pages: Number(res.headers.get('X-PDF-Pages')),
      files: Number(res.headers.get('X-PDF-Files')),
      filename,
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

  // ===== Chấm thi 2025 =====
  scanSheet: async (imageInput, answerKey = null, maxP1 = 40, maxP2 = 8, maxP3 = 6, sheetType = '2025_math') => {
    let res;
    if (typeof imageInput === 'string') {
      res = await fetch(`${API_BASE}/grade/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageInput,
          answer_key: answerKey,
          max_p1: maxP1,
          max_p2: maxP2,
          max_p3: maxP3,
          sheet_type: sheetType,
        }),
      });
    } else {
      const formData = new FormData();
      formData.append('file', imageInput);
      if (answerKey) formData.append('answer_key', JSON.stringify(answerKey));
      formData.append('max_p1', String(maxP1));
      formData.append('max_p2', String(maxP2));
      formData.append('max_p3', String(maxP3));
      formData.append('sheet_type', sheetType);
      res = await fetch(`${API_BASE}/grade/scan-file`, {
        method: 'POST',
        body: formData,
      });
    }
    await checkResponse(res, 'Không thể chấm phiếu. Hãy kiểm tra ảnh có đủ 4 góc định vị.');
    return res.json();
  },

  importAnswersExcel: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/grade/import-answers`, {
      method: 'POST',
      body: formData,
    });
    await checkResponse(res, 'Không thể đọc file đáp án Excel TNMaker.');
    return res.json();
  },

  exportGradeExcel: async (examTitle, submissions, teacherName = null, className = null) => {
    const res = await fetch(`${API_BASE}/grade/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_title: examTitle,
        teacher_name: teacherName,
        class_name: className,
        submissions,
      }),
    });
    await checkResponse(res, 'Không thể xuất bảng điểm Excel.');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  getGradeTemplates: async () => {
    const res = await fetch(`${API_BASE}/grade/templates`);
    if (!res.ok) return [];
    return res.json().catch(() => []);
  },

  getTemplatePdfUrl: (sheetType = '2025_math') =>
    `${API_BASE}/grade/template-pdf?sheet_type=${encodeURIComponent(sheetType)}`,

  getSampleExcelUrl: (maxP1 = 12, maxP2 = 4, maxP3 = 6, codes = '101,102,103,104') =>
    `${API_BASE}/grade/sample-excel?max_p1=${maxP1}&max_p2=${maxP2}&max_p3=${maxP3}&codes=${encodeURIComponent(codes)}`,

  listExamsCloud: async (teacherId = null) => {
    const query = teacherId ? `?teacher_id=${encodeURIComponent(teacherId)}` : '';
    const res = await fetch(`${API_BASE}/grade/exams${query}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return data.exams || [];
  },

  saveExamCloud: async (examData) => {
    const res = await fetch(`${API_BASE}/grade/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(examData),
    });
    await checkResponse(res, 'Không thể lưu kỳ thi lên Supabase.');
    return res.json();
  },

  deleteExamCloud: async (examId) => {
    const res = await fetch(`${API_BASE}/grade/exams/${examId}`, {
      method: 'DELETE',
    });
    await checkResponse(res, 'Không thể xóa kỳ thi trên Supabase.');
    return res.json();
  },
};
