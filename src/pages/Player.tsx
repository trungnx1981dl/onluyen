import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { GameSession, Player as PlayerType, Quiz, Question } from '../types';
import { 
  Loader2, 
  ArrowLeft, 
  Gamepad2, 
  Trophy, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Home, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { calculateScoreBreakdown, gradeQuestion, formatTFAnswer } from '../utils/scoring';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

export default function Player() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [joinedSession, setJoinedSession] = useState<GameSession | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerType | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAllAnswers, setShowAllAnswers] = useState(false);

  useEffect(() => {
    // Fetch active/waiting sessions
    const fetchSessions = async () => {
      const q = query(collection(db, 'sessions'), where('status', 'in', ['WAITING', 'ACTIVE']));
      const snap = await getDocs(q);
      setSessions(snap.docs.map(d => d.data() as GameSession));
      setLoading(false);
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    const el = document.getElementById('player-question-content');
    if (el) {
      renderMathInElement(el, {
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

  const handleJoin = async (s: GameSession) => {
    if (!name.trim()) return alert("Vui lòng nhập tên của bạn!");
    try {
      const playerId = `p-${Date.now()}`;
      const newPlayer: PlayerType = {
        id: playerId,
        sessionId: s.id,
        name,
        score: 0,
        answers: {}
      };
      await setDoc(doc(db, `sessions/${s.id}/players/${playerId}`), newPlayer);
      setPlayerInfo(newPlayer);
      
      const qDoc = await getDoc(doc(db, 'quizzes', s.quizId));
      const baseQuiz = qDoc.data() as Quiz;
      if (s.questions && s.questions.length > 0) {
        setQuiz({ ...baseQuiz, questions: s.questions });
      } else {
        setQuiz(baseQuiz);
      }
      
      // Listen to session updates
      onSnapshot(doc(db, 'sessions', s.id), (snap) => {
        const updated = snap.data() as GameSession;
        setJoinedSession(updated);
        if (updated?.questions && updated.questions.length > 0) {
          setQuiz(prev => prev ? { ...prev, questions: updated.questions! } : null);
        }
        // Reset local answer state on new question
        if (updated.currentQuestionIndex !== joinedSession?.currentQuestionIndex) {
          setCurrentAnswer(null);
          setIsSubmitted(false);
        }
      });
      
    } catch (e: any) {
      alert("Lỗi tham gia: " + e.message);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!joinedSession || !playerInfo || !quiz || isSubmitted) return;
    setIsSubmitted(true);
    
    const currentQ = quiz.questions[joinedSession.currentQuestionIndex];
    const breakdown = calculateScoreBreakdown(quiz.questions);
    const grade = gradeQuestion(currentQ, currentAnswer, breakdown);

    let stringAns = '';
    if (currentQ.type === 'TF') {
      stringAns = JSON.stringify(currentAnswer);
    } else {
      stringAns = String(currentAnswer || '');
    }
    
    const earned = grade.earned;
    const updatedAnswers = { ...playerInfo.answers, [currentQ.id]: stringAns };
    const newScore = Number(((playerInfo.score || 0) + earned).toFixed(2));
    
    await updateDoc(doc(db, `sessions/${joinedSession.id}/players/${playerInfo.id}`), {
      answers: updatedAnswers,
      score: newScore
    });
    
    setPlayerInfo({ ...playerInfo, answers: updatedAnswers, score: newScore });
  };

  // 1. JOIN ROOM SCREEN
  if (!joinedSession) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-teal-50 border-2 border-teal-100 rounded-2xl flex items-center justify-center">
              <Gamepad2 className="w-9 h-9 text-teal-600" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center text-slate-800 mb-2">Vào Phòng Thi Trực Tuyến</h1>
          <p className="text-slate-500 text-xs text-center mb-6">Dành cho học sinh làm bài trên màn hình điện thoại/máy tính</p>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Họ và tên của bạn</label>
              <input 
                type="text" 
                placeholder="Nhập họ và tên..." 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
              />
            </div>
          </div>
          
          <h3 className="font-bold text-slate-700 text-sm mb-3">Chọn phòng đang mở:</h3>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <p className="text-slate-500 text-sm">Chưa có phòng học nào đang mở.</p>
              <p className="text-slate-400 text-xs mt-1">Giáo viên cần tạo và mở phòng trên màn hình chính.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto mb-6">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleJoin(s)}
                  className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-teal-50 border-2 border-slate-200 hover:border-teal-400 rounded-2xl transition-all group text-left cursor-pointer"
                >
                  <div>
                    <span className="text-xs text-slate-400 font-bold block uppercase">Mã phòng</span>
                    <span className="font-black text-lg text-slate-800 group-hover:text-teal-700 font-mono tracking-wider">
                      {s.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 bg-teal-600 text-white rounded-xl group-hover:shadow-md transition-all">
                    Vào phòng ➜
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-center">
            <Link to="/" className="text-slate-500 hover:text-teal-600 text-xs font-semibold flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Về Trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. WAITING FOR HOST
  if (joinedSession.status === 'WAITING') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-teal-500/20 border-2 border-teal-400/40 rounded-3xl flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-teal-300" />
        </div>
        <h1 className="text-3xl font-black mb-2 text-white">Xin chào {playerInfo?.name}!</h1>
        <p className="text-slate-300 text-base max-w-sm mb-8">
          Bạn đã vào phòng thành công. Hãy quan sát màn hình chiếu của giáo viên để chuẩn bị làm bài!
        </p>
        <div className="flex items-center gap-3 px-5 py-2.5 bg-white/10 rounded-2xl border border-white/10">
          <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
          <span className="text-sm font-bold text-slate-200">Đang chờ giáo viên bấm bắt đầu...</span>
        </div>
      </div>
    );
  }

  // 3. FINISHED / SUMMARY
  if (joinedSession.status === 'FINISHED') {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 text-center backdrop-blur-md">
          <div className="w-16 h-16 bg-yellow-400/20 border-2 border-yellow-400/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">KẾT THÚC BUỔI THI!</h1>
          <p className="text-slate-400 text-xs mb-4">Học sinh: {playerInfo?.name}</p>

          <div className="my-5 p-6 bg-teal-500/10 border-2 border-teal-500/30 rounded-2xl">
            <span className="text-xs uppercase font-bold text-teal-400 tracking-wider">Điểm số đạt được</span>
            <div className="text-5xl font-black text-white font-mono my-1">
              {(playerInfo?.score || 0).toFixed(2)} <span className="text-lg text-slate-400 font-sans">/ 10 đ</span>
            </div>
            <span className="text-xs text-slate-400">Quan sát đáp án chi tiết trên màn hình chiếu</span>
          </div>

          {/* Reveal Answers Button */}
          <button
            onClick={() => setShowAllAnswers(!showAllAnswers)}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mb-4 cursor-pointer"
          >
            {showAllAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showAllAnswers ? 'Ẩn đáp án đề thi' : 'Xem toàn bộ đáp án đề thi'}</span>
          </button>

          {showAllAnswers && quiz && (
            <div className="space-y-2.5 text-left max-h-60 overflow-y-auto pr-1 mb-4">
              {quiz.questions.map((q, i) => (
                <div key={i} className="p-3 bg-black/40 border border-white/10 rounded-xl text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-teal-300">Câu {i + 1} ({q.type})</span>
                  </div>
                  {q.type === 'TF' ? (
                    <div className="font-mono text-yellow-300 text-xs font-bold">
                      {formatTFAnswer(q.answer, i + 1)}
                    </div>
                  ) : q.type === 'MC' ? (
                    <div className="text-slate-200">
                      Đáp án đúng: <strong className="text-emerald-400 font-mono text-sm">{q.answer}</strong>
                    </div>
                  ) : (
                    <div className="text-slate-200">
                      Đáp án: <strong className="text-emerald-400 font-mono">{q.answer}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all"
          >
            <Home className="w-4 h-4" /> Về Trang chủ
          </Link>
        </div>
      </div>
    );
  }

  // 4. ACTIVE QUESTION
  const currentQ = quiz?.questions[joinedSession.currentQuestionIndex];
  if (!currentQ) return null;

  const isTF = currentQ.type === 'TF';
  const isMC = currentQ.type === 'MC';
  const isSA = currentQ.type === 'SA' || currentQ.type === 'ESSAY';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4 max-w-lg mx-auto w-full select-none">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl flex-1 flex flex-col justify-between backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 font-black px-3 py-1 rounded-xl text-sm">
              CÂU {joinedSession.currentQuestionIndex + 1}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">
              {isMC ? 'Trắc nghiệm' : isTF ? 'Đúng - Sai (4 ý)' : 'Trả lời ngắn'}
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">{playerInfo?.name}</span>
        </div>

        {/* Question Text Preview */}
        <div id="player-question-content" className="py-4 text-base sm:text-lg font-bold text-slate-100 line-clamp-3">
          {currentQ.content}
        </div>
        
        {isSubmitted ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="w-16 h-16 bg-teal-500/20 border-2 border-teal-400 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Đã nộp câu trả lời!</h2>
            <p className="text-slate-400 text-xs mt-1">Đang chờ giáo viên chuyển sang câu tiếp theo...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between pt-2">
            {/* Multiple Choice Options */}
            {isMC && (
              <div className="grid grid-cols-2 gap-3.5 flex-1 items-center">
                {['A','B','C','D'].map((opt, i) => {
                  const colors = [
                    'bg-rose-600 hover:bg-rose-500', 
                    'bg-blue-600 hover:bg-blue-500', 
                    'bg-amber-600 hover:bg-amber-500', 
                    'bg-emerald-600 hover:bg-emerald-500'
                  ];
                  const isSelected = currentAnswer === opt;
                  
                  return (
                    <button
                      key={opt}
                      onClick={() => setCurrentAnswer(opt)}
                      className={`${colors[i]} h-28 rounded-2xl relative overflow-hidden transition-all transform active:scale-95 flex flex-col items-center justify-center cursor-pointer shadow-lg ${
                        isSelected ? 'ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105' : 'opacity-90'
                      }`}
                    >
                      <span className="text-4xl font-black text-white">{opt}</span>
                      {currentQ.options && currentQ.options[i] && (
                        <span className="text-[11px] font-bold text-white/90 px-2 text-center line-clamp-1 mt-1">
                          {currentQ.options[i]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* True - False Options */}
            {isTF && (
              <div className="flex-1 flex flex-col gap-2.5 justify-center py-2">
                <p className="text-slate-400 text-xs text-center mb-1">
                  Chọn Đúng / Sai cho cả 4 ý (mỗi ý đúng 0.25 đ):
                </p>
                {['a','b','c','d'].map((letter, i) => {
                  const currentAnsArr = currentAnswer || ['','','',''];
                  const optText = currentQ.options ? currentQ.options[i] : '';

                  return (
                    <div key={i} className="flex items-center gap-2 bg-white/5 border border-white/10 p-2.5 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {letter})
                      </div>
                      <div className="flex-1 text-xs font-semibold text-slate-200 line-clamp-1">
                        {optText || `Ý ${letter.toUpperCase()}`}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button 
                          onClick={() => {
                            const newAns = [...currentAnsArr];
                            newAns[i] = 'Đúng';
                            setCurrentAnswer(newAns);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            currentAnsArr[i] === 'Đúng' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          Đúng
                        </button>
                        <button 
                          onClick={() => {
                            const newAns = [...currentAnsArr];
                            newAns[i] = 'Sai';
                            setCurrentAnswer(newAns);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            currentAnsArr[i] === 'Sai' ? 'bg-rose-600 text-white font-black' : 'bg-white/10 text-slate-300'
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
              <div className="flex-1 flex flex-col justify-center py-4">
                <textarea
                  value={currentAnswer || ''}
                  onChange={e => setCurrentAnswer(e.target.value)}
                  placeholder="Gõ câu trả lời ngắn của bạn tại đây..."
                  className="w-full h-32 p-4 bg-black/30 border-2 border-white/15 rounded-2xl text-base font-medium text-white focus:border-teal-400 outline-none resize-none"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmitAnswer}
              disabled={
                currentQ.type === 'TF' ? (!currentAnswer || currentAnswer.length !== 4 || currentAnswer.includes('')) : !currentAnswer
              }
              className="mt-4 w-full py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 text-slate-950 font-black text-lg rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg active:scale-98"
            >
              NỘP BÀI CÂU NÀY
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
