import React from 'react';
import { motion } from 'motion/react';

export default function Introduction() {
  return (
    <div className="bg-white pt-5 pb-16 sm:pt-10 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">교회 소개</h1>
            <div className="w-24 h-1 bg-gold-500 mx-auto" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
                alt="Bible and light"
                className="rounded-2xl shadow-xl object-cover h-[500px] w-full border-4 border-wood-200"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-wood-900 mb-4">개혁주의 신학의 정체성</h2>
                <p className="text-wood-700 leading-relaxed text-lg">
                  '함께 지어져가는 교회'는 역사적 개혁주의 신앙고백(웨스트민스터 신앙고백서, 하이델베르크 요리문답 등)을
                  우리의 신앙과 삶의 표준으로 삼습니다. 오직 성경, 오직 은혜, 오직 믿음, 오직 그리스도, 오직 하나님께 영광이라는
                  종교개혁의 5대 솔라(Sola)를 굳게 붙듭니다.
                </p>
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-wood-900 mb-4">개척 준비 과정</h2>
                <p className="text-wood-700 leading-relaxed text-lg">
                  현재 우리는 하나님의 인도하심을 구하며 교회를 세워가기 위한 기도의 시간을 갖고 있습니다.
                  바른 말씀 선포와 참된 예배의 회복을 갈망하는 성도들과 함께, 에베소서 2장 22절 말씀처럼
                  그리스도 예수 안에서 성령의 전으로 지어져 가기를 소망합니다.
                </p>
              </div>

              <div className="bg-wood-50 p-6 rounded-xl border-l-4 border-wood-900">
                <p className="font-serif italic text-wood-900 text-lg leading-relaxed">
                  "우리는 건물이 아니라 사람을 세우는 일에 부름받았습니다.
                  하나님의 말씀이 선포되고, 성례가 바르게 집행되며, 권징이 신실하게 시행되는
                  참된 교회의 표지를 회복하는 여정에 여러분을 초대합니다."
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
