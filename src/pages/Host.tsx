import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Quiz } from '../types';
import { Loader2, ArrowLeft, Play, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Host() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleStartGame = async (quiz: Quiz) => {
    // Navigate to active game host view (passing quiz state)
    // Normally we'd create a Session document in Firestore here.
    // For simplicity, we navigate to the board.
    navigate(`/host/board/${quiz.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-700" />
            </Link>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Chế độ toàn lớp</h1>
          </div>
        </header>

        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-3 mb-8">
            <LayoutGrid className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-bold text-slate-800">Chọn bộ đề để bắt đầu</h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-emerald-600" /></div>
          ) : quizzes.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 text-lg">Không có bộ đề nào. Vui lòng vào trang quản trị để tạo đề.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map(quiz => (
                <div key={quiz.id} className="group relative bg-slate-50 rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-emerald-300 transition-all duration-300 flex flex-col h-full overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleStartGame(quiz)}
                      className="w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                    >
                      <Play className="w-6 h-6 ml-1" />
                    </button>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 mb-2 pr-12 line-clamp-2 group-hover:text-emerald-700 transition-colors">{quiz.title}</h3>
                  <div className="mt-auto pt-6 space-y-2 text-sm font-medium text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Số câu hỏi:</span>
                      <span className="text-slate-800 bg-slate-200 px-2 py-1 rounded-md">{quiz.questions?.length || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Môn học:</span>
                      <span className="text-slate-800 bg-slate-200 px-2 py-1 rounded-md">{quiz.subject || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
