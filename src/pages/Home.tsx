import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { FlaskConical, Atom, Dna, Rocket, BookOpen, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-teal-300/20 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
        className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16 relative z-10"
      >
        <div className="flex justify-center mb-6 gap-4 text-teal-600">
          <FlaskConical className="w-12 h-12" />
          <Atom className="w-12 h-12" />
          <Dna className="w-12 h-12" />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-700 to-emerald-600 tracking-tight mb-4 drop-shadow-sm">
          Chào mừng đến với chương trình ôn luyện kiến thức
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 font-medium">
          Hãy chọn tính năng để bắt đầu.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl relative z-10">
        <ModeCard
          to="/host"
          icon={<Users className="w-16 h-16 text-emerald-500 mb-6" />}
          title="Chế độ toàn lớp (Giáo viên)"
          description="Khởi tạo phiên chơi chung. Trình chiếu câu hỏi, bảng xếp hạng thời gian thực và tổng kết."
          color="from-emerald-50 to-teal-50"
          hoverColor="hover:from-emerald-100 hover:to-teal-100"
          borderColor="border-emerald-200"
          shadowColor="hover:shadow-emerald-200/50"
          delay={0.1}
        />

        <ModeCard
          to="/player"
          icon={<Rocket className="w-16 h-16 text-indigo-500 mb-6" />}
          title="Tham gia (Học sinh)"
          description="Vào phòng chơi chung do giáo viên tạo để trả lời câu hỏi và đua top bảng xếp hạng."
          color="from-indigo-50 to-blue-50"
          hoverColor="hover:from-indigo-100 hover:to-blue-100"
          borderColor="border-indigo-200"
          shadowColor="hover:shadow-indigo-200/50"
          delay={0.2}
        />
        
        <ModeCard
          to="/practice"
          icon={<BookOpen className="w-16 h-16 text-sky-500 mb-6" />}
          title="Chế độ tự luyện"
          description="Làm bài tập cá nhân, theo dõi tiến độ và lưu kết quả chi tiết lên hệ thống tự động."
          color="from-sky-50 to-cyan-50"
          hoverColor="hover:from-sky-100 hover:to-cyan-100"
          borderColor="border-sky-200"
          shadowColor="hover:shadow-sky-200/50"
          delay={0.3}
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="mt-20 relative z-10"
      >
        <Link
          to="/admin"
          className="flex items-center gap-2 text-slate-500 hover:text-teal-600 font-medium transition-colors"
        >
          <Rocket className="w-5 h-5" />
          Quản trị viên (Tạo đề)
        </Link>
      </motion.div>
    </div>
  );
}

function ModeCard({ to, icon, title, description, color, hoverColor, borderColor, shadowColor, delay }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        to={to}
        className={`block h-full p-8 md:p-12 rounded-3xl bg-gradient-to-br ${color} ${hoverColor} border ${borderColor} shadow-xl shadow-slate-200/50 ${shadowColor} transition-all duration-300 group`}
      >
        <div className="flex flex-col items-center text-center">
          <motion.div
            className="p-4 bg-white rounded-2xl shadow-sm mb-6 group-hover:shadow-md transition-shadow"
            whileHover={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            {icon}
          </motion.div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4 group-hover:text-teal-700 transition-colors">
            {title}
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
