const API_BASE = 'http://localhost:8000/api';

export const api = {
  // ===== PDF Endpoints =====
  uploadPdf: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/pdf/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Upload thất bại';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  getPreviewUrl: (fileId, page = 0, dpi = 150) => {
    return `${API_BASE}/pdf/preview/${fileId}?page=${page}&dpi=${dpi}`;
  },

  convertPdf: async (fileId, mode = 'math_hd', dpi = 250, pageRange = 'all') => {
    const formData = new FormData();
    formData.append('file_id', fileId);
    formData.append('mode', mode);
    formData.append('dpi', dpi.toString());
    formData.append('page_range', pageRange);
    
    const res = await fetch(`${API_BASE}/pdf/convert`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Chuyển đổi thất bại';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  getWordContent: async (outputId) => {
    const res = await fetch(`${API_BASE}/pdf/content/${outputId}`);
    if (!res.ok) {
      let msg = 'Không thể tải nội dung tài liệu';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  saveWordContent: async (outputId, text) => {
    const res = await fetch(`${API_BASE}/pdf/save/${outputId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      let msg = 'Lưu file Word thất bại';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  getDownloadUrl: (outputId, filename = 'document.docx') => {
    return `${API_BASE}/pdf/download/${outputId}?filename=${encodeURIComponent(filename)}`;
  },

  downloadWordBlob: async (outputId, filename = 'document.docx') => {
    const url = `${API_BASE}/pdf/download/${outputId}?filename=${encodeURIComponent(filename)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let msg = 'Tải file thất bại';
        try {
          const err = await res.json();
          msg = err.detail || msg;
        } catch (e) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      return true;
    } catch (e) {
      // Direct link fallback
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }
  },

  downloadTextBlob: (text, filename = 'document.txt') => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },

  // ===== Drive Endpoints =====
  parseDriveUrl: async (url) => {
    const formData = new FormData();
    formData.append('url', url);
    const res = await fetch(`${API_BASE}/drive/parse`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Link không hợp lệ';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  getExportLink: async (url, format = 'pdf') => {
    const formData = new FormData();
    formData.append('url', url);
    formData.append('format', format);
    const res = await fetch(`${API_BASE}/drive/export-link`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let msg = 'Lỗi tạo link';
      try {
        const err = await res.json();
        msg = err.detail || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  getProxyDownloadUrl: (fileId, method = 'direct_v1') => {
    return `${API_BASE}/drive/proxy-download/${fileId}?method=${method}`;
  },

  // ===== Health =====
  healthCheck: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
};
