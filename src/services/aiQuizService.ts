import { getCustomApiKey } from '../components/ApiKeySettings';

export interface GeneratedQuestionRaw {
  type: 'MC' | 'TF' | 'SA' | 'ESSAY';
  content: string;
  options?: string[];
  answer: string;
  timeLimit?: number;
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash'
];

/**
 * Trích xuất mảng JSON câu hỏi từ phản hồi văn bản của AI
 * Xử lý an toàn trường hợp AI trả về markdown ```json ... ``` hoặc văn bản kèm theo
 */
export function extractQuestionsJson(text: string): GeneratedQuestionRaw[] {
  let cleanText = text.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  }

  // Tìm vị trí mở mảng [ và đóng mảng ]
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleanText = cleanText.substring(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(cleanText);
  if (!Array.isArray(parsed)) {
    throw new Error('Dữ liệu AI trả về không phải là một danh sách câu hỏi hợp lệ.');
  }
  return parsed;
}

/**
 * Gọi trực tiếp Gemini REST API từ Client khi đang chạy trên static hosting (Netlify, Vercel, ...)
 */
async function callGeminiRestClient(contents: any[], apiKey: string): Promise<string> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        throw new Error(`Phản hồi không hợp lệ từ máy chủ Gemini: ${resText.slice(0, 100)}`);
      }

      if (!res.ok || resJson.error) {
        const errorMsg = resJson.error?.message || `Lỗi HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      const candidateText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText;
      }
      throw new Error('Không nhận được nội dung trả lời từ mô hình.');
    } catch (err: any) {
      lastError = err;
      console.warn(`[Client-AI] Thử model ${model} thất bại:`, err?.message || err);
      // Thử tiếp model dự phòng
      continue;
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API. Vui lòng kiểm tra lại kết nối mạng hoặc Khóa API.');
}

/**
 * Tạo đề từ tệp đính kèm (Ảnh, PDF, tài liệu)
 * Hỗ trợ tự động fallback khi host trên Netlify không có backend
 */
export async function generateQuizFromFileService(
  fileData: string,
  mimeType: string,
  instructions: string
): Promise<GeneratedQuestionRaw[]> {
  const customApiKey = getCustomApiKey() || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined);
  const base64Data = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;

  // Bước 1: Thử gọi server backend (/api/generate-quiz-from-file)
  let backendFailedWithHtmlOrNetlify = false;
  try {
    const res = await fetch('/api/generate-quiz-from-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData,
        mimeType,
        instructions,
        apiKey: customApiKey || undefined
      })
    });

    const contentType = res.headers.get('content-type') || '';
    const resText = await res.text();

    // Kiểm tra nếu response là HTML (ví dụ Netlify rewrite sang index.html <!DOCTYPE)
    if (resText.trim().startsWith('<') || contentType.includes('text/html')) {
      backendFailedWithHtmlOrNetlify = true;
    } else {
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        backendFailedWithHtmlOrNetlify = true;
      }

      if (data) {
        if (!res.ok || data.error) {
          throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
        }
        if (Array.isArray(data.questions)) {
          return data.questions;
        }
      }
    }
  } catch (err: any) {
    if (backendFailedWithHtmlOrNetlify || err.message?.includes('<!DOCTYPE') || err.message?.includes('JSON')) {
      backendFailedWithHtmlOrNetlify = true;
    } else {
      // Nếu là lỗi khác nhưng không phải HTML, kiểm tra xem có phải do không có backend
      backendFailedWithHtmlOrNetlify = true;
    }
  }

  // Bước 2: Xử lý khi chạy trên Netlify hoặc máy chủ backend không hoạt động
  if (backendFailedWithHtmlOrNetlify) {
    if (!customApiKey || !customApiKey.trim()) {
      throw new Error(
        'Ứng dụng đang chạy trên trang web tĩnh Netlify (không có máy chủ backend).\n\n' +
        '👉 Để tạo đề bằng AI trực tiếp trên Netlify, vui lòng bấm vào nút "Khóa API Gemini Cá Nhân" ở trên thanh công cụ và nhập mã API Key của bạn (hoàn toàn miễn phí từ Google AI Studio).'
      );
    }

    const prompt = `Bạn là một chuyên gia giáo dục. Hãy phân tích tài liệu đính kèm và tạo ra một bộ đề kiểm tra bám sát chương trình GDPT 2018.
${instructions ? `Lưu ý thêm từ người dùng: ${instructions}` : ''}

Hãy xuất ra một mảng JSON thuần túy (Array) gồm các câu hỏi theo cấu trúc:
[
  {
    "type": "MC" | "TF" | "SA" | "ESSAY",
    "content": "Nội dung câu hỏi (hỗ trợ markdown/công thức)",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], // Bắt buộc đối với MC và TF
    "answer": "A" // Đối với MC: chữ cái 'A', 'B', 'C', hoặc 'D'. Đối với TF: chuỗi JSON mảng 4 giá trị '["Đúng", "Sai", "Đúng", "Sai"]'. Đối với SA/ESSAY: chuỗi đáp án.
  }
]
Lưu ý quan trọng:
- Trắc nghiệm 4 lựa chọn (MC): options phải có đúng 4 phần tử.
- Đúng/Sai (TF): options gồm 4 ý tương ứng a, b, c, d; answer là chuỗi mảng 4 giá trị Đúng/Sai tương ứng ví dụ '["Đúng", "Sai", "Đúng", "Sai"]'.
- Điền khuyết/Trả lời ngắn (SA) & Tự luận (ESSAY): options để rỗng hoặc không cần gửi.`;

    const contents = [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    ];

    const resultText = await callGeminiRestClient(contents, customApiKey);
    return extractQuestionsJson(resultText);
  }

  throw new Error('Không thể hoàn thành yêu cầu tạo đề từ file.');
}

/**
 * Tạo đề từ yêu cầu văn bản (Prompt GDPT)
 * Hỗ trợ tự động fallback khi host trên Netlify không có backend
 */
export async function generateQuizFromTextService(
  requirements: string,
  mcqCount: number,
  tfCount: number,
  blankCount: number,
  essayCount: number
): Promise<GeneratedQuestionRaw[]> {
  const customApiKey = getCustomApiKey() || ((import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined);

  // Bước 1: Thử gọi server backend (/api/generate-quiz)
  let backendFailedWithHtmlOrNetlify = false;
  try {
    const res = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirements,
        mcqCount,
        tfCount,
        blankCount,
        essayCount,
        apiKey: customApiKey || undefined
      })
    });

    const contentType = res.headers.get('content-type') || '';
    const resText = await res.text();

    if (resText.trim().startsWith('<') || contentType.includes('text/html')) {
      backendFailedWithHtmlOrNetlify = true;
    } else {
      let data: any = null;
      try {
        data = JSON.parse(resText);
      } catch {
        backendFailedWithHtmlOrNetlify = true;
      }

      if (data) {
        if (!res.ok || data.error) {
          throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
        }
        if (Array.isArray(data.questions)) {
          return data.questions;
        }
      }
    }
  } catch (err: any) {
    backendFailedWithHtmlOrNetlify = true;
  }

  // Bước 2: Xử lý khi chạy trên Netlify hoặc máy chủ backend không hoạt động
  if (backendFailedWithHtmlOrNetlify) {
    if (!customApiKey || !customApiKey.trim()) {
      throw new Error(
        'Ứng dụng đang chạy trên trang web tĩnh Netlify (không có máy chủ backend).\n\n' +
        '👉 Để tạo đề bằng AI trực tiếp trên Netlify, vui lòng bấm vào nút "Khóa API Gemini Cá Nhân" ở trên thanh công cụ và nhập mã API Key của bạn (hoàn toàn miễn phí từ Google AI Studio).'
      );
    }

    const prompt = `Bạn là một chuyên gia giáo dục. Hãy tạo một bộ đề kiểm tra dựa trên yêu cầu sau:
