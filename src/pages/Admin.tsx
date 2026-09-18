import React, { useState, useEffect } from 'react';
import { useNavigate, Routes, Route, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Quiz, Question, QuestionType } from '../types';
import { 
  BrainCircuit, 
  FileUp, 
  PenLine, 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  BookOpen, 
  Eye, 
  EyeOff,
  Play, 
  Users, 
  X,
  Sparkles
} from 'lucide-react';
import ApiKeySettings, { getCustomApiKey } from '../components/ApiKeySettings';
import { generateQuizFromFileService, generateQuizFromTextService } from '../services/aiQuizService';
import { formatTFAnswer } from '../utils/scoring';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function Admin() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
              title="Quay lại Trang chủ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Quản trị Hệ thống Đề thi</h1>
              <p className="text-xs text-slate-500">Tạo, quản lý và lưu trữ bộ đề ôn luyện KHTN</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-teal-50 border border-teal-200 text-teal-700 rounded-full text-xs font-semibold">
              Quản trị viên
            </span>
            <Link 
              to="/" 
              className="text-sm font-medium text-slate-600 hover:text-teal-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/create-manual" element={<CreateManual />} />
          <Route path="/create-ai" element={<CreateAI />} />
          <Route path="/create-file" element={<CreateFile />} />
        </Routes>
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreviewQuiz, setSelectedPreviewQuiz] = useState<Quiz | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPreviewAnswers, setShowPreviewAnswers] = useState(false);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
      setQuizzes(data);
    } catch (e) {
      console.error('Error fetching quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleDeleteQuiz = async (quizId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bộ đề "${title}" không?`)) return;
    setDeletingId(quizId);
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch (e: any) {
      alert('Không thể xóa đề: ' + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Custom Gemini API Key Settings Panel */}
      <ApiKeySettings />

      {/* Creation Navigation Card */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề mới</h2>
          <p className="text-slate-500 mt-1">Chọn phương thức tạo đề thi phù hợp với nhu cầu giảng dạy của bạn.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link 
            to="create-manual" 
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 hover:border-teal-500 hover:text-teal-600 text-slate-700 font-semibold rounded-2xl transition-all"
          >
            <PenLine className="w-5 h-5 text-teal-600" />
            Thủ công
          </Link>
          <Link 
            to="create-file" 
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 font-semibold rounded-2xl transition-all"
          >
            <FileUp className="w-5 h-5 text-blue-600" />
            Từ File (PDF / Ảnh)
          </Link>
          <Link 
            to="create-ai" 
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-md font-semibold rounded-2xl transition-all"
          >
            <BrainCircuit className="w-5 h-5" />
            Tạo bằng AI (Chuẩn GDPT)
          </Link>
        </div>
      </div>

      {/* Quizzes List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-600" />
            Kho đề lưu trữ ({quizzes.length})
          </h3>
          <button
            onClick={fetchQuizzes}
            className="text-xs text-slate-500 hover:text-teal-600 font-medium px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Làm mới danh sách
          </button>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-2" />
            <span className="text-sm text-slate-500">Đang tải kho đề thi...</span>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border-2 border-slate-200 border-dashed">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 text-lg font-medium">Chưa có bộ đề nào trong cơ sở dữ liệu.</p>
            <p className="text-slate-400 text-sm mt-1 mb-6">Hãy tạo đề thi đầu tiên bằng AI hoặc từ file tài liệu.</p>
            <Link 
              to="create-ai" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              <BrainCircuit className="w-5 h-5" /> Tạo đề ngay bằng AI
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map(quiz => (
              <div 
                key={quiz.id} 
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold">
                      {quiz.subject || 'KHTN'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <h4 className="font-bold text-lg text-slate-800 mb-2 line-clamp-2" title={quiz.title}>
                    {quiz.title}
                  </h4>
                  
                  <div className="text-sm text-slate-500 mb-5 space-y-1">
                    <p className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Tổng số câu hỏi: <strong className="text-slate-700">{quiz.questions?.length || 0} câu</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/practice"
                      className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Mở chế độ tự luyện cho học sinh"
                    >
                      <Play className="w-3.5 h-3.5 fill-blue-700" /> Tự luyện
                    </Link>
                    <Link
                      to={`/host/board/${quiz.id}`}
                      className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Tổ chức thi đấu trực tiếp cả lớp"
                    >
                      <Users className="w-3.5 h-3.5" /> Chơi cả lớp
                    </Link>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedPreviewQuiz(quiz)}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors text-xs flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem câu hỏi
                    </button>
                    <button 
                      onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                      disabled={deletingId === quiz.id}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors text-xs flex items-center justify-center disabled:opacity-50"
                      title="Xóa bộ đề"
                    >
                      {deletingId === quiz.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedPreviewQuiz && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {selectedPreviewQuiz.subject || 'KHTN'}
                </span>
                <h3 className="text-xl font-bold text-slate-800 mt-1">{selectedPreviewQuiz.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tổng cộng {selectedPreviewQuiz.questions?.length || 0} câu hỏi • Thang điểm 10 (Đúng-Sai: 1.0 đ • Trả lời ngắn: 0.5 đ • Trắc nghiệm: chia đều)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreviewAnswers(!showPreviewAnswers)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Mở hoặc ẩn đáp án"
                >
                  {showPreviewAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPreviewAnswers ? 'Ẩn đáp án' : 'Hiển thị đáp án'}</span>
                </button>
                <button
                  onClick={() => setSelectedPreviewQuiz(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {selectedPreviewQuiz.questions?.map((q, idx) => (
                <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded-md">
                        Câu {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {q.type === 'MC' ? 'Trắc nghiệm 4 lựa chọn' : q.type === 'TF' ? 'Đúng - Sai (4 ý)' : q.type === 'SA' ? 'Trả lời ngắn' : 'Tự luận'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {q.type === 'TF' ? '1.0 điểm (0.25 đ/ý)' : q.type === 'SA' ? '0.5 điểm' : 'Trắc nghiệm'}
                    </span>
                  </div>

                  <p className="font-medium text-slate-800 whitespace-pre-wrap mb-3">{q.content}</p>

                  {/* Multiple Choice (MC) */}
                  {q.type === 'MC' && q.options && (
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => {
                          const letter = ['A','B','C','D'][oIdx];
                          const isCorrect = showPreviewAnswers && (q.answer === letter || opt.trim().toLowerCase() === (q.answer || '').trim().toLowerCase());

                          return (
                            <div 
                              key={oIdx} 
                              className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-400 font-semibold text-emerald-800'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {letter}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            </div>
                          );
                        })}
                      </div>
                      {showPreviewAnswers && (
                        <div className="text-xs font-semibold text-emerald-700">
                          Đáp án đúng: <strong className="font-mono text-sm">{q.answer}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* True - False (TF) */}
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 mb-3">
                      {showPreviewAnswers && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800">
                          Đáp án: <span className="font-mono text-teal-800 text-sm sm:text-base">{formatTFAnswer(q.answer, idx + 1)}</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => {
                          let ansArr: string[] = [];
                          try { 
                            ansArr = Array.isArray(q.answer) ? q.answer : JSON.parse(q.answer); 
                          } catch {}
                          const isTrue = ansArr[oIdx] === 'Đúng';

                          return (
                            <div key={oIdx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-sm">
                              <span><strong className="font-mono">{['a','b','c','d'][oIdx]})</strong> {opt}</span>
                              {showPreviewAnswers ? (
                                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${isTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {isTrue ? 'Đúng' : 'Sai'}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Đúng/Sai</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Short Answer / Essay */}
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    showPreviewAnswers ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                        <strong>Đáp án chính xác:</strong> <span className="font-mono">{q.answer}</span>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-xs italic">
                        (Đáp án đang được ẩn)
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedPreviewQuiz(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateManual() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  // New question form state
  const [qType, setQType] = useState<QuestionType>('MC');
  const [qContent, setQContent] = useState('');
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [mcAnswer, setMcAnswer] = useState('A');
  const [tfOptions, setTfOptions] = useState(['', '', '', '']);
  const [tfAnswers, setTfAnswers] = useState(['Đúng', 'Sai', 'Đúng', 'Sai']);
  const [saAnswer, setSaAnswer] = useState('');

  const handleAddQuestion = () => {
    if (!qContent.trim()) return alert('Vui lòng nhập nội dung câu hỏi!');

    let newQ: Question;

    if (qType === 'MC') {
      if (mcOptions.some(opt => !opt.trim())) {
        return alert('Vui lòng nhập đủ 4 lựa chọn A, B, C, D!');
      }
      newQ = {
        id: `q-${Date.now()}-${questions.length}`,
        type: 'MC',
        content: qContent.trim(),
        options: mcOptions.map(o => o.trim()),
        answer: mcAnswer,
        timeLimit: 30
      };
    } else if (qType === 'TF') {
      if (tfOptions.some(opt => !opt.trim())) {
        return alert('Vui lòng nhập đủ 4 nhận định a, b, c, d!');
      }
      newQ = {
        id: `q-${Date.now()}-${questions.length}`,
        type: 'TF',
        content: qContent.trim(),
        options: tfOptions.map(o => o.trim()),
        answer: JSON.stringify(tfAnswers),
        timeLimit: 60
      };
    } else {
      if (!saAnswer.trim()) return alert('Vui lòng nhập đáp án cho câu hỏi!');
      newQ = {
        id: `q-${Date.now()}-${questions.length}`,
        type: qType,
        content: qContent.trim(),
        answer: saAnswer.trim(),
        timeLimit: 60
      };
    }

    setQuestions(prev => [...prev, newQ]);
    // Reset form
    setQContent('');
    setMcOptions(['', '', '', '']);
    setTfOptions(['', '', '', '']);
    setSaAnswer('');
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert('Vui lòng nhập tên bộ đề!');
    if (questions.length === 0) return alert('Vui lòng thêm ít nhất 1 câu hỏi!');

    setIsSaving(true);
    try {
      const quizData: Omit<Quiz, 'id'> = {
        title: title.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions
      };
      await addDoc(collection(db, 'quizzes'), quizData);
      alert('Đã lưu bộ đề thành công vào hệ thống!');
      navigate('/admin');
    } catch (e: any) {
      alert('Lỗi lưu đề: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Soạn đề thủ công</h2>
          <p className="text-slate-500 text-sm">Thêm từng câu hỏi chuẩn theo định dạng mong muốn.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800">Thông tin bộ đề</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1">Tên bộ đề</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ví dụ: Ôn tập Chương 1 - Nguyên tử và Nguyên tố hóa học"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Môn học</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Add question box */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-5">
        <h3 className="font-bold text-slate-800 flex items-center justify-between">
          <span>Thêm câu hỏi mới</span>
          <div className="flex gap-1.5">
            {(['MC', 'TF', 'SA', 'ESSAY'] as QuestionType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setQType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  qType === t
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'MC' ? 'Trắc nghiệm' : t === 'TF' ? 'Đúng-Sai' : t === 'SA' ? 'Trả lời ngắn' : 'Tự luận'}
              </button>
            ))}
          </div>
        </h3>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Nội dung câu hỏi (hỗ trợ công thức $...$)</label>
          <textarea
            value={qContent}
            onChange={e => setQContent(e.target.value)}
            placeholder="Nhập nội dung câu hỏi..."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none min-h-[90px]"
          />
        </div>

        {qType === 'MC' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-600">4 Lựa chọn và Chọn đáp án đúng</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {letter}
                  </span>
                  <input
                    type="text"
                    value={mcOptions[i]}
                    onChange={e => {
                      const next = [...mcOptions];
                      next[i] = e.target.value;
                      setMcOptions(next);
                    }}
                    placeholder={`Lựa chọn ${letter}...`}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <input
                    type="radio"
                    name="correct-mc"
                    checked={mcAnswer === letter}
                    onChange={() => setMcAnswer(letter)}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                    title={`Chọn ${letter} là đáp án đúng`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {qType === 'TF' && (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-600">4 Ý Đúng - Sai (a, b, c, d)</label>
            <div className="space-y-2">
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {letter}
                  </span>
                  <input
                    type="text"
                    value={tfOptions[i]}
                    onChange={e => {
                      const next = [...tfOptions];
                      next[i] = e.target.value;
                      setTfOptions(next);
                    }}
                    placeholder={`Ý ${letter}...`}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <select
                    value={tfAnswers[i]}
                    onChange={e => {
                      const next = [...tfAnswers];
                      next[i] = e.target.value;
                      setTfAnswers(next);
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border ${
                      tfAnswers[i] === 'Đúng' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-rose-50 text-rose-700 border-rose-300'
                    }`}
                  >
                    <option value="Đúng">Đúng</option>
                    <option value="Sai">Sai</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {(qType === 'SA' || qType === 'ESSAY') && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Đáp án mẫu / Từ khóa chấm</label>
            <input
              type="text"
              value={saAnswer}
              onChange={e => setSaAnswer(e.target.value)}
              placeholder="Nhập đáp án..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Thêm câu hỏi vào danh sách
        </button>
      </div>

      {/* List of added questions */}
      {questions.length > 0 && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Danh sách câu hỏi đã thêm ({questions.length})</h3>
            <button
              onClick={handleSaveQuiz}
              disabled={isSaving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Lưu Bộ Đề Vào Hệ Thống
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded">
                      Câu {i + 1}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold uppercase">{q.type}</span>
                  </div>
                  <p className="font-medium text-slate-800 text-sm">{q.content}</p>
                </div>
                <button
                  onClick={() => setQuestions(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Xóa câu hỏi này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateFile() {
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file) return alert("Vui lòng chọn một tệp tài liệu!");
    setIsGenerating(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const fileData = reader.result as string;
        try {
          const questions = await generateQuizFromFileService(
            fileData,
            file.type,
            instructions
          );
          
          const parsedQuestions = questions.map((q: any, i: number) => ({
            id: `q-${Date.now()}-${i}`,
            type: q.type,
            content: q.content,
            options: q.options || [],
            answer: q.answer,
            timeLimit: q.type === 'MC' ? 30 : 60
          }));
          setGeneratedQuestions(parsedQuestions);
          if (!quizTitle) {
            setQuizTitle(`Bộ đề từ tài liệu: ${file.name.replace(/\.[^/.]+$/, "")}`);
          }
        } catch (err: any) {
          alert("Lỗi tạo đề từ file: " + err.message);
        } finally {
          setIsGenerating(false);
        }
      };
    } catch (e: any) {
      alert("Lỗi đọc file: " + e.message);
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!quizTitle.trim()) return alert("Vui lòng nhập tên đề!");
    if (generatedQuestions.length === 0) return alert("Chưa có câu hỏi nào!");
    setIsSaving(true);
    try {
      const quizData: Omit<Quiz, 'id'> = {
        title: quizTitle.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions: generatedQuestions
      };
      
      await addDoc(collection(db, 'quizzes'), quizData);
      alert("Lưu bộ đề vào cơ sở dữ liệu thành công! Có thể dùng nhiều lần.");
      navigate('/admin');
    } catch (e: any) {
      alert("Lỗi lưu đề: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề từ File tài liệu</h2>
          <p className="text-slate-500 text-sm">Hỗ trợ nhận diện tự động từ PDF, tài liệu hoặc ảnh chụp đề thi.</p>
        </div>
      </div>

      {/* API Key Panel */}
      <ApiKeySettings />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        {generatedQuestions.length === 0 ? (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors bg-slate-50">
              <input 
                type="file" 
                accept=".pdf,image/png,image/jpeg,image/webp" 
                onChange={handleFileChange} 
                className="hidden" 
                id="file-upload" 
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                <FileUp className="w-12 h-12 text-blue-400 mb-4" />
                <span className="text-lg font-semibold text-slate-700">
                  {file ? file.name : "Nhấn để chọn file tài liệu (PDF, PNG, JPG)"}
                </span>
                <span className="text-sm text-slate-500 mt-2">Hỗ trợ nhận diện đề thi từ ảnh chụp hoặc file PDF</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Lưu ý bổ sung cho AI (Tùy chọn)</label>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow min-h-[100px] resize-y"
                placeholder="Ví dụ: Lấy 10 câu trắc nghiệm và 2 câu đúng sai bám sát file, chuẩn bị KaTeX cho các công thức..."
              />
            </div>
            
            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !file}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <BrainCircuit className="w-6 h-6" />}
                {isGenerating ? 'AI đang phân tích file và tạo đề...' : 'Phân tích file & Tạo bộ đề'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Tên bộ đề</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="Nhập tên bộ đề..."
                    className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-900 mb-1">Danh mục / Môn học</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !quizTitle}
                  className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Lưu Vào Dữ Liệu
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center justify-between">
                <span>Xem trước câu hỏi ({generatedQuestions.length})</span>
                <button onClick={() => setGeneratedQuestions([])} className="text-sm font-normal text-red-500 hover:underline">Tạo lại</button>
              </h3>
              
              {generatedQuestions.map((q, idx) => (
                <div key={q.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex gap-2 items-start mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 font-bold rounded-lg">
                      {idx + 1}
                    </span>
                    <div className="flex-1 text-slate-800 font-medium pt-1 whitespace-pre-wrap">
                      {q.content}
                    </div>
                  </div>
                  
                  {q.type === 'MC' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${q.answer === ['A','B','C','D'][i] ? 'bg-indigo-50 border-indigo-300 font-semibold text-indigo-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {['A','B','C','D'][i]}. {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 pl-10 mb-4">
                      {q.options.map((opt, i) => {
                        let ansArr = [];
                        try { ansArr = JSON.parse(q.answer); } catch(e) {}
                        const isTrue = ansArr[i] === 'Đúng';
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                            <div className="flex-1">{['A','B','C','D'][i]}) {opt}</div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isTrue ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isTrue ? 'Đúng' : 'Sai'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    <div className="pl-10">
                      <div className="p-4 bg-white border border-indigo-200 rounded-xl text-indigo-700 font-medium">
                        Đáp án: {q.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAI() {
  const [reqs, setReqs] = useState('');
  const [mcqCount, setMcqCount] = useState(6);
  const [tfCount, setTfCount] = useState(2);
  const [blankCount, setBlankCount] = useState(2);
  const [essayCount, setEssayCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [subject, setSubject] = useState('KHTN');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!reqs.trim()) return alert("Vui lòng nhập yêu cầu cần đạt hoặc chủ đề kiến thức!");
    setIsGenerating(true);
    try {
      const questions = await generateQuizFromTextService(
        reqs,
        mcqCount,
        tfCount,
        blankCount,
        essayCount
      );
      
      const parsedQuestions = questions.map((q: any, i: number) => ({
        id: `q-${Date.now()}-${i}`,
        type: q.type,
        content: q.content,
        options: q.options || [],
        answer: q.answer,
        timeLimit: q.type === 'MC' ? 30 : 60
      }));
      setGeneratedQuestions(parsedQuestions);
      if (!quizTitle) {
        setQuizTitle(`Bộ đề ôn tập KHTN: ${reqs.slice(0, 40)}...`);
      }
    } catch (e: any) {
      alert("Lỗi tạo đề AI: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!quizTitle.trim()) return alert("Vui lòng nhập tên đề!");
    if (generatedQuestions.length === 0) return alert("Chưa có câu hỏi nào!");
    setIsSaving(true);
    try {
      const quizData: Omit<Quiz, 'id'> = {
        title: quizTitle.trim(),
        subject: subject.trim() || 'KHTN',
        createdBy: 'admin',
        createdAt: Date.now(),
        questions: generatedQuestions
      };
      
      await addDoc(collection(db, 'quizzes'), quizData);
      alert("Đã lưu bộ đề vào hệ thống! Bạn có thể sử dụng nhiều lần.");
      navigate('/admin');
    } catch (e: any) {
      alert("Lỗi lưu đề: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Tạo đề tự động bằng AI</h2>
          <p className="text-slate-500 text-sm">Bám sát chương trình GDPT 2018, cấu trúc 4 phần chuẩn khoa học.</p>
        </div>
      </div>

      {/* Free API Key Panel */}
      <ApiKeySettings />

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        {generatedQuestions.length === 0 ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Yêu cầu cần đạt / Nội dung kiến thức ôn tập
              </label>
              <textarea
                value={reqs}
                onChange={e => setReqs(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow min-h-[120px] resize-y text-slate-800"
                placeholder="Ví dụ: Ôn tập về Kim loại, phản ứng của kim loại với phi kim, axit. Viết phương trình hóa học và công thức tính toán. Bám sát SGK KHTN Kết nối tri thức..."
              />
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Trắc nghiệm 4 lựa chọn</label>
                <input 
                  type="number" 
                  min="0" 
                  max="40"
                  value={mcqCount} 
                  onChange={e => setMcqCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Đúng - Sai (4 ý)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={tfCount} 
                  onChange={e => setTfCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Trả lời ngắn / Điền khuyết</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={blankCount} 
                  onChange={e => setBlankCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-600 mb-1">Tự luận giải thích</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={essayCount} 
                  onChange={e => setEssayCount(Number(e.target.value))} 
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-teal-700" 
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                {isGenerating ? 'AI đang phân tích và tạo bộ đề theo chuẩn...' : 'Bắt đầu tạo bộ đề bằng AI'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-teal-50 border border-teal-100 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-sm font-semibold text-teal-900 mb-1">Tên bộ đề</label>
                  <input
                    type="text"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    placeholder="Nhập tên bộ đề..."
                    className="w-full p-3 bg-white border border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-teal-900 mb-1">Danh mục / Môn học</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full p-3 bg-white border border-teal-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !quizTitle}
                  className="w-full md:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Lưu Bộ Đề Vào Dữ Liệu
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-800">
                  Xem trước câu hỏi ({generatedQuestions.length})
                </h3>
                <button 
                  onClick={() => setGeneratedQuestions([])} 
                  className="text-sm font-semibold text-red-500 hover:underline"
                >
                  Tạo lại
                </button>
              </div>
              
              {generatedQuestions.map((q, idx) => (
                <div key={q.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex gap-2 items-start mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-teal-100 text-teal-700 font-bold rounded-lg">
                      {idx + 1}
                    </span>
                    <div className="flex-1 text-slate-800 font-medium pt-1 whitespace-pre-wrap">
                      {q.content}
                    </div>
                  </div>
                  
                  {q.type === 'MC' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 mb-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${q.answer === ['A','B','C','D'][i] ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {['A','B','C','D'][i]}. {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.type === 'TF' && q.options && (
                    <div className="space-y-2 pl-10 mb-4">
                      {q.options.map((opt, i) => {
                        let ansArr = [];
                        try { ansArr = JSON.parse(q.answer); } catch(e) {}
                        const isTrue = ansArr[i] === 'Đúng';
                        return (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                            <div className="flex-1">{['A','B','C','D'][i]}) {opt}</div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {isTrue ? 'Đúng' : 'Sai'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {(q.type === 'SA' || q.type === 'ESSAY') && (
                    <div className="pl-10">
                      <div className="p-4 bg-white border border-emerald-200 rounded-xl text-emerald-700 font-medium">
                        Đáp án: {q.answer}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
