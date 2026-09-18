import React, { useState, useEffect, useMemo } from 'react';
import { db, googleSignIn, getAccessToken } from '../lib/firebase';
import { collection, getDocs, addDoc, query, orderBy } from 'firebase/firestore';
import { Quiz, PracticeResult, Question } from '../types';
import { 
  Loader2, 
  ArrowLeft, 
  BookOpen, 
  Clock, 
  Trophy, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Home, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { shuffleQuiz } from '../utils/shuffleQuiz';
import { 
  calculateScoreBreakdown, 
  gradeQuestion, 
  formatTFAnswer, 
  parseTFAnswerList, 
  normalizeTFChar 
} from '../utils/scoring';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

interface QuestionResult {
  question: Question;
  userAnswer: any;
  earned: number;
  max: number;
  isFullyCorrect: boolean;
  tfDetails?: { statementIdx: number; isCorrect: boolean; studentVal: string; correctVal: string }[];
}

export default function Practice() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  
  const [isStarted, setIsStarted] = useState(false);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [showAnswerInQuiz, setShowAnswerInQuiz] = useState(false);
  const [resultsList, setResultsList] = useState<QuestionResult[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllAnswersInSummary, setShowAllAnswersInSummary] = useState(false);

  // Score breakdown
  const breakdown = useMemo(() => {
    return selectedQuiz ? calculateScoreBreakdown(selectedQuiz.questions) : null;
  }, [selectedQuiz]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setQuizzes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  // KaTeX rendering
  useEffect(() => {
    const container = document.getElementById('practice-question');
    if (container) {
      renderMathInElement(container, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }

    const reviewContainer = document.getElementById('summary-review-list');
    if (reviewContainer) {
      renderMathInElement(reviewContainer, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false,
      });
    }
  });

  const handleStart = async () => {
    if (!name.trim() || !className.trim() || !selectedQuiz) {
      return alert("Vui lòng nhập đủ họ tên, lớp và chọn bộ đề để bắt đầu!");
    }

    // Shuffle questions within each section and choices inside each question
    const randomizedQuiz = shuffleQuiz(selectedQuiz);
    setSelectedQuiz(randomizedQuiz);
    setCurrentQIdx(0);
    setCurrentAnswer(null);
    setResultsList([]);
    setShowAnswerInQuiz(false);

    // Optional Google sign in for Google Sheets sync
    try {
      let token = await getAccessToken();
      if (!token) {
        try {
          const res = await googleSignIn();
          token = res?.accessToken || null;
        } catch {
          // Allow student to proceed
        }
      }
    } catch {
      // Ignored
    }

    setIsStarted(true);
    setStartTime(Date.now());
  };

  const handleNext = async () => {
    if (!selectedQuiz || !breakdown) return;
    
    const currentQ = selectedQuiz.questions[currentQIdx];
    const grade = gradeQuestion(currentQ, currentAnswer, breakdown);

    const questionResult: QuestionResult = {
      question: currentQ,
      userAnswer: currentAnswer,
      earned: grade.earned,
      max: grade.max,
      isFullyCorrect: grade.isFullyCorrect,
      tfDetails: grade.tfDetails,
    };

    const updatedResults = [...resultsList, questionResult];
    setResultsList(updatedResults);

    if (currentQIdx < selectedQuiz.questions.length - 1) {
      setCurrentQIdx(prev => prev + 1);
      setCurrentAnswer(null);
      setShowAnswerInQuiz(false);
    } else {
      // Finish quiz
      setIsFinished(true);
      setIsSaving(true);
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      
      // Calculate total score out of 10
      const totalEarned = updatedResults.reduce((sum, item) => sum + item.earned, 0);
      const finalScore = Math.min(10.0, Math.max(0, Number(totalEarned.toFixed(2))));
      
      try {
        const resultData: Omit<PracticeResult, 'id'> = {
          quizId: selectedQuiz.id,
          playerName: name,
          playerClass: className,
          score: finalScore,
          timeSpent,
          createdAt: Date.now()
        };
        
        // Save to Firestore
        await addDoc(collection(db, 'practiceResults'), resultData);
        
        // Save to Google Sheets if token available
        const token = await getAccessToken();
        if (token) {
          await fetch('/api/append-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              sheetName: 'KetQuaOnLuyen',
              rowData: [name, className, selectedQuiz.title, finalScore.toFixed(2).toString(), timeSpent.toString()]
            })
          });
        }
      } catch (e) {
        console.error("Save error", e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // 1. SETUP / SELECTION SCREEN
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to="/" 
                className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-100 transition-colors"
                title="Quay lại Trang chủ"
              >
                <ArrowLeft className="w-6 h-6 text-slate-700" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800">Chế độ Tự luyện KHTN</h1>
                <p className="text-slate-500 text-sm">Làm bài độc lập theo chuẩn GDPT 2018 • Thang điểm 10</p>
              </div>
            </div>
            <Link 
              to="/admin" 
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50"
            >
              Quản trị đề
            </Link>
          </header>

          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Họ và tên học sinh *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-slate-800" 
                  placeholder="Ví dụ: Nguyễn Văn A" 
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Lớp *</label>
                <input 
                  type="text" 
                  value={className} 
                  onChange={e => setClassName(e.target.value)} 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-slate-800" 
                  placeholder="Ví dụ: 8A1 hoặc 9A" 
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-slate-700">Chọn bộ đề ôn luyện ({quizzes.length}) *</label>
                <span className="text-xs text-slate-400">Tự động xáo trộn câu hỏi và đáp án mỗi lần làm</span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-2" />
                  <p className="text-sm">Đang tải kho đề thi...</p>
                </div>
              ) : quizzes.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-600 font-medium">Chưa có bộ đề nào trong hệ thống.</p>
                  <Link to="/admin" className="text-teal-600 font-bold text-sm underline mt-2 inline-block">
                    Tạo đề mới tại đây
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-72 overflow-y-auto pr-1">
                  {quizzes.map(q => (
                    <button 
                      key={q.id}
                      onClick={() => setSelectedQuiz(q)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                        selectedQuiz?.id === q.id 
                          ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20' 
                          : 'border-slate-200 bg-white hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">
                          {q.subject || 'KHTN'}
                        </span>
                        <span className="text-xs text-teal-600 font-bold">{q.questions.length} câu</span>
                      </div>
                      <h4 className="font-bold text-slate-800 line-clamp-2 text-base">{q.title}</h4>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scoring Scheme Note */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm text-slate-600 space-y-1">
              <strong className="text-teal-700 block">Quy chuẩn tính điểm hệ thống:</strong>
              <p>• <strong>Đúng - Sai:</strong> 1.0 điểm/câu (mỗi ý đúng đạt 0.25 điểm)</p>
              <p>• <strong>Trả lời ngắn:</strong> 0.5 điểm/câu</p>
              <p>• <strong>Trắc nghiệm 4 lựa chọn:</strong> Số điểm còn lại chia đều cho các câu, tổng 10.0 điểm</p>
            </div>

            <button 
              onClick={handleStart}
              disabled={!selectedQuiz || !name.trim() || !className.trim()}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-lg rounded-2xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" /> Bắt đầu làm bài tự luyện
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. FINISHED / SUMMARY SCREEN
  if (isFinished) {
    const totalEarned = resultsList.reduce((sum, item) => sum + item.earned, 0);
    const finalScore = Math.min(10.0, Math.max(0, Number(totalEarned.toFixed(2))));
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">
          
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center relative overflow-hidden">
            <div className="w-20 h-20 rounded-full bg-yellow-50 border-4 border-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-yellow-500" />
            </div>
            
            <h1 className="text-3xl font-black text-slate-800">Hoàn thành bài tự luyện!</h1>
            <p className="text-slate-500 text-base mt-1">
              Học sinh: <strong className="text-slate-800">{name}</strong> • Lớp: <strong className="text-slate-800">{className}</strong>
            </p>

            <div className="my-6 inline-flex flex-col items-center justify-center px-10 py-5 bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-3xl shadow-sm">
              <span className="text-xs uppercase font-bold tracking-wider text-teal-700">Tổng điểm đạt được</span>
              <div className="text-6xl font-black text-teal-600 tracking-tight my-1">
                {finalScore.toFixed(2)} <span className="text-2xl text-slate-400 font-bold">/ 10</span>
              </div>
              <span className="text-xs text-slate-500">
                Thời gian làm bài: {minutes > 0 ? `${minutes} phút ` : ''}{seconds} giây
              </span>
            </div>

            {isSaving && (
              <p className="text-xs text-teal-600 font-medium flex items-center justify-center gap-1.5 mb-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang đồng bộ kết quả vào hệ thống...
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setShowAllAnswersInSummary(!showAllAnswersInSummary)}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 text-sm"
              >
                {showAllAnswersInSummary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showAllAnswersInSummary ? 'Ẩn toàn bộ đáp án' : 'Hiển thị toàn bộ đáp án'}</span>
              </button>
              <button
                onClick={() => {
                  setIsFinished(false);
                  setIsStarted(false);
                }}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors flex items-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Luyện tập lại
              </button>
              <Link 
                to="/"
                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl transition-colors flex items-center gap-2 text-sm"
              >
                <Home className="w-4 h-4" /> Trang chủ
              </Link>
            </div>
          </div>

          {/* Detailed Question Review with Answers */}
          {showAllAnswersInSummary && (
            <div id="summary-review-list" className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Chi tiết đáp án & kết quả từng câu</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đúng-sai: 1.0 đ/câu (0.25 đ/ý) • Trả lời ngắn: 0.5 đ/câu • Trắc nghiệm: {breakdown?.mcScorePerQ.toFixed(2)} đ/câu
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg">
                  {resultsList.length} câu hỏi
                </span>
              </div>

              <div className="space-y-4">
                {resultsList.map((res, i) => {
                  const q = res.question;
                  const isTF = q.type === 'TF';
                  const isMC = q.type === 'MC';
                  const isSA = q.type === 'SA' || q.type === 'ESSAY';

                  return (
                    <div 
                      key={i}
                      className={`p-5 rounded-2xl border-2 transition-all ${
                        res.isFullyCorrect 
                          ? 'bg-emerald-50/40 border-emerald-300' 
                          : res.earned > 0 
                          ? 'bg-amber-50/40 border-amber-300' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-slate-800 text-white font-black text-xs rounded-lg">
                            Câu {i + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-500 uppercase">
                            {isMC ? 'Trắc nghiệm' : isTF ? 'Đúng - Sai' : 'Trả lời ngắn'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
                            res.earned === res.max 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : res.earned > 0 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            +{res.earned.toFixed(2)} / {res.max.toFixed(2)} đ
                          </span>
                        </div>
                      </div>

                      {/* Question Content */}
                      <p className="font-semibold text-slate-800 text-base mb-3 whitespace-pre-wrap">{q.content}</p>

                      {/* Display formatted answer for TF */}
                      {isTF && (
                        <div className="space-y-2">
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm font-bold text-slate-800">
                            Đáp án chính thức: <span className="font-mono text-teal-700 text-base">{formatTFAnswer(q.answer, i + 1)}</span>
                          </div>

                          {q.options && (
                            <div className="space-y-1.5 pl-2">
                              {q.options.map((opt, oIdx) => {
                                const detail = res.tfDetails ? res.tfDetails[oIdx] : null;
                                const isItemCorrect = detail?.isCorrect ?? false;
                                const studentChoice = detail?.studentVal || 'Chưa chọn';
                                const correctChoice = detail?.correctVal || 'Đ';

                                return (
                                  <div 
                                    key={oIdx} 
                                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                      isItemCorrect ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-white border-rose-200 text-rose-900'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <strong className="font-mono text-sm">{['a','b','c','d'][oIdx]})</strong>
                                      <span>{opt}</span>
                                    </div>
                                    <div className="flex items-center gap-2 font-bold flex-shrink-0">
                                      <span className="text-slate-500">Bạn: {studentChoice}</span>
                                      <span className={isItemCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                                        (Đúng là: {correctChoice})
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 font-bold">
                                        {isItemCorrect ? '+0.25 đ' : '0 đ'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Display formatted answer for MC */}
                      {isMC && q.options && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {q.options.map((opt, oIdx) => {
                              const letter = ['A','B','C','D'][oIdx];
                              const isCorrectOpt = q.answer === letter || opt.trim().toLowerCase() === (q.answer || '').trim().toLowerCase();
                              const isChosen = res.userAnswer === letter;

                              return (
                                <div 
                                  key={oIdx}
                                  className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-100/70 border-emerald-300 font-bold text-emerald-900' 
                                      : isChosen 
                                      ? 'bg-rose-50 border-rose-300 text-rose-800' 
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs">
                                    {letter}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                                  {isChosen && !isCorrectOpt && <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-xs font-semibold text-slate-600">
                            Đáp án đúng: <strong className="text-emerald-700 font-mono text-sm">{q.answer}</strong>
                            {res.userAnswer && <span> • Bạn chọn: <strong className="font-mono">{res.userAnswer}</strong></span>}
                          </div>
                        </div>
                      )}

                      {/* Display answer for SA / Essay */}
                      {isSA && (
                        <div className="space-y-1.5 text-sm bg-white p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="text-slate-500 font-semibold">Đáp án chính xác: </span>
                            <strong className="text-teal-700 font-mono">{q.answer}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 font-semibold">Câu trả lời của bạn: </span>
                            <span className="font-mono text-slate-800">{res.userAnswer || '(Bỏ trống)'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. ACTIVE QUESTION SCREEN
  const currentQ = selectedQuiz!.questions[currentQIdx];
  const isTF = currentQ.type === 'TF';
  const isMC = currentQ.type === 'MC';
  const isSA = currentQ.type === 'SA' || currentQ.type === 'ESSAY';

  const qPointLabel = isTF 
    ? '1.0 điểm (mỗi ý 0.25 đ)' 
    : isSA 
    ? '0.5 điểm' 
    : `${breakdown?.mcScorePerQ.toFixed(2) || '0.5'} điểm`;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col p-3 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col space-y-4">
        
        {/* Progress Bar & Header */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-teal-600 text-white font-black px-3.5 py-1 rounded-xl text-sm md:text-base">
              Câu {currentQIdx + 1} / {selectedQuiz!.questions.length}
            </span>
            <span className="text-xs md:text-sm font-bold text-slate-500">
              {isMC ? 'Trắc nghiệm' : isTF ? 'Đúng - Sai' : 'Trả lời ngắn'} • {qPointLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Show Answer in Quiz Toggle */}
            <button
              onClick={() => setShowAnswerInQuiz(!showAnswerInQuiz)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Xem đáp án gợi ý"
            >
              {showAnswerInQuiz ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAnswerInQuiz ? 'Ẩn đáp án' : 'Xem đáp án'}</span>
            </button>
            <span className="text-xs font-semibold text-slate-400">
              {name} ({className})
            </span>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200 flex-1 flex flex-col justify-between">
          <div>
            <div 
              id="practice-question" 
              className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-800 leading-snug mb-8 whitespace-pre-wrap"
            >
              {currentQ.content}
            </div>

            {/* In-quiz answer reveal box */}
            {showAnswerInQuiz && (
              <div className="p-4 bg-teal-50 border-2 border-teal-300 rounded-2xl mb-8 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 font-bold text-teal-800 text-sm md:text-base">
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                  <span>Đáp án đúng:</span>
                  {isTF ? (
                    <span className="font-mono text-teal-950 font-black">
                      {formatTFAnswer(currentQ.answer, currentQIdx + 1)}
                    </span>
                  ) : isMC ? (
                    <span className="font-mono text-teal-950 font-black">Lựa chọn {currentQ.answer}</span>
                  ) : (
                    <span className="font-mono text-teal-950 font-black">{currentQ.answer}</span>
                  )}
                </div>
              </div>
            )}

            {/* Multiple Choice Options */}
            {isMC && currentQ.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentQ.options.map((opt, i) => {
                  const letter = ['A', 'B', 'C', 'D'][i];
                  const isSelected = currentAnswer === letter;
                  const isCorrect = showAnswerInQuiz && (currentQ.answer === letter || opt.trim().toLowerCase() === (currentQ.answer || '').trim().toLowerCase());

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentAnswer(letter)}
                      className={`text-left p-5 md:p-6 rounded-2xl border-2 transition-all flex gap-4 items-center cursor-pointer ${
                        isSelected 
                          ? 'border-teal-600 bg-teal-50/80 ring-4 ring-teal-100' 
                          : isCorrect 
                          ? 'border-emerald-500 bg-emerald-50' 
                          : 'border-slate-200 hover:border-teal-300 bg-white'
                      }`}
                    >
                      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {letter}
                      </span>
                      <span className="font-bold text-lg md:text-xl text-slate-800 flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* True - False Options */}
            {isTF && currentQ.options && (
              <div className="space-y-3.5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Chọn Đúng / Sai cho từng ý (mỗi ý đúng 0.25 điểm):
                </p>
                {currentQ.options.map((opt, i) => {
                  const letter = ['a', 'b', 'c', 'd'][i];
                  const currentAnsArr = currentAnswer || ['', '', '', ''];

                  return (
                    <div 
                      key={i} 
                      className="flex flex-col sm:flex-row gap-3 p-4 border-2 border-slate-200 rounded-2xl items-center bg-slate-50/60"
                    >
                      <div className="flex-1 font-bold text-base md:text-lg text-slate-800 w-full">
                        <span className="font-mono text-teal-700 mr-2">{letter})</span>
                        {opt}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => {
                            const next = [...currentAnsArr];
                            next[i] = 'Đúng';
                            setCurrentAnswer(next);
                          }}
                          className={`flex-1 sm:px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                            currentAnsArr[i] === 'Đúng' 
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                          }`}
                        >
                          Đúng
                        </button>
                        <button 
                          onClick={() => {
                            const next = [...currentAnsArr];
                            next[i] = 'Sai';
                            setCurrentAnswer(next);
                          }}
                          className={`flex-1 sm:px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                            currentAnsArr[i] === 'Sai' 
                              ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300' 
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                          }`}
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Short Answer / Essay */}
            {isSA && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Nhập câu trả lời của bạn:</label>
                <textarea
                  value={currentAnswer || ''}
                  onChange={e => setCurrentAnswer(e.target.value)}
                  placeholder="Gõ đáp án ngắn hoặc từ khóa trả lời..."
                  className="w-full h-36 p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-medium focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none resize-none transition-shadow"
                />
              </div>
            )}
          </div>

          {/* Footer Next Button */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {currentQ.type === 'TF' 
                ? (currentAnswer?.length === 4 && !currentAnswer.includes('') ? '✓ Đã chọn đủ 4 ý' : 'Vui lòng chọn đủ 4 ý Đúng/Sai')
                : (currentAnswer ? '✓ Đã chọn câu trả lời' : 'Chưa chọn câu trả lời')
              }
            </span>

            <button
              onClick={handleNext}
              disabled={
                currentQ.type === 'TF' ? (!currentAnswer || currentAnswer.length !== 4 || currentAnswer.includes('')) : !currentAnswer
              }
              className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>{currentQIdx === selectedQuiz!.questions.length - 1 ? 'Hoàn thành bài' : 'Câu tiếp theo'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