Yêu cầu cần đạt: ${requirements}
Bám sát chương trình GDPT 2018, sách giáo khoa KHTN bộ kết nối tri thức.
Số lượng câu hỏi:
- Trắc nghiệm 4 lựa chọn (MC): ${mcqCount}
- Đúng - Sai (TF): ${tfCount}
- Điền khuyết / Trả lời ngắn (SA): ${blankCount}
- Tự luận (ESSAY): ${essayCount}

Hãy xuất ra một mảng JSON thuần túy (Array) gồm các câu hỏi theo cấu trúc:
[
  {
    "type": "MC" | "TF" | "SA" | "ESSAY",
    "content": "Nội dung câu hỏi (hỗ trợ markdown/công thức)",
    "options": ["Phương án A", "Phương án B", "Phương án C", "Phương án D"], // Bắt buộc đối với MC và TF
    "answer": "A" // Đối với MC: chữ cái 'A', 'B', 'C', hoặc 'D'. Đối với TF: chuỗi JSON mảng 4 giá trị '["Đúng", "Sai", "Đúng", "Sai"]'. Đối với SA/ESSAY: chuỗi đáp án.
  }
]
Lưu ý quan trọng:
- Trắc nghiệm 4 lựa chọn: options gồm 4 phần tử.
- Đúng/Sai: options gồm 4 ý tương ứng a, b, c, d; answer là chuỗi mảng 4 giá trị Đúng/Sai tương ứng ví dụ '["Đúng", "Sai", "Đúng", "Sai"]'.
- Điền khuyết/Trả lời ngắn & Tự luận: options để rỗng hoặc không cần gửi.`;

    const contents = [
      {
        parts: [{ text: prompt }]
      }
    ];

    const resultText = await callGeminiRestClient(contents, customApiKey);
    return extractQuestionsJson(resultText);
  }

  throw new Error('Không thể hoàn thành yêu cầu tạo đề AI.');
}

/**
 * Kiểm tra tính hợp lệ của Khóa API Gemini
 */
export async function testGeminiApiKeyService(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'Vui lòng nhập API Key để kiểm tra!' };
  }

  // Thử gọi backend /api/test-api-key trước
  try {
    const res = await fetch('/api/test-api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() })
    });

    const resText = await res.text();
    if (!resText.trim().startsWith('<')) {
      const data = JSON.parse(resText);
      if (res.ok && data.success) {
        return { success: true, message: 'Khóa API hoạt động rất tốt!' };
      }
      if (data.error) {
        return { success: false, message: data.error };
      }
    }
  } catch {
    // Nếu lỗi hoặc là HTML (Netlify), kiểm tra trực tiếp qua client
  }

  // Kiểm tra trực tiếp qua Gemini REST API (dành cho Netlify)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Xin chào' }] }]
      })
    });

    const data = await res.json();
    if (res.ok && data.candidates?.[0]?.content) {
      return { success: true, message: 'Khóa API Gemini hợp lệ và hoạt động bình thường trên Netlify!' };
    }
    return { success: false, message: data.error?.message || 'Khóa API không hợp lệ hoặc đã hết hạn.' };
  } catch (err: any) {
    return { success: false, message: 'Lỗi kiểm tra API Key: ' + err.message };
  }
}
